import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as socketIoClient from 'socket.io-client';
import {
  getSocket,
  conectarSocket,
  desconectarSocket,
  unirseASalaPatrulla,
  salirDeSalaPatrulla,
  emitirAckNotificacionSocket,
} from '../socketClient';

const mockSocket = {
  connected: false,
  connect: vi.fn(),
  disconnect: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

describe('socketClient — Resolución de origen, autenticación y salas (BUG-INT-PWA-11)', () => {
  const originalSocketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
  const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.connected = false;
    delete process.env.NEXT_PUBLIC_SOCKET_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
    desconectarSocket();
  });

  afterEach(() => {
    desconectarSocket();
    if (originalSocketUrl !== undefined) {
      process.env.NEXT_PUBLIC_SOCKET_URL = originalSocketUrl;
    } else {
      delete process.env.NEXT_PUBLIC_SOCKET_URL;
    }
    if (originalApiUrl !== undefined) {
      process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
    } else {
      delete process.env.NEXT_PUBLIC_API_URL;
    }
  });

  it('resuelve window.location.origin en navegador cuando no se configuran variables NEXT_PUBLIC_* (sin fallback al puerto 3001)', () => {
    getSocket('jwt-token-valido');

    expect(socketIoClient.io).toHaveBeenCalledWith(
      window.location.origin,
      expect.objectContaining({
        path: '/socket.io/',
        auth: { token: 'jwt-token-valido' },
      })
    );
    expect(socketIoClient.io).not.toHaveBeenCalledWith(
      'http://localhost:3001',
      expect.anything()
    );
  });

  it('prioriza NEXT_PUBLIC_SOCKET_URL sobre NEXT_PUBLIC_API_URL y window.location.origin', () => {
    process.env.NEXT_PUBLIC_SOCKET_URL = 'https://terreno.valdivia.cl';
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:4001';

    conectarSocket('jwt-prod');

    expect(socketIoClient.io).toHaveBeenCalledWith(
      'https://terreno.valdivia.cl',
      expect.objectContaining({
        auth: { token: 'jwt-prod' },
      })
    );
    expect(mockSocket.connect).toHaveBeenCalledTimes(1);
  });

  it('emite join/unirse y leave/salir correctamente para la sala de patrulla', () => {
    mockSocket.connected = true;
    getSocket('jwt-patrulla');

    unirseASalaPatrulla('pat-99');
    expect(mockSocket.emit).toHaveBeenCalledWith('join', 'patrulla:pat-99');
    expect(mockSocket.emit).toHaveBeenCalledWith('unirse', 'patrulla:pat-99');

    salirDeSalaPatrulla('pat-99');
    expect(mockSocket.emit).toHaveBeenCalledWith('leave', 'patrulla:pat-99');
    expect(mockSocket.emit).toHaveBeenCalledWith('salir', 'patrulla:pat-99');
  });

  it('retorna error controlado en emitirAckNotificacionSocket si el socket no está conectado', async () => {
    mockSocket.connected = false;
    getSocket('jwt-patrulla');

    const res = await emitirAckNotificacionSocket('notif-1', 'RECIBIDA');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/no conectado/i);
  });
});

