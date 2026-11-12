import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;

/**
 * Resuelve la URL base para la conexión Socket.io según las variables de entorno o la ventana activa.
 */
export function getSocketUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SOCKET_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '')
  );
}

/**
 * Obtiene la instancia activa del socket de terreno si existe.
 */
export function obtenerSocketTerreno(): Socket | null {
  return socketInstance;
}

/**
 * Permite registrar o limpiar la instancia activa del socket (útil en hooks y pruebas).
 */
export function establecerSocketTerreno(socket: Socket | null): void {
  socketInstance = socket;
}

/**
 * Inicializa o reutiliza la conexión Socket.io para personal de terreno inyectando el token JWT.
 */
export function conectarSocketTerreno(token: string): Socket {
  if (socketInstance) {
    const authObj = socketInstance.auth as { token?: string } | undefined;
    if (authObj?.token === token && socketInstance.connected) {
      return socketInstance;
    }
    socketInstance.disconnect();
    socketInstance = null;
  }

  const socket: Socket = io(getSocketUrl(), {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    auth: { token },
    autoConnect: true,
  });

  socketInstance = socket;
  return socket;
}

/**
 * Desconecta el socket activo y limpia la referencia global.
 */
export function desconectarSocketTerreno(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

