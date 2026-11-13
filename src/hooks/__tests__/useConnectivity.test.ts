import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConnectivity } from '../useConnectivity';
import * as offlineQueue from '@/services/offlineQueue';

vi.mock('@/services/offlineQueue');

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
});
