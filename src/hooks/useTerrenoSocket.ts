'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/context/AuthContext';
import {
  establecerSocketTerreno,
  getSocketUrl,
} from '@/lib/socket/terrenoSocket';

/**
 * Hook para la sincronización reactiva en tiempo real vía Socket.io para personal de terreno.
 * Se suscribe a las salas operativas de la patrulla o cuadrilla asignada y refresca la sesión
 * automáticamente ante eventos de ciclo de vida (desactivación lógica de unidad H82/H85).
 */
export function useTerrenoSocket(): void {
  const { usuario, token, recargarSesion, esCuadrilla } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token || !usuario?.unidadId) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        establecerSocketTerreno(null);
      }
      return;
    }

    const socketUrl = getSocketUrl();

    const roomName = esCuadrilla
      ? `cuadrilla:${usuario.unidadId}`
      : `patrulla:${usuario.unidadId}`;

    const socket: Socket = io(socketUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token },
      autoConnect: true,
    });

    socketRef.current = socket;
    establecerSocketTerreno(socket);

    socket.on('connect', () => {
      socket.emit('join', roomName);
      socket.emit('unirse', roomName);
    });

    interface DesactivacionPayload {
      id?: string;
      patrullaId?: string;
      cuadrillaId?: string;
    }

    const manejarDesactivacion = (data?: DesactivacionPayload) => {
      const unidadPayloadId = data?.patrullaId ?? data?.cuadrillaId ?? data?.id;
      if (!unidadPayloadId || unidadPayloadId === usuario.unidadId) {
        void recargarSesion();
      }
    };

    socket.on('patrulla:desactivada', manejarDesactivacion);
    socket.on('cuadrilla:desactivada', manejarDesactivacion);

    return () => {
      socket.off('patrulla:desactivada', manejarDesactivacion);
      socket.off('cuadrilla:desactivada', manejarDesactivacion);
      socket.emit('leave', roomName);
      socket.emit('salir', roomName);
      socket.disconnect();
      socketRef.current = null;
      establecerSocketTerreno(null);
    };
  }, [token, usuario?.unidadId, esCuadrilla, recargarSesion]);
}
