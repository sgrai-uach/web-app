import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  reproducirAlertaSonora,
  dispararVibracionHaptica,
  activarAlertaSensorialMision,
  PATRON_VIBRACION_MISION,
} from '../alertaSonora';

describe('alertaSonora — Señalética Auditiva y Háptica (HU-35 CP-H35-PWA-03)', () => {
  const originalAudioContext = window.AudioContext;
  const originalVibrate = navigator.vibrate;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    window.AudioContext = originalAudioContext;
    Object.defineProperty(navigator, 'vibrate', {
      value: originalVibrate,
      configurable: true,
      writable: true,
    });
  });

  it('PATRON_VIBRACION_MISION contiene la secuencia [300, 150, 300, 150, 450]', () => {
    expect(PATRON_VIBRACION_MISION).toEqual([300, 150, 300, 150, 450]);
  });

  // CP-H35-PWA-03: Alerta Sonora
  it('CP-H35-PWA-03: invoca Web Audio API para reproducir el bitono de emergencia', () => {
    const mockSetValueAtTime = vi.fn();
    const mockExponentialRampToValueAtTime = vi.fn();
    const mockStart = vi.fn();
    const mockStop = vi.fn();
    const mockConnect = vi.fn();
    const mockClose = vi.fn().mockResolvedValue(undefined);
    const mockResume = vi.fn().mockResolvedValue(undefined);

    const mockOscillator = {
      type: 'sine',
      frequency: {
        setValueAtTime: mockSetValueAtTime,
      },
      connect: mockConnect,
      start: mockStart,
      stop: mockStop,
    };

    const mockGain = {
      gain: {
        setValueAtTime: mockSetValueAtTime,
        exponentialRampToValueAtTime: mockExponentialRampToValueAtTime,
      },
      connect: mockConnect,
    };

    const MockAudioContext = vi.fn().mockImplementation(() => ({
      currentTime: 0,
      state: 'running',
      destination: {},
      createOscillator: vi.fn().mockReturnValue(mockOscillator),
      createGain: vi.fn().mockReturnValue(mockGain),
      resume: mockResume,
      close: mockClose,
    }));

    window.AudioContext = MockAudioContext as unknown as typeof AudioContext;

    const emitido = reproducirAlertaSonora();
    expect(emitido).toBe(true);
    expect(MockAudioContext).toHaveBeenCalled();
    expect(mockSetValueAtTime).toHaveBeenCalledWith(880, 0);
    expect(mockStart).toHaveBeenCalled();
    expect(mockStop).toHaveBeenCalled();
  });

  // CP-H35-PWA-03: Vibración Háptica
  it('CP-H35-PWA-03: dispara el patrón de vibración en navigator.vibrate si está disponible', () => {
    const vibrateMock = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrateMock,
      configurable: true,
      writable: true,
    });

    const resultado = dispararVibracionHaptica();
    expect(resultado).toBe(true);
    expect(vibrateMock).toHaveBeenCalledWith([300, 150, 300, 150, 450]);
  });

  it('no arroja error si el navegador no tiene soporte de navigator.vibrate', () => {
    Object.defineProperty(navigator, 'vibrate', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const resultado = dispararVibracionHaptica();
    expect(resultado).toBe(false);
  });

  it('activarAlertaSensorialMision ejecuta conjuntamente audio y vibración', () => {
    const vibrateMock = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrateMock,
      configurable: true,
      writable: true,
    });

    const resultado = activarAlertaSensorialMision();
    expect(resultado.vibracionDisparada).toBe(true);
  });
});
