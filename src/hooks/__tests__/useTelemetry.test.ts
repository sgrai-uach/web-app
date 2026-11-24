import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTelemetry } from '../useTelemetry';
import * as AuthContextModule from '@/context/AuthContext';

vi.mock('@/context/AuthContext');

interface MockSocket {
  connected: boolean;
  emit: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  triggerConnect: () => void;
}

const createMockSocket = (connected = true): MockSocket => {
  const eventHandlers: Record<string, ((...args: unknown[]) => void)[]> = {};
  return {
    connected,
    emit: vi.fn(),
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      if (!eventHandlers[event]) eventHandlers[event] = [];
      eventHandlers[event].push(cb);
    }),
    off: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      if (eventHandlers[event]) {
        eventHandlers[event] = eventHandlers[event].filter((fn) => fn !== cb);
      }
    }),
    triggerConnect: () => {
      (eventHandlers['connect'] ?? []).forEach((fn) => fn());
    },
  };
};

describe('useTelemetry Hook (HU-70)', () => {
  let mockSocket: MockSocket;
  let mockGetCurrentPosition: ReturnType<typeof vi.fn>;
  let originalGeolocation: Geolocation | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket = createMockSocket(true);

    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      token: 'jwt-test-token',
      usuario: {
        id: 'user-1',
        rut: '12.345.678-5',
        nombre: 'Patrullero',
        email: 'patrulla@valdivia.cl',
        rolId: 'rol-1',
        rolNombre: 'Patrulla Verificadora',
        rolCodigo: 'PATRULLA_VERIFICADORA',
        delegacionId: null,
        delegacionNombre: null,
        permisos: [],
        unidadId: 'pat-1',
        unidadNombre: 'Patrulla-1',
        unidadActiva: true,
      },
      cargando: false,
      autenticado: true,
      esPatrulla: true,
      esCuadrilla: false,
      unidadActiva: true,
      tieneUnidadAsignada: true,
      estadoAsignacion: 'ACTIVA',
      tienePermiso: vi.fn().mockReturnValue(true),
      tieneAlgunPermiso: vi.fn().mockReturnValue(true),
      login: vi.fn(),
      logout: vi.fn(),
      recargarSesion: vi.fn(),
    });

    mockGetCurrentPosition = vi.fn((success) => {
      success({
        coords: {
          latitude: -39.8142,
          longitude: -73.2459,
          heading: 180,
          accuracy: 5.5,
          speed: 12.3,
          altitude: null,
          altitudeAccuracy: null,
        },
        timestamp: Date.now(),
      });
    });

    originalGeolocation = navigator.geolocation;
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: mockGetCurrentPosition,
        watchPosition: vi.fn(),
        clearWatch: vi.fn(),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalGeolocation) {
      Object.defineProperty(navigator, 'geolocation', {
        value: originalGeolocation,
        writable: true,
        configurable: true,
      });
    }
  });

  it('permanece en estado INACTIVO cuando la misión no está activa (activa: false)', () => {
    const { result } = renderHook(() =>
      useTelemetry({
        unidadId: 'pat-001',
        tipoUnidad: 'PATRULLA',
        activa: false,
        socket: mockSocket as unknown as import('socket.io-client').Socket,
      })
    );

    expect(result.current.estado).toBe('INACTIVO');
    expect(result.current.transmitiendo).toBe(false);
    expect(result.current.ultimaPosicion).toBeNull();
    expect(mockGetCurrentPosition).not.toHaveBeenCalled();
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });

  it('no inicia captura si falta unidadId o tipoUnidad aunque activa sea true', () => {
    const { result } = renderHook(() =>
      useTelemetry({
        unidadId: null,
        tipoUnidad: 'PATRULLA',
        activa: true,
        socket: mockSocket as unknown as import('socket.io-client').Socket,
      })
    );

    expect(result.current.estado).toBe('INACTIVO');
    expect(mockGetCurrentPosition).not.toHaveBeenCalled();
  });

  it('inicia captura y transmite coordenadas cuando la misión pasa a activa (activa: true)', () => {
    const { result } = renderHook(() =>
      useTelemetry({
        unidadId: 'pat-100',
        tipoUnidad: 'PATRULLA',
        activa: true,
        socket: mockSocket as unknown as import('socket.io-client').Socket,
      })
    );

    expect(mockGetCurrentPosition).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );

    expect(result.current.estado).toBe('TRANSMITIENDO');
    expect(result.current.transmitiendo).toBe(true);
    expect(result.current.ultimaPosicion).toEqual(
      expect.objectContaining({
        unidadId: 'pat-100',
        tipoUnidad: 'PATRULLA',
        lat: -39.8142,
        lng: -73.2459,
        rumbo: 180,
        precision: 5.5,
        velocidad: 12.3,
      })
    );

    expect(mockSocket.emit).toHaveBeenCalledWith(
      'telemetria:posicion',
      expect.objectContaining({
        unidadId: 'pat-100',
        tipoUnidad: 'PATRULLA',
        lat: -39.8142,
        lng: -73.2459,
      })
    );
  });

  it('emite periódicamente según el intervalo configurado', () => {
    vi.useFakeTimers();

    renderHook(() =>
      useTelemetry({
        unidadId: 'cuad-200',
        tipoUnidad: 'CUADRILLA',
        activa: true,
        intervaloMs: 30000,
        socket: mockSocket as unknown as import('socket.io-client').Socket,
      })
    );

    expect(mockGetCurrentPosition).toHaveBeenCalledTimes(1);
    expect(mockSocket.emit).toHaveBeenCalledTimes(1);

    // Avanzar 30 segundos
    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(mockGetCurrentPosition).toHaveBeenCalledTimes(2);
    expect(mockSocket.emit).toHaveBeenCalledTimes(2);

    // Avanzar otros 30 segundos
    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(mockGetCurrentPosition).toHaveBeenCalledTimes(3);
    expect(mockSocket.emit).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });

  it('detiene la transmisión y limpia el temporizador al desactivarse la misión', () => {
    vi.useFakeTimers();

    let activa = true;
    const { rerender, result } = renderHook(() =>
      useTelemetry({
        unidadId: 'pat-100',
        tipoUnidad: 'PATRULLA',
        activa,
        intervaloMs: 30000,
        socket: mockSocket as unknown as import('socket.io-client').Socket,
      })
    );

    expect(result.current.estado).toBe('TRANSMITIENDO');

    // Desactivar misión (ej. finalizada, rechazada o cancelada)
    activa = false;
    rerender();

    expect(result.current.estado).toBe('INACTIVO');
    expect(result.current.transmitiendo).toBe(false);

    // Avanzar tiempo y verificar que no emite más
    const countBefore = mockGetCurrentPosition.mock.calls.length;
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(mockGetCurrentPosition.mock.calls.length).toBe(countBefore);

    vi.useRealTimers();
  });

  it('cambia a estado SIN_PERMISO ante rechazo de geolocalización (PERMISSION_DENIED) de forma no bloqueante', () => {
    mockGetCurrentPosition.mockImplementation((_, error) => {
      error({
        code: 1, // PERMISSION_DENIED
        message: 'User denied Geolocation',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      });
    });

    const { result } = renderHook(() =>
      useTelemetry({
        unidadId: 'pat-100',
        tipoUnidad: 'PATRULLA',
        activa: true,
        socket: mockSocket as unknown as import('socket.io-client').Socket,
      })
    );

    expect(result.current.estado).toBe('SIN_PERMISO');
    expect(result.current.transmitiendo).toBe(false);
    expect(result.current.error).toContain('denegado');
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });

  it('cambia a estado ERROR_GPS ante falla satelital (POSITION_UNAVAILABLE / TIMEOUT)', () => {
    mockGetCurrentPosition.mockImplementation((_, error) => {
      error({
        code: 2, // POSITION_UNAVAILABLE
        message: 'Position unavailable',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      });
    });

    const { result } = renderHook(() =>
      useTelemetry({
        unidadId: 'pat-100',
        tipoUnidad: 'PATRULLA',
        activa: true,
        socket: mockSocket as unknown as import('socket.io-client').Socket,
      })
    );

    expect(result.current.estado).toBe('ERROR_GPS');
    expect(result.current.transmitiendo).toBe(false);
    expect(result.current.error).toBe('Position unavailable');
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });

  it('tolera socket desconectado sin arrojar errores y retransmite al reconectarse', () => {
    // Socket inicialmente desconectado
    const disconnectedSocket = createMockSocket(false);

    const { result } = renderHook(() =>
      useTelemetry({
        unidadId: 'pat-100',
        tipoUnidad: 'PATRULLA',
        activa: true,
        socket: disconnectedSocket as unknown as import('socket.io-client').Socket,
      })
    );

    // Coordenadas se capturan correctamente aunque no se emitan por estar offline
    expect(result.current.estado).toBe('TRANSMITIENDO');
    expect(result.current.ultimaPosicion).not.toBeNull();
    expect(disconnectedSocket.emit).not.toHaveBeenCalled();

    // Reconectar socket (ej: recupera señal 4G)
    act(() => {
      disconnectedSocket.connected = true;
      disconnectedSocket.triggerConnect();
    });

    // Debe retransmitir la última posición capturada inmediatamente
    expect(disconnectedSocket.emit).toHaveBeenCalledWith(
      'telemetria:posicion',
      expect.objectContaining({
        unidadId: 'pat-100',
        tipoUnidad: 'PATRULLA',
      })
    );
  });

  it('soporta reintento manual mediante la función reintentar()', () => {
    const { result } = renderHook(() =>
      useTelemetry({
        unidadId: 'pat-100',
        tipoUnidad: 'PATRULLA',
        activa: true,
        socket: mockSocket as unknown as import('socket.io-client').Socket,
      })
    );

    expect(mockGetCurrentPosition).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.reintentar();
    });

    expect(mockGetCurrentPosition).toHaveBeenCalledTimes(2);
  });
});
