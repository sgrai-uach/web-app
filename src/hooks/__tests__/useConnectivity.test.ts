import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useConnectivity } from '../useConnectivity';
import * as offlineQueue from '@/services/offlineQueue';
import { obtenerDetalleMision } from '@/services/misionesService';
import { setAuthCookie, removeAuthCookie } from '@/lib/utils/cookieUtils';

vi.mock('@/services/offlineQueue');
vi.mock('@/services/misionesService', () => ({
  obtenerDetalleMision: vi.fn(),
}));

describe('useConnectivity hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(offlineQueue.contarAccionesPendientes).mockResolvedValue(0);
  });

  it('inicia con estado conectado si navigator.onLine es true', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

    const { result } = renderHook(() => useConnectivity());

    expect(result.current.online).toBe(true);
    expect(result.current.status).toBe('connected');
  });

  it('cambia a offline al disparar evento offline', () => {
    const { result } = renderHook(() => useConnectivity());

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current.online).toBe(false);
    expect(result.current.status).toBe('offline');
  });

  it('dispara sincronización y vuelve a conectado al recuperar online', async () => {
    vi.mocked(offlineQueue.sincronizarColaOutbox).mockResolvedValue({
      total: 1,
      exitosas: 1,
      fallidas: 0,
    });

    const { result } = renderHook(() => useConnectivity());

    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    expect(result.current.online).toBe(true);
  });

  it('no descarta ACTUALIZAR_TIPOLOGIA del outbox ante 409 Conflict (BUG-INT-PWA-08)', async () => {
    const misionId = '60000000-0000-4000-8000-000000000001';
    vi.mocked(offlineQueue.obtenerMisionLocalPorId).mockResolvedValue({
      id: misionId,
      incidenteId: '50000000-0000-4000-8000-000000000001',
      codigoIncidente: 'INC-2026-0001',
      tipologia: 'Inundación',
      direccion: 'Valdivia',
      prioridad: 'ALTA',
      estado: 'EN_CURSO',
      fechaDespacho: '2026-11-10T00:00:00Z',
      actualizadoEn: '2026-11-10T00:00:00Z',
      sincronizacionPendiente: true,
      datosAdicionales: { tipologiaEvaluada: true },
    });

    let ejecutorResultado = true;
    vi.mocked(offlineQueue.sincronizarColaOutbox).mockImplementation(async (ejecutor) => {
      ejecutorResultado = await ejecutor({
        id: 'act-tip-1',
        tipo: 'ACTUALIZAR_TIPOLOGIA',
        url: '/api/incidentes/50000000-0000-4000-8000-000000000001/tipologia',
        metodo: 'PATCH',
        payload: {
          misionId,
          tipoIncidenteId: '40000000-0000-4000-8000-000000000001',
          justificacion: 'Motivo',
        },
        timestamp: new Date().toISOString(),
        intentos: 0,
      });
      return { total: 1, exitosas: ejecutorResultado ? 1 : 0, fallidas: ejecutorResultado ? 0 : 1 };
    });

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ message: 'Conflict' }), { status: 409 }));

    const { result } = renderHook(() => useConnectivity());
    await act(async () => {
      await result.current.sincronizar();
    });

    expect(fetchSpy).toHaveBeenCalled();
    expect(ejecutorResultado).toBe(false);
    expect(offlineQueue.guardarMisionLocal).not.toHaveBeenCalled();
    expect(offlineQueue.eliminarAccionOutbox).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('revierte estado local y refresca misión desde servidor si ACTUALIZAR_TIPOLOGIA falla con error irrecuperable 400/403/404/422 (BUG-H37-PWA-03)', async () => {
    const misionId = '60000000-0000-4000-8000-000000000077';
    const incidenteId = '50000000-0000-4000-8000-000000000077';

    vi.mocked(offlineQueue.obtenerMisionLocalPorId).mockResolvedValue({
      id: misionId,
      incidenteId,
      codigoIncidente: 'INC-2026-0077',
      tipologia: 'Inundación',
      direccion: 'Av. Picarte 500',
      prioridad: 'ALTA',
      estado: 'EN_CURSO',
      fechaDespacho: '2026-10-30T04:00:00Z',
      sincronizacionPendiente: true,
      datosAdicionales: {
        trabajo: 'Verificar incidente',
        tipologiaEvaluada: true,
        tipoIncidenteId: '40000000-0000-4000-8000-000000000001',
        justificacionTipologia: 'Motivo rechazado',
        fechaEvaluacionTipologia: '2026-10-30T04:10:00Z',
        esReclasificacion: true,
      },
      actualizadoEn: '2026-10-30T04:10:00Z',
    });

    let ejecutorResultado = false;
    vi.mocked(offlineQueue.sincronizarColaOutbox).mockImplementation(async (ejecutor) => {
      ejecutorResultado = await ejecutor({
        id: 'act-tip-err-1',
        tipo: 'ACTUALIZAR_TIPOLOGIA',
        url: `/api/incidentes/${incidenteId}/tipologia`,
        metodo: 'PATCH',
        payload: {
          misionId,
          tipoIncidenteId: '40000000-0000-4000-8000-000000000001',
          justificacion: 'Motivo rechazado',
        },
        timestamp: new Date().toISOString(),
        intentos: 0,
      });
      return { total: 1, exitosas: ejecutorResultado ? 1 : 0, fallidas: ejecutorResultado ? 0 : 1 };
    });

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ message: 'Unprocessable Entity' }), { status: 422 }));

    const { result } = renderHook(() => useConnectivity());
    await act(async () => {
      await result.current.sincronizar();
    });

    expect(ejecutorResultado).toBe(true);
    expect(offlineQueue.guardarMisionLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        id: misionId,
        sincronizacionPendiente: false,
        datosAdicionales: {
          trabajo: 'Verificar incidente',
        },
      })
    );
    expect(offlineQueue.eliminarAccionOutbox).toHaveBeenCalledWith('act-tip-err-1');
    expect(obtenerDetalleMision).toHaveBeenCalledWith(misionId);
    fetchSpy.mockRestore();
  });

  it('reconcilia ENVIAR_REPORTE exitoso (201) y revierte cierre optimista ante rechazo 403/409 (BUG-H39-PWA-03)', async () => {
    const misionId = '60000000-0000-4000-8000-000000000039';
    vi.mocked(offlineQueue.obtenerMisionLocalPorId).mockResolvedValue({
      id: misionId,
      incidenteId: 'inc-39',
      codigoIncidente: 'INC-2026-0039',
      tipologia: 'Inundación',
      direccion: 'Valdivia',
      prioridad: 'ALTA',
      estado: 'COMPLETADA',
      fechaDespacho: '2026-11-10T01:00:00Z',
      sincronizacionPendiente: true,
      datosAdicionales: {
        trabajo: 'Verificar',
        reporteVerificacionEnviado: true,
        dictamenVerificacion: 'REQUIERE_CUADRILLA',
        reporteVerificacion: { id: 'rep-local', sincronizado: false },
      },
      actualizadoEn: '2026-11-10T01:10:00Z',
    });

    vi.mocked(offlineQueue.sincronizarColaOutbox).mockImplementation(async (ejecutor) => {
      await ejecutor({
        id: 'act-rep-403',
        tipo: 'ENVIAR_REPORTE',
        url: `/api/misiones/${misionId}/reporte`,
        metodo: 'POST',
        payload: { dictamen: 'REQUIERE_CUADRILLA', resumen_tecnico: 'Test rollback.' },
        timestamp: new Date().toISOString(),
        intentos: 0,
      });
      return { total: 1, exitosas: 1, fallidas: 0 };
    });

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 }));

    const { result } = renderHook(() => useConnectivity());
    await act(async () => {
      await result.current.sincronizar();
    });

    expect(offlineQueue.guardarMisionLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        id: misionId,
        estado: 'EN_CURSO',
        sincronizacionPendiente: false,
      })
    );
    expect(offlineQueue.eliminarAccionOutbox).toHaveBeenCalledWith('act-rep-403');
    expect(obtenerDetalleMision).toHaveBeenCalledWith(misionId);
    fetchSpy.mockRestore();
  });

  it('dispara sincronización automática al montar con conexión si hay pendientes y reporta status syncing mientras existan pendientes (BUG-H36-PWA-04)', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    vi.mocked(offlineQueue.contarAccionesPendientes)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    vi.mocked(offlineQueue.sincronizarColaOutbox).mockResolvedValue({
      total: 1,
      exitosas: 0,
      fallidas: 1,
    });

    const { result } = renderHook(() => useConnectivity());

    await waitFor(() => {
      expect(offlineQueue.sincronizarColaOutbox).toHaveBeenCalled();
      expect(result.current.pendientes).toBe(1);
      expect(result.current.status).toBe('syncing');
    });
  });

  it('envía FormData multipart al sincronizar una acción SUBIR_EVIDENCIA y trata 415 como error terminal', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    vi.mocked(offlineQueue.contarAccionesPendientes).mockResolvedValue(0);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 415,
      clone: () => ({ json: async () => ({}) }),
    });
    vi.stubGlobal('fetch', fetchMock);

    let procesada = false;
    vi.mocked(offlineQueue.sincronizarColaOutbox).mockImplementation(async (ejecutor) => {
      procesada = await ejecutor({
        id: 'out-ev-1',
        tipo: 'SUBIR_EVIDENCIA',
        url: '/api/evidencia/adjuntos',
        metodo: 'POST',
        timestamp: '2026-11-17T19:00:00.000Z',
        intentos: 0,
        payload: {
          adjuntoLocalId: 'local-1',
          misionId: 'mision-1',
          incidente_id: '22222222-2222-4222-8222-222222222222',
          nombreArchivo: 'video.mp4',
          tipoMime: 'video/mp4',
          tamanoBytes: 128,
          dataUrl: `data:video/mp4;base64,${btoa('video')}`,
        },
      });
      return { total: 1, exitosas: 1, fallidas: 0 };
    });

    const { result } = renderHook(() => useConnectivity());

    await act(async () => {
      await result.current.sincronizar();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get('incidente_id')).toBe(
      '22222222-2222-4222-8222-222222222222'
    );
    expect(procesada).toBe(true);
    expect(offlineQueue.marcarErrorAdjuntoLocalEnMision).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('reconcilia AJUSTAR_PRIORIDAD en outbox tras 200 OK limpiando sincronizacionPendiente y marcando reportes sincronizados', async () => {
    vi.mocked(offlineQueue.obtenerMisionLocalPorId).mockResolvedValue({
      id: '60000000-0000-4000-8000-000000000001',
      incidenteId: '50000000-0000-4000-8000-000000000001',
      codigoIncidente: 'INC-2026-001',
      tipologia: 'Inundación',
      direccion: 'Valdivia',
      prioridad: 'MEDIA',
      estado: 'EN_CURSO',
      fechaDespacho: '2026-11-10T00:00:00Z',
      actualizadoEn: '2026-11-10T00:00:00Z',
      sincronizacionPendiente: true,
      datosAdicionales: {
        reportesPrioridad: [{ versionReporte: 1, sincronizado: false }],
      },
    });

    vi.mocked(offlineQueue.sincronizarColaOutbox).mockImplementation(async (ejecutor) => {
      const ok = await ejecutor({
        id: 'act-prio-1',
        tipo: 'AJUSTAR_PRIORIDAD',
        url: '/api/incidentes/50000000-0000-4000-8000-000000000001/prioridad',
        metodo: 'PATCH',
        payload: {
          misionId: '60000000-0000-4000-8000-000000000001',
          prioridad: 'CRITICA',
        },
        timestamp: new Date().toISOString(),
        intentos: 0,
      });
      return { total: 1, exitosas: ok ? 1 : 0, fallidas: ok ? 0 : 1 };
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ data: { incidente: { prioridad: 'CRITICA' } } }),
        { status: 200 }
      )
    );

    const { result } = renderHook(() => useConnectivity());
    await act(async () => {
      await result.current.sincronizar();
    });

    expect(offlineQueue.guardarMisionLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        prioridad: 'CRITICA',
        sincronizacionPendiente: false,
        datosAdicionales: expect.objectContaining({
          reportesPrioridad: [expect.objectContaining({ sincronizado: true })],
        }),
      })
    );
    fetchSpy.mockRestore();
  });

  it('descarta AJUSTAR_PRIORIDAD del outbox cuando recibe HTTP 409 Conflict y limpia sincronizacionPendiente', async () => {
    vi.mocked(offlineQueue.obtenerMisionLocalPorId).mockResolvedValue({
      id: '60000000-0000-4000-8000-000000000001',
      incidenteId: '50000000-0000-4000-8000-000000000001',
      codigoIncidente: 'INC-2026-001',
      tipologia: 'Inundación',
      direccion: 'Valdivia',
      prioridad: 'MEDIA',
      estado: 'EN_CURSO',
      fechaDespacho: '2026-11-10T00:00:00Z',
      actualizadoEn: '2026-11-10T00:00:00Z',
      sincronizacionPendiente: true,
      datosAdicionales: {
        reportesPrioridad: [{ versionReporte: 1, sincronizado: false }],
      },
    });

    let ejecutorResultado = false;
    vi.mocked(offlineQueue.sincronizarColaOutbox).mockImplementation(async (ejecutor) => {
      ejecutorResultado = await ejecutor({
        id: 'act-prio-409',
        tipo: 'AJUSTAR_PRIORIDAD',
        url: '/api/incidentes/50000000-0000-4000-8000-000000000001/prioridad',
        metodo: 'PATCH',
        payload: {
          misionId: '60000000-0000-4000-8000-000000000001',
          prioridad: 'CRITICA',
        },
        timestamp: new Date().toISOString(),
        intentos: 0,
      });
      return {
        total: 1,
        exitosas: ejecutorResultado ? 1 : 0,
        fallidas: ejecutorResultado ? 0 : 1,
      };
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Conflicto de estado' }), {
        status: 409,
      })
    );

    const { result } = renderHook(() => useConnectivity());
    await act(async () => {
      await result.current.sincronizar();
    });

    expect(ejecutorResultado).toBe(true);
    expect(offlineQueue.guardarMisionLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        prioridad: 'MEDIA',
        sincronizacionPendiente: false,
        datosAdicionales: expect.objectContaining({
          reportesPrioridad: [expect.objectContaining({ sincronizado: false })],
        }),
      })
    );
    fetchSpy.mockRestore();
  });

  it('no inyecta bypass x-user-id ante token no-JWT en outbox (BUG-INT-PWA-07)', async () => {
    setAuthCookie('dev-patrulla-token');
    vi.mocked(offlineQueue.sincronizarColaOutbox).mockImplementation(async (ejecutor) => {
      const ok = await ejecutor({
        id: 'act-auth-1',
        tipo: 'ACEPTAR_MISION',
        url: '/api/misiones/mis-auth-1/aceptar',
        metodo: 'POST',
        payload: {},
        timestamp: new Date().toISOString(),
        intentos: 0,
      });
      return { total: 1, exitosas: ok ? 1 : 0, fallidas: ok ? 0 : 1 };
    });

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const { result } = renderHook(() => useConnectivity());
    await act(async () => {
      await result.current.sincronizar();
    });

    const [, initArg] = fetchSpy.mock.calls[0];
    const headers = (initArg?.headers || {}) as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer dev-patrulla-token');
    expect(headers['x-user-id']).toBeUndefined();

    removeAuthCookie();
    fetchSpy.mockRestore();
  });

  it('revierte rechazo optimista y refresca desde servidor si RECHAZAR_MISION recibe 409 Conflict (BUG-INT-PWA-08)', async () => {
    vi.mocked(offlineQueue.obtenerMisionLocalPorId).mockResolvedValue({
      id: 'mis-rech-409',
      incidenteId: 'inc-rech-409',
      codigoIncidente: 'INC-2026-0409',
      tipologia: 'Caída de árbol',
      direccion: 'Valdivia',
      prioridad: 'ALTA',
      estado: 'EN_CURSO',
      fechaDespacho: '2026-11-01T20:30:00Z',
      sincronizacionPendiente: true,
      datosAdicionales: {
        trabajo: 'Verificar caída',
        justificacionRechazo: 'Falla mecánica',
      },
      actualizadoEn: '2026-11-01T20:30:00Z',
    });

    let ejecutorResultado = false;
    vi.mocked(offlineQueue.sincronizarColaOutbox).mockImplementation(async (ejecutor) => {
      ejecutorResultado = await ejecutor({
        id: 'outbox-rech-409',
        tipo: 'RECHAZAR_MISION',
        url: '/api/misiones/mis-rech-409/rechazar',
        metodo: 'POST',
        payload: { justificacion_rechazo: 'Falla mecánica' },
        timestamp: new Date().toISOString(),
        intentos: 0,
      });
      return { total: 1, exitosas: ejecutorResultado ? 1 : 0, fallidas: ejecutorResultado ? 0 : 1 };
    });

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ message: 'Conflicto de estado' }), { status: 409 }));

    const { result } = renderHook(() => useConnectivity());
    await act(async () => {
      await result.current.sincronizar();
    });

    expect(ejecutorResultado).toBe(true);
    expect(offlineQueue.guardarMisionLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'mis-rech-409',
        estado: 'EN_CURSO',
        sincronizacionPendiente: false,
        datosAdicionales: { trabajo: 'Verificar caída' },
      })
    );
    expect(offlineQueue.eliminarAccionOutbox).toHaveBeenCalledWith('outbox-rech-409');
    expect(obtenerDetalleMision).toHaveBeenCalledWith('mis-rech-409');
    fetchSpy.mockRestore();
  });
  it('sincroniza acción RECHAZAR_MISION y limpia sincronizacionPendiente en IndexedDB', async () => {
    vi.mocked(offlineQueue.obtenerMisionLocalPorId).mockResolvedValue({
      id: 'mis-rech-1',
      incidenteId: 'inc-1',
      codigoIncidente: 'INC-2026-0001',
      tipologia: 'Caída de árbol',
      direccion: 'Valdivia',
      prioridad: 'ALTA',
      estado: 'RECHAZADA',
      fechaDespacho: '2026-11-01T20:30:00Z',
      sincronizacionPendiente: true,
      actualizadoEn: '2026-11-01T20:30:00Z',
    });

    let fetchSpy: { mockRestore: () => void } | undefined;
    vi.mocked(offlineQueue.sincronizarColaOutbox).mockImplementation(async (callback) => {
      fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        clone: () => ({
          json: async () => ({
            data: { mision: { id: 'mis-rech-1', actualizadoEn: '2026-11-01T21:00:00Z' } },
          }),
        }),
      } as unknown as Response);

      await callback({
        id: 'outbox-rech-1',
        tipo: 'RECHAZAR_MISION',
        url: '/api/misiones/mis-rech-1/rechazar',
        metodo: 'POST',
        payload: { justificacion_rechazo: 'Falla mecánica' },
        timestamp: new Date().toISOString(),
        intentos: 0,
      });

      return { total: 1, exitosas: 1, fallidas: 0 };
    });

    const { result } = renderHook(() => useConnectivity());

    await act(async () => {
      await result.current.sincronizar();
    });

    expect(offlineQueue.guardarMisionLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'mis-rech-1',
        estado: 'RECHAZADA',
        sincronizacionPendiente: false,
      })
    );
    fetchSpy?.mockRestore();
  });

  it('revierte estado local a DESPACHADA, limpia justificacionRechazo, elimina acción del outbox y refresca ante errores 409/403/400 en RECHAZAR_MISION (BUG-H41-PWA-03 / PWA-04)', async () => {
    for (const statusError of [409, 403, 400]) {
      vi.clearAllMocks();
      vi.mocked(offlineQueue.obtenerMisionLocalPorId).mockResolvedValue({
        id: 'mis-rech-err',
        incidenteId: 'inc-1',
        codigoIncidente: 'INC-2026-0001',
        tipologia: 'Caída de árbol',
        direccion: 'Valdivia',
        prioridad: 'ALTA',
        estado: 'RECHAZADA',
        fechaDespacho: '2026-11-01T20:30:00Z',
        sincronizacionPendiente: true,
        datosAdicionales: {
          justificacionRechazo: 'Falla mecánica optimista',
          trabajo: 'Despeje',
        },
        actualizadoEn: '2026-11-01T20:30:00Z',
      });

      vi.mocked(offlineQueue.sincronizarColaOutbox).mockImplementation(async (callback) => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: statusError,
          clone: () => ({ json: async () => ({ message: 'Conflicto o rechazo inválido' }) }),
        } as unknown as Response);

        const procesada = await callback({
          id: `outbox-rech-err-${statusError}`,
          tipo: 'RECHAZAR_MISION',
          url: '/api/misiones/mis-rech-err/rechazar',
          metodo: 'POST',
          payload: { justificacion_rechazo: 'Falla mecánica optimista' },
          timestamp: new Date().toISOString(),
          intentos: 0,
        });
        expect(procesada).toBe(true);

        return { total: 1, exitosas: 1, fallidas: 0 };
      });

      if (statusError === 409) {
        vi.mocked(obtenerDetalleMision).mockRejectedValueOnce(new Error('Fallo de red al refrescar'));
      } else {
        vi.mocked(obtenerDetalleMision).mockResolvedValueOnce(null);
      }

      const { result } = renderHook(() => useConnectivity());

      await act(async () => {
        await result.current.sincronizar();
      });

      expect(offlineQueue.guardarMisionLocal).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'mis-rech-err',
          estado: 'DESPACHADA',
          sincronizacionPendiente: false,
          datosAdicionales: { trabajo: 'Despeje' },
        })
      );
      expect(offlineQueue.eliminarAccionOutbox).toHaveBeenCalledWith(
        `outbox-rech-err-${statusError}`
      );
      expect(obtenerDetalleMision).toHaveBeenCalledWith('mis-rech-err');
    }
  });
});
