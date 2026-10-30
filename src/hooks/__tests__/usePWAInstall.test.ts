import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePWAInstall } from '../usePWAInstall';

describe('usePWAInstall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('debe inicializarse en false cuando no se ha disparado beforeinstallprompt', () => {
    const { result } = renderHook(() => usePWAInstall());
    expect(result.current.puedeInstalar).toBe(false);
    expect(result.current.estaInstalada).toBe(false);
  });

  it('debe activar puedeInstalar cuando se emite el evento beforeinstallprompt', () => {
    const { result } = renderHook(() => usePWAInstall());

    const fakePromptEvent = new Event('beforeinstallprompt');
    Object.assign(fakePromptEvent, {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    });

    act(() => {
      window.dispatchEvent(fakePromptEvent);
    });

    expect(result.current.puedeInstalar).toBe(true);
  });

  it('debe ejecutar el prompt e instalar exitosamente al llamar a instalarPWA()', async () => {
    const { result } = renderHook(() => usePWAInstall());

    const mockPrompt = vi.fn().mockResolvedValue(undefined);
    const fakePromptEvent = new Event('beforeinstallprompt');
    Object.assign(fakePromptEvent, {
      prompt: mockPrompt,
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    });

    act(() => {
      window.dispatchEvent(fakePromptEvent);
    });

    let exito = false;
    await act(async () => {
      exito = await result.current.instalarPWA();
    });

    expect(mockPrompt).toHaveBeenCalled();
    expect(exito).toBe(true);
    expect(result.current.estaInstalada).toBe(true);
    expect(result.current.puedeInstalar).toBe(false);
  });
});
