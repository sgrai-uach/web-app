import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { io } from 'socket.io-client';
import { useTerrenoSocket } from '../useTerrenoSocket';
import * as AuthContextModule from '@/context/AuthContext';

type EventHandler = (...args: unknown[]) => void;

interface MockSocketInstance {
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  trigger: (event: string, payload?: unknown) => void;
}

const handlers: Record<string, EventHandler[]> = {};

const createMockSocket = (): MockSocketInstance => {
  Object.keys(handlers).forEach((key) => {
    delete handlers[key];
  });

  return {
    on: vi.fn((event: string, cb: EventHandler) => {
      if (!handlers[event]) {
        handlers[event] = [];
      }
      handlers[event].push(cb);
    }),
    off: vi.fn((event: string, cb: EventHandler) => {
      if (handlers[event]) {
        handlers[event] = handlers[event].filter((item) => item !== cb);
      }
    }),
    emit: vi.fn(),
    disconnect: vi.fn(),
    trigger: (event: string, payload?: unknown) => {
      (handlers[event] ?? []).forEach((cb) => cb(payload));
    },
  };
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(),
}));

vi.mock('@/context/AuthContext');

describe('useTerrenoSocket hook (H85)', () => {
  let mockSocket: MockSocketInstance;
  let recargarSesionMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket = createMockSocket();
    recargarSesionMock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(io).mockReturnValue(mockSocket as unknown as ReturnType<typeof io>);
  });

  it('no abre conexión Socket.io cuando falta token o unidadId', () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      usuario: {
        id: 'u-sin-unidad',
        rut: '11.111.111-1',
        nombre: 'Operador Sin Unidad',
        email: 'operador@valdivia.cl',
        rolId: 'r-1',
        rolNombre: 'Patrulla Verificadora',
        rolCodigo: 'PATRULLA',
        delegacionId: null,
        delegacionNombre: null,
        permisos: [],
        unidadId: null,
        unidadNombre: null,
        unidadActiva: false,
      },
      token: 'jwt-valido',
      cargando: false,
      autenticado: true,
      esPatrulla: true,
      esCuadrilla: false,
      unidadActiva: false,
      tieneUnidadAsignada: false,
      estadoAsignacion: 'SIN_ASIGNACION',
      tienePermiso: vi.fn().mockReturnValue(true),
      tieneAlgunPermiso: vi.fn().mockReturnValue(true),
      login: vi.fn(),
      logout: vi.fn(),
      recargarSesion: recargarSesionMock,
    });

    renderHook(() => useTerrenoSocket());

    expect(io).not.toHaveBeenCalled();
  });

  it('suscribe a la sala de patrulla y recarga sesión ante patrulla:desactivada coincidente', () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      usuario: {
        id: 'u-pat-1',
        rut: '12.345.678-9',
        nombre: 'Inspector Terreno',
        email: 'inspector@valdivia.cl',
        rolId: 'r-1',
        rolNombre: 'Patrulla Verificadora',
        rolCodigo: 'PATRULLA',
        delegacionId: 'del-1',
        delegacionNombre: 'Centro',
        permisos: [],
        unidadId: 'pat-123',
        unidadNombre: 'Alfa-1',
        unidadActiva: true,
      },
      token: 'jwt-patrulla',
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
      recargarSesion: recargarSesionMock,
    });

    const { unmount } = renderHook(() => useTerrenoSocket());

    expect(io).toHaveBeenCalledTimes(1);

    act(() => {
      mockSocket.trigger('connect');
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('join', 'patrulla:pat-123');
    expect(mockSocket.emit).toHaveBeenCalledWith('unirse', 'patrulla:pat-123');

    act(() => {
      mockSocket.trigger('patrulla:desactivada', { patrullaId: 'pat-otra' });
    });
    expect(recargarSesionMock).not.toHaveBeenCalled();

    act(() => {
      mockSocket.trigger('patrulla:desactivada', { patrullaId: 'pat-123' });
    });
    expect(recargarSesionMock).toHaveBeenCalledTimes(1);

    unmount();
    expect(mockSocket.off).toHaveBeenCalledWith('patrulla:desactivada', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('cuadrilla:desactivada', expect.any(Function));
    expect(mockSocket.emit).toHaveBeenCalledWith('leave', 'patrulla:pat-123');
    expect(mockSocket.emit).toHaveBeenCalledWith('salir', 'patrulla:pat-123');
    expect(mockSocket.disconnect).toHaveBeenCalledTimes(1);
  });

  it('suscribe a la sala de cuadrilla y procesa cuadrilla:desactivada con cuadrillaId o id', () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      usuario: {
        id: 'u-cuad-1',
        rut: '15.111.222-3',
        nombre: 'Delegado Cuadrilla',
        email: 'delegado@valdivia.cl',
        rolId: 'r-2',
        rolNombre: 'Delegado de Cuadrilla',
        rolCodigo: 'DELEGADO_CUADRILLA',
        delegacionId: 'del-2',
        delegacionNombre: 'Las Ánimas',
        permisos: [],
        unidadId: 'cuad-99',
        unidadNombre: 'Cuadrilla Sur',
        unidadActiva: true,
      },
      token: 'jwt-cuadrilla',
      cargando: false,
      autenticado: true,
      esPatrulla: false,
      esCuadrilla: true,
      unidadActiva: true,
      tieneUnidadAsignada: true,
      estadoAsignacion: 'ACTIVA',
      tienePermiso: vi.fn().mockReturnValue(true),
      tieneAlgunPermiso: vi.fn().mockReturnValue(true),
      login: vi.fn(),
      logout: vi.fn(),
      recargarSesion: recargarSesionMock,
    });

    renderHook(() => useTerrenoSocket());

    act(() => {
      mockSocket.trigger('connect');
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('join', 'cuadrilla:cuad-99');
    expect(mockSocket.emit).toHaveBeenCalledWith('unirse', 'cuadrilla:cuad-99');

    act(() => {
      mockSocket.trigger('cuadrilla:desactivada', { cuadrillaId: 'cuad-99' });
    });
    expect(recargarSesionMock).toHaveBeenCalledTimes(1);

    act(() => {
      mockSocket.trigger('cuadrilla:desactivada', { id: 'cuad-99' });
    });
    expect(recargarSesionMock).toHaveBeenCalledTimes(2);
  });
});

