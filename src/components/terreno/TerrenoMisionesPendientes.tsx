'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, CheckCircle, Clock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { sincronizarMisiones } from '@/services/misionesService';
import {
  formatearPrioridad,
  formatearFechaHora24h,
  ordenarMisionesPorPrioridadYFecha,
} from '@/lib/utils/formatters';
import type { MisionLocal } from '@/types/offline';
import styles from './TerrenoMisionesPendientes.module.css';

export function TerrenoMisionesPendientes() {
  const { usuario, esCuadrilla, unidadActiva, tieneUnidadAsignada } = useAuth();
  const [misionesPendientes, setMisionesPendientes] = useState<MisionLocal[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);

  useEffect(() => {
    let cancelado = false;

    async function buscarMisiones() {
      try {
        if (!tieneUnidadAsignada || !usuario?.unidadId) {
          if (!cancelado) setMisionesPendientes([]);
          return;
        }

        const misiones = await sincronizarMisiones({
          tipoMision: esCuadrilla ? 'ATENCION_CUADRILLA' : 'VERIFICACION',
          patrullaId: !esCuadrilla ? usuario?.unidadId : undefined,
          cuadrillaId: esCuadrilla ? usuario?.unidadId : undefined,
        });
        if (cancelado) return;

        // Filtrar exclusivamente misiones pendientes de aceptación o rechazo
        const pendientes = misiones.filter((m) => {
          const e = m.estado?.toUpperCase();
          return e === 'ASIGNADA' || e === 'DESPACHADA' || e === 'PENDIENTE';
        });

        setMisionesPendientes(ordenarMisionesPorPrioridadYFecha(pendientes));
      } catch {
        // En caso de error, mantener estado neutro
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    void buscarMisiones();

    const handleActualizar = () => {
      void buscarMisiones();
    };

    window.addEventListener('sgrai:mision_asignada', handleActualizar);
    window.addEventListener('sgrai:mision_actualizada', handleActualizar);

    return () => {
      cancelado = true;
      window.removeEventListener('sgrai:mision_asignada', handleActualizar);
      window.removeEventListener('sgrai:mision_actualizada', handleActualizar);
    };
  }, [esCuadrilla, tieneUnidadAsignada, usuario?.unidadId]);

  if (cargando) {
    return (
      <div className={styles.sectionWrapper}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Misiones pendientes</span>
        </div>
        <div className={styles.emptyCard}>
          <span>Buscando despachos pendientes...</span>
        </div>
      </div>
    );
  }

  const rutaBase = esCuadrilla ? '/cuadrilla/misiones' : '/patrulla/misiones';

  if (misionesPendientes.length === 0) {
    return (
      <div className={styles.sectionWrapper}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Misiones pendientes</span>
        </div>
        <div className={styles.emptyCard}>
          <CheckCircle size={18} color="var(--color-success, #2E7D32)" aria-hidden="true" />
          <span>
            {!unidadActiva
              ? 'Unidad inactiva en modo de solo lectura.'
              : 'Sin despachos pendientes por confirmar.'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.sectionWrapper}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Misiones pendientes</span>
        <span className={styles.badgeCount}>
          {misionesPendientes.length === 1
            ? '1 por confirmar'
            : `${misionesPendientes.length} por confirmar`}
        </span>
      </div>

      <div className={styles.misionesList}>
        {misionesPendientes.map((mision) => {
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
              className={styles.pendingCard}
              title={`Ver despacho pendiente ${mision.codigoIncidente}`}
            >
              <div className={styles.cardMainInfo}>
                <div className={styles.metaRow}>
                  <span className={styles.code}>{mision.codigoIncidente}</span>
                  <span className={`${styles.priorityChip} ${prioridadClase}`}>
                    {formatearPrioridad(mision.prioridad)}
                  </span>
                </div>
                <div className={styles.typology}>{mision.tipologia}</div>
                <div className={styles.timestampRow}>
                  <Clock size={12} aria-hidden="true" />
                  <span>
                    Despachada {formatearFechaHora24h(mision.fechaDespacho || mision.actualizadoEn)}
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

export default TerrenoMisionesPendientes;

