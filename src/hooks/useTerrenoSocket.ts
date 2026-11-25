'use client';

import { useEffect, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { useAuth } from '@/context/AuthContext';
import {
  conectarSocketTerreno,
  desconectarSocketTerreno,
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
        desconectarSocketTerreno(socketRef.current);
        socketRef.current = null;
      }
      return;
    }

    const roomName = esCuadrilla
      ? `cuadrilla:${usuario.unidadId}`
      : `patrulla:${usuario.unidadId}`;

    const socket: Socket = conectarSocketTerreno(token);
    socketRef.current = socket;

    const suscribirSalas = () => {
      socket.emit('join', roomName);
      socket.emit('unirse', roomName);
    };

    socket.on('connect', suscribirSalas);
    if (socket.connected) {
      suscribirSalas();
    }

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
      socket.off('connect', suscribirSalas);
      socket.off('patrulla:desactivada', manejarDesactivacion);
      socket.off('cuadrilla:desactivada', manejarDesactivacion);
      socket.emit('leave', roomName);
      socket.emit('salir', roomName);
      desconectarSocketTerreno(socket);
      socketRef.current = null;
    };
  }, [token, usuario?.unidadId, esCuadrilla, recargarSesion]);
}
