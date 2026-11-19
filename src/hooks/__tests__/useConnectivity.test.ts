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
});
