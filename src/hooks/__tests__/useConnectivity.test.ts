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
});
