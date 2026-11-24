import { io, type Socket } from 'socket.io-client';
import type { MisionAsignadaPayload } from '@/types/notificaciones';
import { getAuthCookie } from '@/lib/utils/cookieUtils';

let socketInstance: Socket | null = null;
let currentPatrullaId: string | null = null;
let currentCuadrillaId: string | null = null;

export function resolverUrlSocketTerreno(): string {
  if (typeof window === 'undefined') return 'http://localhost:3001';

  const configured =
    process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL;

  if (configured) {
    try {
      const parsed = new URL(configured);
      const hostConfigurado = parsed.hostname;
      const hostActual = window.location.hostname;
      if (
        (hostConfigurado === 'localhost' || hostConfigurado === '127.0.0.1') &&
        hostActual &&
        hostActual !== 'localhost' &&
        hostActual !== '127.0.0.1'
      ) {
        parsed.hostname = hostActual;
        return parsed.origin;
      }
    } catch {
      // Conservar valor configurado si no es una URL absoluta estándar
    }
    return configured;
  }

  return window.location.origin || 'http://localhost:3001';
}

function resolveSocketUrl(): string {
  return resolverUrlSocketTerreno();
}

/**
 * Obtiene o inicializa la conexión cliente de Socket.IO para terreno.
 */
export function getSocket(tokenOverride?: string): Socket {
  const token = tokenOverride || getAuthCookie() || undefined;

  if (!socketInstance) {
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
      if (currentCuadrillaId) {
        const room = `cuadrilla:${currentCuadrillaId}`;
        socketInstance?.emit('join', room);
        socketInstance?.emit('unirse', room);
      }
    });
  } else if (token) {
    const authActual = (socketInstance.auth as { token?: string } | undefined)?.token;
    if (authActual !== token) {
      socketInstance.auth = { token };
      if (socketInstance.connected || socketInstance.active) {
        socketInstance.disconnect();
        socketInstance.connect();
      }
    }
  }

  return socketInstance;
}

/**
 * Conecta el socket al servidor en tiempo real, refrescando el JWT si cambió desde la sesión anterior.
 */
export function conectarSocket(token?: string): Socket {
  const authPrevio = (socketInstance?.auth as { token?: string } | undefined)?.token;
  const reconectadoPorCambioToken = Boolean(
    socketInstance &&
      token &&
      authPrevio !== token &&
      (socketInstance.connected || socketInstance.active)
  );
  const socket = getSocket(token);
  if (!socket.connected && !reconectadoPorCambioToken) {
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
    if (currentCuadrillaId) {
      const room = `cuadrilla:${currentCuadrillaId}`;
      socketInstance.emit('leave', room);
      socketInstance.emit('salir', room);
    }
    socketInstance.disconnect();
    socketInstance = null;
  }
  currentPatrullaId = null;
  currentCuadrillaId = null;
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
 * Suscribe al cliente a la sala operativa de su cuadrilla (H40).
 */
export function unirseASalaCuadrilla(cuadrillaId: string): void {
  if (!cuadrillaId) return;
  currentCuadrillaId = cuadrillaId;
  const socket = getSocket();
  const room = `cuadrilla:${cuadrillaId}`;

  if (socket.connected) {
    socket.emit('join', room);
    socket.emit('unirse', room);
  }
}

/**
 * Abandona la sala operativa de la cuadrilla.
 */
export function salirDeSalaCuadrilla(cuadrillaId: string): void {
  if (!cuadrillaId) return;
  if (currentCuadrillaId === cuadrillaId) {
    currentCuadrillaId = null;
  }
  if (socketInstance && socketInstance.connected) {
    const room = `cuadrilla:${cuadrillaId}`;
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
): Promise<{ ok: boolean; message?: string; error?: string; data?: unknown }> {
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
      (response: { ok: boolean; message?: string; error?: string; data?: unknown }) => {
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

