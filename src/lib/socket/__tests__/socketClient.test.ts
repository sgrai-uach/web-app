import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as socketIoClient from 'socket.io-client';
import { getSocket, conectarSocket, desconectarSocket } from '../socketClient';

const mockSocket = {
  connected: false,
  auth: {} as Record<string, unknown>,
  connect: vi.fn(),
  disconnect: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
  Socket: vi.fn(),
}));

describe('socketClient Singleton Unificado (Terreno PWA)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.connected = false;
    mockSocket.auth = {};
    desconectarSocket();
  });

  afterEach(() => {
    desconectarSocket();
  });

  it('crea una instancia única de socket.io al invocar getSocket', () => {
    const socket1 = getSocket('token-inicial');
    const socket2 = getSocket('token-inicial');

    expect(socketIoClient.io).toHaveBeenCalledTimes(1);
    expect(socket1).toBe(socket2);
  });

  it('actualiza auth.token y reconecta si el JWT cambia en una sesión activa', () => {
    mockSocket.connected = true;
    mockSocket.auth = { token: 'token-viejo' };

    conectarSocket('token-viejo');
    conectarSocket('token-nuevo');

    expect(mockSocket.auth).toEqual({ token: 'token-nuevo' });
    expect(mockSocket.disconnect).toHaveBeenCalledTimes(1);
    expect(mockSocket.connect).toHaveBeenCalledTimes(1);
  });

  it('desconecta y resetea el singleton al invocar desconectarSocket', () => {
    getSocket('token-1');
    desconectarSocket();

    expect(mockSocket.disconnect).toHaveBeenCalledTimes(1);

    getSocket('token-2');
    expect(socketIoClient.io).toHaveBeenCalledTimes(2);
  });
});
