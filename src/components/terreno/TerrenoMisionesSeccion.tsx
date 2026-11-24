'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, CheckCircle, Clock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { sincronizarMisiones } from '@/services/misionesService';
import { EstadoBadge } from '@/components/misiones/EstadoBadge';
import { Chip } from '@/components/ui/Chip';
import { obtenerVarianteChipPrioridad } from '@/lib/utils/chipVariants';
import {
  formatearPrioridad,
  formatearFechaHora24h,
  ordenarMisionesPorPrioridadYFecha,
} from '@/lib/utils/formatters';
import type { MisionLocal } from '@/types/offline';
import styles from './TerrenoMisionesSeccion.module.css';

export type VarianteSeccionMisiones = 'pendientes' | 'en_curso';

export interface TerrenoMisionesSeccionProps {
  variante: VarianteSeccionMisiones;
}

const ESTADOS_PENDIENTES = new Set(['ASIGNADA', 'DESPACHADA', 'PENDIENTE']);
const ESTADOS_EN_CURSO = new Set(['EN_CURSO', 'EN_TERRENO', 'EN_RUTA']);

/**
 * Sección estandarizada del Inicio de Terreno (`/terreno`) que garantiza geometría,
 * cabecera, estado vacío y tarjetas de tamaño idéntico para despachos pendientes
 * y misiones en atención.
 */
