'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNotificacionesTerrenoOptional } from '@/context/NotificacionesTerrenoContext';
import { confirmarLecturaMisionAbierta } from '@/services/notificacionesService';
import type { MisionLocal } from '@/types/offline';

export interface UseConfirmarLecturaMisionOptions {
  misionId?: string | null;
  mision: MisionLocal | null;
  enabled?: boolean;
}

/**
 * Emite automáticamente el acuse operativo 'LEIDA' cuando el operador de terreno
 * (patrulla verificadora o delegado de cuadrilla) abre el detalle de una misión
 * con lectura pendiente, independientemente de si accedió desde el banner flotante,
 * la bandeja de misiones o un enlace directo.
 */
export function useConfirmarLecturaMision({
  misionId,
  mision,
  enabled = true,
}: UseConfirmarLecturaMisionOptions): void {
  const { usuario, esCuadrilla } = useAuth();
  const notificacionesCtx = useNotificacionesTerrenoOptional();
  const claveConfirmadaRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !misionId || !mision || mision.id !== misionId) {
      return;
    }

    const notificacionId =
      mision.notificacionId ??
      (typeof mision.datosAdicionales?.notificacionId === 'string'
        ? mision.datosAdicionales.notificacionId
        : null);

    const clave = `${mision.id}:${notificacionId || 'buscar'}:${mision.trazabilidadNotificacion || ''}`;
    if (claveConfirmadaRef.current === clave) {
      return;
    }
    claveConfirmadaRef.current = clave;

    let cancelado = false;

    void (async () => {
      const confirmada = await confirmarLecturaMisionAbierta({
        misionId: mision.id,
        notificacionId,
        unidadId: usuario?.unidadId ?? null,
        esCuadrilla: Boolean(esCuadrilla),
        trazabilidadNotificacion: mision.trazabilidadNotificacion ?? null,
      });

      if (!cancelado && confirmada) {
        notificacionesCtx?.marcarAlertaLeidaPorMision?.(mision.id);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [enabled, esCuadrilla, mision, misionId, notificacionesCtx, usuario?.unidadId]);
}
