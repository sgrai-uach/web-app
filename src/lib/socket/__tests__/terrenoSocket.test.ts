import { describe, it, expect, vi, beforeEach } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import {
  conectarSocketTerreno,
  desconectarSocketTerreno,
  establecerSocketTerreno,
  obtenerSocketTerreno,
} from '../terrenoSocket';

vi.mock('socket.io-client', () => ({
  io: vi.fn(),
}));

interface MockSocket {
  connected: boolean;
  auth: { token: string };
  disconnect: ReturnType<typeof vi.fn>;
}

function createMockSocket(token: string, connected = false): MockSocket {
  return {
    connected,
    auth: { token },
    disconnect: vi.fn(),
  };
}

describe('terrenoSocket — Gestor compartido de Socket.io (HU-70)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    desconectarSocketTerreno();
  });

  it('crea una única instancia autenticada con JWT y la reutiliza incluso si está conectando o reconectando', () => {
    const mockSocket = createMockSocket('jwt-patrulla-1', false);
    vi.mocked(io).mockReturnValueOnce(mockSocket as unknown as Socket);

    const primero = conectarSocketTerreno('jwt-patrulla-1');
    const segundo = conectarSocketTerreno('jwt-patrulla-1');

    expect(io).toHaveBeenCalledTimes(1);
    expect(io).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        auth: { token: 'jwt-patrulla-1' },
        autoConnect: true,
      })
    );
    expect(segundo).toBe(primero);
    expect(obtenerSocketTerreno()).toBe(primero);
    expect(mockSocket.disconnect).not.toHaveBeenCalled();
  });

  it('desconecta la instancia anterior y abre una nueva cuando cambia el token JWT', () => {
    const socket1 = createMockSocket('jwt-token-1', true);
    const socket2 = createMockSocket('jwt-token-2', true);
    vi.mocked(io)
      .mockReturnValueOnce(socket1 as unknown as Socket)
      .mockReturnValueOnce(socket2 as unknown as Socket);

    const primero = conectarSocketTerreno('jwt-token-1');
    const segundo = conectarSocketTerreno('jwt-token-2');

    expect(io).toHaveBeenCalledTimes(2);
    expect(socket1.disconnect).toHaveBeenCalledTimes(1);
    expect(segundo).not.toBe(primero);
    expect(obtenerSocketTerreno()).toBe(segundo);
  });

  it('limpia la referencia global al desconectar y evita borrar una instancia más reciente', () => {
    const socket1 = createMockSocket('jwt-a', true);
    const socket2 = createMockSocket('jwt-b', true);
    establecerSocketTerreno(socket2 as unknown as Socket, 'jwt-b');

    desconectarSocketTerreno(socket1 as unknown as Socket);

    expect(socket1.disconnect).toHaveBeenCalledTimes(1);
    expect(obtenerSocketTerreno()).toBe(socket2);

    desconectarSocketTerreno(socket2 as unknown as Socket);
    expect(socket2.disconnect).toHaveBeenCalledTimes(1);
    expect(obtenerSocketTerreno()).toBeNull();
  });
});
