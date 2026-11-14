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
});
