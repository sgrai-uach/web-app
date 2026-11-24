import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useConnectivity } from '../useConnectivity';
import * as offlineQueue from '@/services/offlineQueue';

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

    vi.mocked(offlineQueue.sincronizarColaOutbox).mockImplementation(async (callback) => {
      global.fetch = vi.fn().mockResolvedValue({
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
  });

  it('sincroniza acción ACEPTAR_MISION de cuadrilla preservando estadoCuadrilla y estadoIncidente (H40)', async () => {
    vi.mocked(offlineQueue.obtenerMisionLocalPorId).mockResolvedValue({
      id: 'mis-cuad-40',
      incidenteId: 'inc-40',
      codigoIncidente: 'INC-2026-0040',
      tipologia: 'Caída de árbol',
      direccion: 'Valdivia',
      prioridad: 'ALTA',
      estado: 'EN_CURSO',
      fechaDespacho: '2026-11-22T13:30:00Z',
      sincronizacionPendiente: true,
      actualizadoEn: '2026-11-22T13:30:00Z',
    });

    vi.mocked(offlineQueue.sincronizarColaOutbox).mockImplementation(async (callback) => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        clone: () => ({
          json: async () => ({
            data: {
              mision: {
                id: 'mis-cuad-40',
                fechaInicio: '2026-11-22T14:00:00Z',
              },
              cuadrilla: { id: 'cuad-1', nombre: 'Cuadrilla 1', estado: 'EN_MISION' },
              incidente: { id: 'inc-40', codigo: 'INC-2026-0040', estado: 'EN_ATENCION' },
              hito: { descripcion: 'Asignación Aceptada por Cuadrilla' },
            },
          }),
        }),
      } as unknown as Response);

      await callback({
        id: 'outbox-acep-40',
        tipo: 'ACEPTAR_MISION',
        url: '/api/misiones/mis-cuad-40/aceptar',
        metodo: 'POST',
        payload: {},
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
        id: 'mis-cuad-40',
        estado: 'EN_CURSO',
        fechaInicio: '2026-11-22T14:00:00Z',
        sincronizacionPendiente: false,
        datosAdicionales: expect.objectContaining({
          estadoCuadrilla: 'EN_MISION',
          estadoIncidente: 'EN_ATENCION',
          hitoAceptacion: 'Asignación Aceptada por Cuadrilla',
        }),
      })
    );
  });

  it('sincroniza acción REPORTAR_LLEGADA actualizando fechaLlegada y limpiando sincronizacionPendiente (H42)', async () => {
    vi.mocked(offlineQueue.obtenerMisionLocalPorId).mockResolvedValue({
      id: 'mis-cuad-42',
      incidenteId: 'inc-42',
      codigoIncidente: 'INC-2026-0042',
      tipologia: 'Anegamiento',
      direccion: 'Valdivia',
      prioridad: 'ALTA',
      estado: 'EN_CURSO',
      fechaDespacho: '2026-11-22T13:30:00Z',
      fechaInicio: '2026-11-22T14:00:00Z',
      sincronizacionPendiente: true,
      actualizadoEn: '2026-11-22T14:00:00Z',
    });

    vi.mocked(offlineQueue.sincronizarColaOutbox).mockImplementation(async (callback) => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        clone: () => ({
          json: async () => ({
            data: {
              registradoEn: '2026-11-22T14:20:00Z',
            },
          }),
        }),
      } as unknown as Response);

      await callback({
        id: 'outbox-lleg-42',
        tipo: 'REPORTAR_LLEGADA',
        url: '/api/misiones/mis-cuad-42/llegada',
        metodo: 'POST',
        payload: { latitud: -39.81, longitud: -73.24 },
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
        id: 'mis-cuad-42',
        estado: 'EN_CURSO',
        fechaLlegada: '2026-11-22T14:20:00Z',
        sincronizacionPendiente: false,
      })
    );
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

  it('drena acción ACEPTAR_MISION de cuadrilla actualizando fechaInicio, estadoCuadrilla y estadoIncidente desde la respuesta', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    vi.mocked(offlineQueue.contarAccionesPendientes).mockResolvedValue(0);
    vi.mocked(offlineQueue.obtenerMisionLocalPorId).mockResolvedValue({
      id: '70000000-0000-4000-8000-000000000001',
      incidenteId: '30000000-0000-4000-8000-000000000001',
      codigoIncidente: 'INC-2026-0001',
      tipologia: 'Árbol caído',
      direccion: 'Av. Ramón Picarte 1100',
      prioridad: 'ALTA',
      estado: 'EN_CURSO',
      fechaDespacho: '2026-11-22T13:30:00.000Z',
      fechaInicio: '2026-11-22T13:45:00.000Z',
      sincronizacionPendiente: true,
      datosAdicionales: {
        tipoMision: 'ATENCION_CUADRILLA',
        estadoCuadrilla: 'EN_MISION',
        estadoIncidente: 'EN_ATENCION',
      },
      actualizadoEn: '2026-11-22T13:45:00.000Z',
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      clone: () => ({
        json: async () => ({
          data: {
            mision: { fechaInicio: '2026-11-22T14:00:00.000Z' },
            cuadrilla: { estado: 'EN_MISION' },
            patrulla: null,
            incidente: { estado: 'EN_ATENCION' },
            hito: { descripcion: 'Asignación Aceptada por Cuadrilla' },
          },
        }),
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    let procesada = false;
    vi.mocked(offlineQueue.sincronizarColaOutbox).mockImplementation(async (ejecutor) => {
      procesada = await ejecutor({
        id: 'out-acc-1',
        tipo: 'ACEPTAR_MISION',
        url: '/api/misiones/70000000-0000-4000-8000-000000000001/aceptar',
        metodo: 'POST',
        timestamp: '2026-11-22T13:45:00.000Z',
        intentos: 0,
        payload: { latitud: -39.819588, longitud: -73.245209 },
      });
      return { total: 1, exitosas: 1, fallidas: 0 };
    });

    const { result } = renderHook(() => useConnectivity());

    await act(async () => {
      await result.current.sincronizar();
    });

    expect(procesada).toBe(true);
    expect(offlineQueue.guardarMisionLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '70000000-0000-4000-8000-000000000001',
        estado: 'EN_CURSO',
        fechaInicio: '2026-11-22T14:00:00.000Z',
        sincronizacionPendiente: false,
        datosAdicionales: expect.objectContaining({
          estadoCuadrilla: 'EN_MISION',
          estadoIncidente: 'EN_ATENCION',
          hitoAceptacion: 'Asignación Aceptada por Cuadrilla',
        }),
      })
    );

    vi.unstubAllGlobals();
  });
});
