import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as socketIoClient from 'socket.io-client';
import {
  getSocket,
  conectarSocket,
  desconectarSocket,
  resolverUrlSocketTerreno,
} from '../socketClient';

const mockSocket = {
  connected: false,
  active: false,
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
    mockSocket.active = false;
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

  it('usa window.location.origin cuando no existen variables de entorno explícitas de socket/API', () => {
    const prevSocketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
    const prevApiUrl = process.env.NEXT_PUBLIC_API_URL;
    delete process.env.NEXT_PUBLIC_SOCKET_URL;
    delete process.env.NEXT_PUBLIC_API_URL;

    try {
      getSocket('token-origin');
      expect(socketIoClient.io).toHaveBeenCalledWith(
        window.location.origin,
        expect.any(Object)
      );
    } finally {
      if (prevSocketUrl !== undefined) {
        process.env.NEXT_PUBLIC_SOCKET_URL = prevSocketUrl;
      }
      if (prevApiUrl !== undefined) {
        process.env.NEXT_PUBLIC_API_URL = prevApiUrl;
      }
    }
  });

  it('reemplaza localhost por hostname LAN actual cuando se accede desde otro host y reconecta si cambia token en socket activo', () => {
    const prevSocketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
    const prevLocation = window.location;
    process.env.NEXT_PUBLIC_SOCKET_URL = 'http://localhost:4001';

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...prevLocation,
        hostname: '192.168.1.50',
        origin: 'http://192.168.1.50:3002',
      },
    });

    try {
      expect(resolverUrlSocketTerreno()).toBe('http://192.168.1.50:4001');
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: prevLocation,
      });
      if (prevSocketUrl !== undefined) {
        process.env.NEXT_PUBLIC_SOCKET_URL = prevSocketUrl;
      } else {
        delete process.env.NEXT_PUBLIC_SOCKET_URL;
      }
    }

    mockSocket.connected = false;
    mockSocket.active = true;
    mockSocket.auth = { token: 'token-a' };

    getSocket('token-a');
    conectarSocket('token-b');

    expect(mockSocket.auth).toEqual({ token: 'token-b' });
    expect(mockSocket.disconnect).toHaveBeenCalledTimes(1);
    expect(mockSocket.connect).toHaveBeenCalledTimes(1);
  });
});
