'use client';

import { useEffect, useRef, useState } from 'react';
import { getSocket } from '@/lib/socket/client';
import { useAuth } from '@/context/AuthContext';

export interface MisionAsignadaSocketPayload {
  misionId: string;
  codigo: string;
  tipoMision: string;
  patrullaId?: string | null;
  cuadrillaId?: string | null;
  incidenteId?: string | null;
  asignadoEn: string;
}

export interface UseMisionesSocketOptions {
  onNuevaMision?: (mision: MisionAsignadaSocketPayload) => void;
  onMisionActualizada?: (payload?: unknown) => void;
  habilitado?: boolean;
  intervaloPollingMs?: number;
  vibrarAlAsignar?: boolean;
}

export function useMisionesSocket({
  onNuevaMision,
  onMisionActualizada,
  habilitado = true,
  intervaloPollingMs = 30000,
  vibrarAlAsignar = true,
}: UseMisionesSocketOptions = {}) {
  const { usuario, esPatrulla, esCuadrilla } = useAuth();
  const [conectado, setConectado] = useState<boolean>(false);
  const [ultimaMisionAsignada, setUltimaMisionAsignada] =
    useState<MisionAsignadaSocketPayload | null>(null);

  const callbacksRef = useRef({ onNuevaMision, onMisionActualizada });
  useEffect(() => {
    callbacksRef.current = { onNuevaMision, onMisionActualizada };
  }, [onNuevaMision, onMisionActualizada]);

  const unidadId = usuario?.unidadId;
  const unidadTipo = esPatrulla ? 'patrulla' : esCuadrilla ? 'cuadrilla' : null;
  const roomName = unidadId && unidadTipo ? `${unidadTipo}:${unidadId}` : null;

  useEffect(() => {
    if (!habilitado || typeof window === 'undefined') return;

    const socket = getSocket();

    function unirseASala() {
      if (roomName) {
        socket.emit('join', roomName);
      }
    }

    function handleConnect() {
      setConectado(true);
      unirseASala();
    }

    function handleDisconnect() {
      setConectado(false);
    }

    function handleMisionAsignada(payload: MisionAsignadaSocketPayload) {
      if (unidadTipo === 'patrulla' && payload.patrullaId && payload.patrullaId !== unidadId) {
        return;
      }
      if (unidadTipo === 'cuadrilla' && payload.cuadrillaId && payload.cuadrillaId !== unidadId) {
        return;
      }

      setUltimaMisionAsignada(payload);

      // Vibración háptica institucional (H35)
      if (vibrarAlAsignar && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([200, 100, 200]);
        } catch {
          // Silencioso en navegadores sin soporte de vibración
        }
      }

      callbacksRef.current.onNuevaMision?.(payload);
      callbacksRef.current.onMisionActualizada?.(payload);

      window.dispatchEvent(
        new CustomEvent('sgrai:mision_asignada', { detail: payload })
      );
    }

    function handleMisionActualizada(payload?: unknown) {
      callbacksRef.current.onMisionActualizada?.(payload);
      window.dispatchEvent(
        new CustomEvent('sgrai:mision_actualizada', { detail: payload })
      );
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('mision:asignada', handleMisionAsignada);
    socket.on('mision:actualizada', handleMisionActualizada);
    socket.on('mision:rechazada', handleMisionActualizada);

    if (socket.connected) {
      setConectado(true);
      unirseASala();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('mision:asignada', handleMisionAsignada);
      socket.off('mision:actualizada', handleMisionActualizada);
      socket.off('mision:rechazada', handleMisionActualizada);
      if (roomName) {
        socket.emit('leave', roomName);
      }
    };
  }, [habilitado, roomName, unidadId, unidadTipo, vibrarAlAsignar]);

  // Capa 2: Refresco al reanudar primer plano / foco
  useEffect(() => {
    if (!habilitado || typeof window === 'undefined') return;

    let ultimoRefresco = Date.now();

    function verificarFoco() {
      if (document.visibilityState === 'visible') {
        const ahora = Date.now();
        if (ahora - ultimoRefresco > 15000) {
          ultimoRefresco = ahora;
          callbacksRef.current.onMisionActualizada?.({ motivo: 'visibility_change' });
        }
      }
    }

    document.addEventListener('visibilitychange', verificarFoco);
    window.addEventListener('focus', verificarFoco);

    return () => {
      document.removeEventListener('visibilitychange', verificarFoco);
      window.removeEventListener('focus', verificarFoco);
    };
  }, [habilitado]);

  // Capa 3: Polling de respaldo
  useEffect(() => {
    if (!habilitado || intervaloPollingMs <= 0 || typeof window === 'undefined') return;

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        callbacksRef.current.onMisionActualizada?.({ motivo: 'polling' });
      }
    }, intervaloPollingMs);

    return () => clearInterval(timer);
  }, [habilitado, intervaloPollingMs]);

  return {
    conectado,
    ultimaMisionAsignada,
    descartarUltimaMision: () => setUltimaMisionAsignada(null),
  };
}

