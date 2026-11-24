import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMisionesSocket } from '../useMisionesSocket';
import * as authContext from '@/context/AuthContext';
import * as socketClient from '@/lib/socket/socketClient';

describe('useMisionesSocket (H35 — Tiempo Real y Refresco Automático de Misiones)', () => {
  type ListenerFn = (payload?: unknown) => void;
  let eventListeners: Record<string, ListenerFn[]> = {};

  const mockSocket = {
    connected: false,
    emit: vi.fn(),
    on: vi.fn((event: string, callback: ListenerFn) => {
      if (!eventListeners[event]) {
        eventListeners[event] = [];
      }
      eventListeners[event].push(callback);
      return mockSocket;
    }),
    off: vi.fn((event: string, callback: ListenerFn) => {
      if (eventListeners[event]) {
        eventListeners[event] = eventListeners[event].filter((cb) => cb !== callback);
      }
      return mockSocket;
    }),
    disconnect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    eventListeners = {};
    mockSocket.connected = false;

    vi.spyOn(socketClient, 'conectarSocket').mockReturnValue(
      mockSocket as unknown as ReturnType<typeof socketClient.conectarSocket>
    );
    vi.spyOn(socketClient, 'unirseASalaPatrulla').mockImplementation(() => {});
    vi.spyOn(socketClient, 'unirseASalaCuadrilla').mockImplementation(() => {});

    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      usuario: {
        id: 'user-pat-1',
        rut: '12.345.678-9',
        nombre: 'Patrullero Valdivia',
        email: 'patrulla@valdivia.cl',
        rolId: 'rol-1',
        rolNombre: 'Patrulla Verificadora',
        rolCodigo: 'PATRULLA_VERIFICADORA',
        delegacionId: 'del-1',
        delegacionNombre: 'Costera',
        permisos: [],
        unidadId: 'pat-100',
        unidadNombre: 'Patrulla Móvil Alfa 01',
        unidadActiva: true,
      },
      token: 'mock-jwt',
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('se suscribe a la sala correspondiente de la patrulla al conectar', () => {
    renderHook(() => useMisionesSocket());

    expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('mision:asignada', expect.any(Function));

    // Simular evento 'connect'
    const connectHandler = eventListeners['connect']?.[0];
    expect(connectHandler).toBeDefined();

    act(() => {
      connectHandler?.();
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('join', 'patrulla:pat-100');
  });

  it('ejecuta callbacks onNuevaMision y onMisionActualizada cuando se emite mision:asignada sin duplicar vibración', () => {
    const onNuevaMision = vi.fn();
    const onMisionActualizada = vi.fn();

    renderHook(() =>
      useMisionesSocket({ onNuevaMision, onMisionActualizada })
    );

    const misionAsignadaHandler = eventListeners['mision:asignada']?.[0];
    expect(misionAsignadaHandler).toBeDefined();

    const payload = {
      misionId: 'mis-555',
      codigo: 'INC-2026-999',
      tipoMision: 'VERIFICACION',
      tipoUnidad: 'PATRULLA',
      patrullaId: 'pat-100',
      asignadoEn: '2026-11-09T10:00:00Z',
    };

    act(() => {
      misionAsignadaHandler?.(payload);
    });

    expect(onNuevaMision).toHaveBeenCalledWith(payload);
    expect(onMisionActualizada).toHaveBeenCalledWith(payload);
  });

  it('descarta eventos mision:asignada si están dirigidos explícitamente a otra patrulla', () => {
    const onNuevaMision = vi.fn();
    const onMisionActualizada = vi.fn();

    renderHook(() => useMisionesSocket({ onNuevaMision, onMisionActualizada }));

    const misionAsignadaHandler = eventListeners['mision:asignada']?.[0];

    const payloadOtraPatrulla = {
      misionId: 'mis-777',
      codigo: 'INC-2026-123',
      tipoMision: 'VERIFICACION',
      patrullaId: 'pat-OTRA-999',
      asignadoEn: '2026-11-09T10:00:00Z',
    };

    act(() => {
      misionAsignadaHandler?.(payloadOtraPatrulla);
    });

    expect(onNuevaMision).not.toHaveBeenCalled();
    expect(onMisionActualizada).not.toHaveBeenCalled();
  });

  it('se suscribe a la sala de cuadrilla para DELEGADO_CUADRILLA y propaga mision:asignada', () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      usuario: {
        id: 'user-cuad-1',
        rut: '15.222.333-4',
        nombre: 'Delegado Cuadrilla 1',
        email: 'cuadrilla@valdivia.cl',
        rolId: 'rol-cuad',
        rolNombre: 'Delegado de Cuadrilla',
        rolCodigo: 'DELEGADO_CUADRILLA',
        delegacionId: 'del-1',
        delegacionNombre: 'Centro',
        permisos: [],
        unidadId: 'cuad-200',
        unidadNombre: 'Cuadrilla Hidráulica 1',
        unidadActiva: true,
      },
      token: 'mock-jwt-cuad',
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
      recargarSesion: vi.fn(),
    });

    const onNuevaMision = vi.fn();
    renderHook(() => useMisionesSocket({ onNuevaMision }));

    const connectHandler = eventListeners['connect']?.[0];
    act(() => {
      connectHandler?.();
    });

    expect(socketClient.unirseASalaCuadrilla).toHaveBeenCalledWith('cuad-200');
    expect(mockSocket.emit).toHaveBeenCalledWith('join', 'cuadrilla:cuad-200');

    const misionAsignadaHandler = eventListeners['mision:asignada']?.[0];
    const payloadCuadrilla = {
      misionId: 'mis-cuad-200',
      codigo: 'MIS-2026-0200',
      tipoMision: 'ATENCION_CUADRILLA',
      tipoUnidad: 'CUADRILLA' as const,
      cuadrillaId: 'cuad-200',
      patrullaId: null,
      asignadoEn: '2026-11-24T12:00:00Z',
    };

    act(() => {
      misionAsignadaHandler?.(payloadCuadrilla);
    });

    expect(onNuevaMision).toHaveBeenCalledWith(payloadCuadrilla);
  });

  it('remueve listeners al desmontar sin emitir leave sobre la sala compartida', () => {
    const { unmount } = renderHook(() => useMisionesSocket());

    unmount();

    expect(mockSocket.off).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('mision:asignada', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('mision:actualizada', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('mision:rechazada', expect.any(Function));
    expect(mockSocket.emit).not.toHaveBeenCalledWith('leave', expect.any(String));
  });
});

