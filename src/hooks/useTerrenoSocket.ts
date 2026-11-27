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

    const manejarSincronizacionMision = (data?: unknown) => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('sgrai:mision-sincronizada', { detail: data })
        );
      }
    };

    const manejarVisibilidad = () => {
      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible'
      ) {
        manejarSincronizacionMision();
      }
    };

    const manejarMisionRechazada = (data?: {
      misionId?: string;
      cuadrillaId?: string | null;
      patrullaId?: string | null;
    }) => {
      const unidadPayloadId = esCuadrilla ? data?.cuadrillaId : data?.patrullaId;
      if (!unidadPayloadId || unidadPayloadId === usuario.unidadId) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('sgrai:mision-rechazada', { detail: data })
          );
        }
      }
    };

    socket.on('patrulla:desactivada', manejarDesactivacion);
    socket.on('cuadrilla:desactivada', manejarDesactivacion);
    socket.on('mision:actualizada', manejarSincronizacionMision);
    socket.on('incidente:actualizado', manejarSincronizacionMision);
    socket.on('patrulla:actualizada', manejarSincronizacionMision);
    socket.on('patrulla:liberada', manejarSincronizacionMision);
    socket.on('mision:asignada', manejarSincronizacionMision);
    socket.on('mision:rechazada', manejarMisionRechazada);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', manejarVisibilidad);
    }

    return () => {
      socket.off('connect', suscribirSalas);
      socket.off('patrulla:desactivada', manejarDesactivacion);
      socket.off('cuadrilla:desactivada', manejarDesactivacion);
      socket.off('mision:actualizada', manejarSincronizacionMision);
      socket.off('incidente:actualizado', manejarSincronizacionMision);
      socket.off('patrulla:actualizada', manejarSincronizacionMision);
      socket.off('patrulla:liberada', manejarSincronizacionMision);
      socket.off('mision:asignada', manejarSincronizacionMision);
      socket.off('mision:rechazada', manejarMisionRechazada);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', manejarVisibilidad);
      }
      socket.emit('leave', roomName);
      socket.emit('salir', roomName);
      desconectarSocketTerreno(socket);
      socketRef.current = null;
    };
  }, [token, usuario?.unidadId, esCuadrilla, recargarSesion]);
}
