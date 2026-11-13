import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as socketIoClient from 'socket.io-client';
import { getSocket, closeSocket } from '../client';

vi.mock('socket.io-client', () => {
  const mockSocket = {
    disconnect: vi.fn(),
    on: vi.fn(),
    emit: vi.fn(),
  };
  return {
    io: vi.fn(() => mockSocket),
    Socket: vi.fn(),
  };
});

describe('Socket Client Singleton (Terreno PWA)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    closeSocket();
  });

  afterEach(() => {
    closeSocket();
  });

  it('crea una instancia única de socket.io al invocar getSocket', () => {
    const socket1 = getSocket();
    const socket2 = getSocket();

    expect(socketIoClient.io).toHaveBeenCalledTimes(1);
    expect(socket1).toBe(socket2);
  });

  it('desconecta y resetea el socket al invocar closeSocket', () => {
    const socket = getSocket();
    closeSocket();

    expect(socket.disconnect).toHaveBeenCalledTimes(1);

    // Al pedir un nuevo socket debe volver a invocar io()
    getSocket();
    expect(socketIoClient.io).toHaveBeenCalledTimes(2);
  });

  it('adjunta auth.token en la configuración de inicialización de io()', () => {
    getSocket();
    expect(socketIoClient.io).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        auth: expect.objectContaining({
          token: expect.any(String),
        }),
      })
    );
  });
});

