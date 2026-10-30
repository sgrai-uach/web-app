'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, CheckCircle, Clock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { sincronizarMisiones } from '@/services/misionesService';
import { EstadoBadge } from '@/components/misiones/EstadoBadge';
import {
  formatearPrioridad,
  formatearFechaHora24h,
  ordenarMisionesPorPrioridadYFecha,
} from '@/lib/utils/formatters';
import type { MisionLocal } from '@/types/offline';
import styles from './TerrenoSiguienteMision.module.css';

export function TerrenoSiguienteMision() {
  const { esCuadrilla, unidadActiva } = useAuth();
  const [misionesActivas, setMisionesActivas] = useState<MisionLocal[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);

  useEffect(() => {
    let cancelado = false;

    async function buscarMisiones() {
      try {
        const misiones = await sincronizarMisiones({
          tipoMision: esCuadrilla ? 'ATENCION_CUADRILLA' : 'VERIFICACION',
        });
        if (cancelado) return;

        // 1. Misiones actualmente activas (en curso, en terreno o en ruta)
        const enCurso = misiones.filter((m) => {
          const e = m.estado?.toUpperCase();
          return e === 'EN_CURSO' || e === 'EN_TERRENO' || e === 'EN_RUTA';
        });

        if (enCurso.length > 0) {
          setMisionesActivas(ordenarMisionesPorPrioridadYFecha(enCurso));
          return;
        }

        // 2. Si no hay en curso, tomar la misión prioritaria despachada o asignada
        const pendientes = misiones.filter((m) => {
          const e = m.estado?.toUpperCase();
          return e === 'ASIGNADA' || e === 'DESPACHADA' || e === 'PENDIENTE';
        });

        const ordenadas = ordenarMisionesPorPrioridadYFecha(pendientes);
        setMisionesActivas(ordenadas.slice(0, 1));
      } catch {
        // En caso de error, mantener neutro
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    void buscarMisiones();

    return () => {
      cancelado = true;
    };
  }, [esCuadrilla]);

  if (cargando) {
    return (
      <div className={styles.sectionWrapper}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Misiones en atención</span>
        </div>
        <div className={styles.emptyCard}>
          <span>Buscando misiones activas...</span>
        </div>
      </div>
    );
  }

  const rutaBase = esCuadrilla ? '/cuadrilla/misiones' : '/patrulla/misiones';

  if (misionesActivas.length === 0) {
    return (
      <div className={styles.sectionWrapper}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Misiones en atención</span>
        </div>
        <div className={styles.emptyCard}>
          <CheckCircle size={20} color="var(--color-success, #2E7D32)" aria-hidden="true" />
          <span>
            {!unidadActiva
              ? 'Unidad inactiva en modo de solo lectura.'
              : 'Sin misiones activas ni pendientes. La unidad se encuentra disponible.'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.sectionWrapper}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Misiones en atención</span>
      </div>

      <div className={styles.misionesList}>
        {misionesActivas.map((mision) => {
          const normPrioridad = mision.prioridad?.toUpperCase() || '';
          let prioridadClase = styles.priorityNeutro;
          if (normPrioridad === 'CRITICA') {
            prioridadClase = styles.priorityCritica;
          } else if (normPrioridad === 'ALTA') {
            prioridadClase = styles.priorityAlta;
          }

          return (
            <Link
              key={mision.id}
              href={`${rutaBase}/${mision.id}`}
              className={styles.compactCard}
              title={`Ver detalle de misión ${mision.codigoIncidente}`}
            >
              <div className={styles.cardMainInfo}>
                <div className={styles.metaRow}>
                  <span className={styles.code}>{mision.codigoIncidente}</span>
                  <span className={`${styles.priorityChip} ${prioridadClase}`}>
                    {formatearPrioridad(mision.prioridad)}
                  </span>
                  <EstadoBadge estado={mision.estado} />
                </div>
                <div className={styles.typology}>{mision.tipologia}</div>
                <div className={styles.timestampRow}>
                  <Clock size={12} aria-hidden="true" />
                  <span>
                    Actualizada {formatearFechaHora24h(mision.actualizadoEn || mision.fechaDespacho)}
                  </span>
                </div>
              </div>

              <div className={styles.chevronArea} aria-hidden="true">
                <ChevronRight size={22} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default TerrenoSiguienteMision;