export function TerrenoMisionesSeccion({ variante }: TerrenoMisionesSeccionProps) {
  const { usuario, esCuadrilla, unidadActiva, tieneUnidadAsignada, estadoAsignacion } =
    useAuth();
  const [misiones, setMisiones] = useState<MisionLocal[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);

  const esPendientes = variante === 'pendientes';
  const titulo = esPendientes ? 'Misiones pendientes' : 'Misiones en atención';

  useEffect(() => {
    let cancelado = false;

    async function buscarMisiones() {
      try {
        if (!tieneUnidadAsignada || !usuario?.unidadId) {
          if (!cancelado) {
            setMisiones([]);
          }
          return;
        }

        const remotas = await sincronizarMisiones({
          tipoMision: esCuadrilla ? 'ATENCION_CUADRILLA' : 'VERIFICACION',
          patrullaId: !esCuadrilla ? usuario.unidadId : undefined,
          cuadrillaId: esCuadrilla ? usuario.unidadId : undefined,
        });
        if (cancelado) return;

        const estadosObjetivo = esPendientes ? ESTADOS_PENDIENTES : ESTADOS_EN_CURSO;
        const filtradas = remotas.filter((m) =>
          estadosObjetivo.has((m.estado || '').toUpperCase())
        );

        setMisiones(ordenarMisionesPorPrioridadYFecha(filtradas));
      } catch {
        // Mantener estado previo si falla lectura
      } finally {
        if (!cancelado) {
          setCargando(false);
        }
      }
    }

    void buscarMisiones();

    const handleActualizar = () => {
      void buscarMisiones();
    };
    const handleVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void buscarMisiones();
      }
    };

    window.addEventListener('sgrai:mision_asignada', handleActualizar);
    window.addEventListener('sgrai:mision_actualizada', handleActualizar);
    window.addEventListener('sgrai:mision-sincronizada', handleActualizar);
    window.addEventListener('sgrai:mision-rechazada', handleActualizar);
    window.addEventListener('sgrai:outbox-synced', handleActualizar);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      cancelado = true;
      window.removeEventListener('sgrai:mision_asignada', handleActualizar);
      window.removeEventListener('sgrai:mision_actualizada', handleActualizar);
      window.removeEventListener('sgrai:mision-sincronizada', handleActualizar);
      window.removeEventListener('sgrai:mision-rechazada', handleActualizar);
      window.removeEventListener('sgrai:outbox-synced', handleActualizar);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, [esCuadrilla, esPendientes, tieneUnidadAsignada, usuario?.unidadId]);

  const emptyClass = `${styles.emptyCard} ${
    esPendientes ? styles.emptyCardPendientes : styles.emptyCardEnCurso
  }`;

  if (cargando) {
    return (
      <div className={styles.sectionWrapper} data-testid={`seccion-misiones-${variante}`}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>{titulo}</span>
        </div>
        <div className={emptyClass}>
          <span>
            {esPendientes
              ? 'Buscando despachos pendientes...'
              : 'Buscando misiones activas...'}
          </span>
        </div>
      </div>
    );
  }

  if (misiones.length === 0) {
    const mensajeVacio = esPendientes
      ? !unidadActiva
        ? 'Unidad inactiva en modo de solo lectura.'
        : 'Sin despachos pendientes por confirmar.'
      : !tieneUnidadAsignada || estadoAsignacion === 'SIN_ASIGNACION'
        ? 'Sin asignación operativa. Comunícate con el Centro de Mando.'
        : estadoAsignacion === 'DESACTIVADA'
          ? 'Unidad inactiva en modo de solo lectura.'
          : 'Sin misiones en curso actualmente.';

    return (
      <div className={styles.sectionWrapper} data-testid={`seccion-misiones-${variante}`}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>{titulo}</span>
        </div>
        <div className={emptyClass}>
          <CheckCircle
            size={18}
            className={styles.emptyIcon}
            color="var(--color-success, #2E7D32)"
            aria-hidden="true"
          />
          <span>{mensajeVacio}</span>
        </div>
      </div>
    );
  }

  const rutaBase = esCuadrilla ? '/cuadrilla/misiones' : '/patrulla/misiones';
  const badgeTexto = esPendientes
    ? misiones.length === 1
      ? '1 por confirmar'
      : `${misiones.length} por confirmar`
    : misiones.length === 1
      ? '1 en curso'
      : `${misiones.length} en curso`;

  return (
    <div className={styles.sectionWrapper} data-testid={`seccion-misiones-${variante}`}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>{titulo}</span>
        <span className={styles.badgeCount}>{badgeTexto}</span>
      </div>

      <div className={styles.misionesList}>
        {misiones.map((mision) => {
          const codigoMision =
            typeof mision.datosAdicionales?.codigoMision === 'string' &&
            mision.datosAdicionales.codigoMision !== mision.codigoIncidente
              ? mision.datosAdicionales.codigoMision
              : null;

          return (
            <Link
              key={mision.id}
              href={`${rutaBase}/${mision.id}`}
              className={`${styles.missionCard} ${
                esPendientes ? styles.missionCardPendientes : styles.missionCardEnCurso
              }`}
              title={
                esPendientes
                  ? `Ver despacho pendiente ${mision.codigoIncidente}`
                  : `Ver detalle de misión ${mision.codigoIncidente}`
              }
            >
              <div className={styles.cardMainInfo}>
                <div className={styles.metaRow}>
                  <span className={styles.code}>{mision.codigoIncidente}</span>
                  <Chip variant={obtenerVarianteChipPrioridad(mision.prioridad)} size="sm">
                    {formatearPrioridad(mision.prioridad)}
                  </Chip>
                  {!esPendientes && <EstadoBadge estado={mision.estado} size="sm" />}
                  {codigoMision && (
                    <span className={styles.missionCodeTag}>{codigoMision}</span>
                  )}
                </div>
                <div className={styles.typology}>{mision.tipologia}</div>
                <div className={styles.timestampRow}>
                  <Clock size={12} aria-hidden="true" />
                  <span>
                    {esPendientes
                      ? `Despachada ${formatearFechaHora24h(mision.fechaDespacho || mision.actualizadoEn)}`
                      : `Actualizada ${formatearFechaHora24h(mision.actualizadoEn || mision.fechaDespacho)}`}
                  </span>
                </div>
              </div>

              <div
                className={`${styles.chevronArea} ${
                  esPendientes ? styles.chevronPendientes : styles.chevronEnCurso
                }`}
                aria-hidden="true"
              >
                <ChevronRight size={22} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default TerrenoMisionesSeccion;
