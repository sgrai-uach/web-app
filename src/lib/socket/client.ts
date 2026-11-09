import { io, Socket } from 'socket.io-client';

const resolveSocketUrl = (): string => {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  return 'http://localhost:4001';
};

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(resolveSocketUrl(), {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      withCredentials: true,
    });
  }
  return socket;
}

export function closeSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

