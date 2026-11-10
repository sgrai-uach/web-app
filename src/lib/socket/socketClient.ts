import { io, type Socket } from 'socket.io-client';
import type { MisionAsignadaPayload } from '@/types/notificaciones';
import { getAuthCookie } from '@/lib/utils/cookieUtils';
import { DEV_PATRULLA_TOKEN } from '@/lib/api/client';

let socketInstance: Socket | null = null;
let currentPatrullaId: string | null = null;

function resolveSocketUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:3001';
  return (
    process.env.NEXT_PUBLIC_SOCKET_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:3001'
  );
}

/**
 * Obtiene o inicializa la conexión cliente de Socket.IO para terreno.
 */
export function getSocket(tokenOverride?: string): Socket {
  if (!socketInstance) {
    const token = tokenOverride || getAuthCookie() || DEV_PATRULLA_TOKEN;
    const socketUrl = resolveSocketUrl();

    socketInstance = io(socketUrl, {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      auth: {
        token,
      },
    });

    socketInstance.on('connect', () => {
      if (currentPatrullaId) {
        const room = `patrulla:${currentPatrullaId}`;
        socketInstance?.emit('join', room);
        socketInstance?.emit('unirse', room);
      }
    });
  }

  return socketInstance;
}

/**
 * Conecta el socket al servidor en tiempo real.
 */
export function conectarSocket(token?: string): Socket {
  const socket = getSocket(token);
  if (!socket.connected) {
    socket.connect();
  }
  return socket;
}

/**
 * Desconecta el socket y limpia el estado local.
 */
export function desconectarSocket(): void {
  if (socketInstance) {
    if (currentPatrullaId) {
      const room = `patrulla:${currentPatrullaId}`;
      socketInstance.emit('leave', room);
      socketInstance.emit('salir', room);
    }
    socketInstance.disconnect();
    socketInstance = null;
  }
  currentPatrullaId = null;
}

/**
 * Suscribe al cliente a la sala operativa de su patrulla (HU-35 §2.1).
 */
export function unirseASalaPatrulla(patrullaId: string): void {
  if (!patrullaId) return;
  currentPatrullaId = patrullaId;
  const socket = getSocket();
  const room = `patrulla:${patrullaId}`;

  if (socket.connected) {
    socket.emit('join', room);
    socket.emit('unirse', room);
  }
}

/**
 * Abandona la sala operativa de la patrulla.
 */
export function salirDeSalaPatrulla(patrullaId: string): void {
  if (!patrullaId) return;
  if (currentPatrullaId === patrullaId) {
    currentPatrullaId = null;
  }
  if (socketInstance && socketInstance.connected) {
    const room = `patrulla:${patrullaId}`;
    socketInstance.emit('leave', room);
    socketInstance.emit('salir', room);
  }
}

/**
 * Emite el acuse técnico inmediato ('RECIBIDA') o de lectura operativa ('LEIDA')
 * vía WebSocket directamente al backend (HU-35 §2.1).
 */
export function emitirAckNotificacionSocket(
  notificacionId: string,
  estado: 'RECIBIDA' | 'LEIDA'
): Promise<{ ok: boolean; message?: string; error?: string }> {
  return new Promise((resolve) => {
    const socket = getSocket();

    if (!socket.connected) {
      resolve({ ok: false, error: 'Socket no conectado' });
      return;
    }

    const timer = setTimeout(() => {
      resolve({ ok: false, error: 'Timeout al emitir acuse por WebSocket' });
    }, 4000);

    socket.emit(
      'notificacion:ack',
      { notificacionId, estado },
      (response: { ok: boolean; message?: string; error?: string }) => {
        clearTimeout(timer);
        resolve(response || { ok: true });
      }
    );
  });
}

/**
 * Registra un callback para escuchar el evento `mision:asignada`.
 * Devuelve una función para desuscribirse.
 */
export function onMisionAsignada(
  handler: (payload: MisionAsignadaPayload) => void
): () => void {
  const socket = getSocket();
  socket.on('mision:asignada', handler);
  return () => {
    socket.off('mision:asignada', handler);
  };
}

/**
 * Registra un callback para cuando el socket se conecta o reconecta.
 */
export function onSocketConnect(callback: () => void): () => void {
  const socket = getSocket();
  socket.on('connect', callback);
  return () => {
    socket.off('connect', callback);
  };
}

/**
 * Consulta el estado de conexión del socket.
 */
export function isSocketConnected(): boolean {
  return Boolean(socketInstance && socketInstance.connected);
}
