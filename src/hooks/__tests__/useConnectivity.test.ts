import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useConnectivity } from '../useConnectivity';
import * as offlineQueue from '@/services/offlineQueue';
import { obtenerDetalleMision } from '@/services/misionesService';

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

  it('no descarta ACTUALIZAR_TIPOLOGIA del outbox ante 409 Conflict', async () => {
    vi.mocked(offlineQueue.sincronizarColaOutbox).mockImplementation(async (ejecutor) => {
      const ok = await ejecutor({
        id: 'act-tip-1',
        tipo: 'ACTUALIZAR_TIPOLOGIA',
        url: '/api/incidentes/50000000-0000-4000-8000-000000000001/tipologia',
        metodo: 'PATCH',
        payload: { tipoIncidenteId: '40000000-0000-4000-8000-000000000001', justificacion: 'Motivo' },
        timestamp: new Date().toISOString(),
        intentos: 0,
      });
      return { total: 1, exitosas: ok ? 1 : 0, fallidas: ok ? 0 : 1 };
    });

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ message: 'Conflict' }), { status: 409 }));

    const { result } = renderHook(() => useConnectivity());
    await act(async () => {
      await result.current.sincronizar();
    });

    expect(fetchSpy).toHaveBeenCalled();
    expect(offlineQueue.guardarMisionLocal).not.toHaveBeenCalled();
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
});
