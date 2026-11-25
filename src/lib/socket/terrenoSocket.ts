import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;
let socketToken: string | null = null;

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
export function establecerSocketTerreno(
  socket: Socket | null,
  token?: string | null
): void {
  socketInstance = socket;
  if (!socket) {
    socketToken = null;
  } else {
    const authObj = socket.auth as { token?: string } | undefined;
    socketToken = token ?? authObj?.token ?? null;
  }
}

/**
 * Inicializa o reutiliza la conexión Socket.io para personal de terreno inyectando el token JWT.
 * Conserva la instancia existente cuando coincide el token (incluso durante handshake o reconexión
 * automática en zonas de sombra) para evitar conexiones duplicadas y pérdida de suscripciones a salas.
 */
export function conectarSocketTerreno(token: string): Socket {
  if (socketInstance) {
    const authObj = socketInstance.auth as { token?: string } | undefined;
    const tokenActual = socketToken ?? authObj?.token ?? null;
    if (tokenActual === token) {
      return socketInstance;
    }
    socketInstance.disconnect();
    socketInstance = null;
    socketToken = null;
  }

  const socket: Socket = io(getSocketUrl(), {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    auth: { token },
    autoConnect: true,
  });

  socketInstance = socket;
  socketToken = token;
  return socket;
}

/**
 * Desconecta el socket activo y limpia la referencia global.
 * Si se indica `targetSocket`, solo limpia la referencia si corresponde a la instancia activa.
 */
export function desconectarSocketTerreno(targetSocket?: Socket | null): void {
  if (targetSocket && socketInstance && socketInstance !== targetSocket) {
    targetSocket.disconnect();
    return;
  }
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
    socketToken = null;
  }
}
