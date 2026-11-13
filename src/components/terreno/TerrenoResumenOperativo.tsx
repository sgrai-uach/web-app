'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Compass, HardHat } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { sincronizarMisiones } from '@/services/misionesService';
import { UnidadInactivaBanner } from '@/components/common/UnidadInactivaBanner';
import { SinUnidadBanner } from '@/components/common/SinUnidadBanner';
import styles from './TerrenoResumenOperativo.module.css';

interface MetricasTerreno {
  pendientes: number;
  enCurso: number;
  finalizadas: number;
}

export function TerrenoResumenOperativo() {
  const { usuario, esCuadrilla, unidadActiva, tieneUnidadAsignada } = useAuth();
  const [metricas, setMetricas] = useState<MetricasTerreno>({
    pendientes: 0,
    enCurso: 0,
    finalizadas: 0,
  });

  useEffect(() => {
    let cancelado = false;

    async function cargarResumenMisiones() {
      try {
        if (!tieneUnidadAsignada || !usuario?.unidadId) {
          if (!cancelado) {
            setMetricas({ pendientes: 0, enCurso: 0, finalizadas: 0 });
          }
          return;
        }

        const misiones = await sincronizarMisiones({
          patrullaId: !esCuadrilla ? usuario.unidadId : undefined,
          cuadrillaId: esCuadrilla ? usuario.unidadId : undefined,
        });
        if (cancelado) return;

        const misionesPendientes = misiones.filter(
          (m) =>
            m.estado === 'ASIGNADA' ||
            m.estado === 'DESPACHADA' ||
            m.estado === 'PENDIENTE'
        ).length;
        const misionesEnCurso = misiones.filter(
          (m) =>
            m.estado === 'EN_CURSO' ||
            m.estado === 'EN_TERRENO' ||
            m.estado === 'EN_RUTA'
        ).length;
        const misionesFinalizadas = misiones.filter(
          (m) =>
            m.estado === 'FINALIZADA' ||
            m.estado === 'COMPLETADA' ||
            m.estado === 'CERRADA'
        ).length;

        setMetricas({
          pendientes: misionesPendientes,
          enCurso: misionesEnCurso,
          finalizadas: misionesFinalizadas,
        });
      } catch {
        // Si IndexedDB no está disponible en entorno de test sin mock, mantener contadores en 0
      }
    }

    void cargarResumenMisiones();

    const handleActualizar = () => {
      void cargarResumenMisiones();
    };

    window.addEventListener('sgrai:mision_asignada', handleActualizar);
    window.addEventListener('sgrai:mision_actualizada', handleActualizar);

    return () => {
      cancelado = true;
      window.removeEventListener('sgrai:mision_asignada', handleActualizar);
      window.removeEventListener('sgrai:mision_actualizada', handleActualizar);
    };
  }, [esCuadrilla, tieneUnidadAsignada, usuario?.unidadId]);

  const UnidadIcon = esCuadrilla ? HardHat : Compass;

  return (
    <section
      className={styles.wrapper}
      aria-labelledby="resumen-operativo-terreno-heading"
    >
      {!tieneUnidadAsignada ? (
        <SinUnidadBanner
          tipoUnidad={esCuadrilla ? 'cuadrilla' : 'patrulla'}
          nombreOperador={usuario?.nombre}
        />
      ) : !unidadActiva ? (
        <UnidadInactivaBanner
          tipoUnidad={esCuadrilla ? 'cuadrilla' : 'patrulla'}
          nombreUnidad={usuario?.unidadNombre}
        />
      ) : null}

      <div className={styles.grid}>
        {/* Tarjeta 1: Resumen Operativo de Misiones / Faenas */}
        <div
          className={`${styles.kpiCard} ${
            !unidadActiva ? styles.kpiCardWarning : ''
          }`.trim()}
        >
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>
              <UnidadIcon size={16} aria-hidden="true" />
              <span>{esCuadrilla ? 'Faenas de Cuadrilla' : 'Misiones de Patrulla'}</span>
            </span>
          </div>

          <div className={styles.kpiStatsGrid}>
            <Link
              href={`${esCuadrilla ? '/cuadrilla/misiones' : '/patrulla/misiones'}?estado=pendientes`}
              className={styles.statBox}
              aria-label={`Ver ${metricas.pendientes} misiones pendientes`}
            >
              <span className={styles.statLabel}>Pendientes</span>
              <span className={styles.statNumber}>{metricas.pendientes}</span>
            </Link>
            <Link
              href={`${esCuadrilla ? '/cuadrilla/misiones' : '/patrulla/misiones'}?estado=en_curso`}
              className={styles.statBox}
              aria-label={`Ver ${metricas.enCurso} misiones en curso`}
            >
              <span className={styles.statLabel}>En Curso</span>
              <span className={`${styles.statNumber} ${styles.statNumberTeal}`}>
                {metricas.enCurso}
              </span>
            </Link>
            <Link
              href={`${esCuadrilla ? '/cuadrilla/misiones' : '/patrulla/misiones'}?estado=finalizadas`}
              className={styles.statBox}
              aria-label={`Ver ${metricas.finalizadas} misiones finalizadas`}
            >
              <span className={styles.statLabel}>Finalizadas</span>
              <span className={`${styles.statNumber} ${styles.statNumberSuccess}`}>
                {metricas.finalizadas}
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default TerrenoResumenOperativo;
