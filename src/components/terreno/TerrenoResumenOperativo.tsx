'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { CloudCheck, WifiOff, RefreshCw, Compass, HardHat } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useConnectivity } from '@/hooks/useConnectivity';
import { sincronizarMisiones } from '@/services/misionesService';
import { UnidadInactivaBanner } from '@/components/common/UnidadInactivaBanner';
import { Heading } from '@/components/ui/Heading';
import { Button } from '@/components/ui/Button';
import styles from './TerrenoResumenOperativo.module.css';

interface MetricasTerreno {
  pendientes: number;
  enCurso: number;
  finalizadas: number;
}

export function TerrenoResumenOperativo() {
  const { usuario, esCuadrilla, unidadActiva } = useAuth();
  const { status, pendientes, sincronizar } = useConnectivity();
  const [metricas, setMetricas] = useState<MetricasTerreno>({
    pendientes: 0,
    enCurso: 0,
    finalizadas: 0,
  });

  useEffect(() => {
    let cancelado = false;

    async function cargarResumenMisiones() {
      try {
        const misiones = await sincronizarMisiones();
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

    return () => {
      cancelado = true;
    };
  }, []);

  const esOffline = status === 'offline';
  const esSincronizando = status === 'syncing';
  const UnidadIcon = esCuadrilla ? HardHat : Compass;

  return (
    <section
      className={styles.wrapper}
      aria-labelledby="resumen-operativo-terreno-heading"
    >
      {!unidadActiva && (
        <UnidadInactivaBanner
          tipoUnidad={esCuadrilla ? 'cuadrilla' : 'patrulla'}
          nombreUnidad={usuario?.unidadNombre}
        />
      )}

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

        {/* Tarjeta 2: Sincronización fuera de línea */}
        <div
          className={`${styles.syncCard} ${
            esOffline ? styles.syncCardWarning : ''
          }`.trim()}
        >
          <div className={styles.syncTop}>
            <div
              className={`${styles.iconBox} ${
                esOffline
                  ? styles.iconBoxWarning
                  : pendientes > 0
                  ? styles.iconBoxTeal
                  : styles.iconBoxSuccess
              }`.trim()}
              aria-hidden="true"
            >
              {esOffline ? (
                <WifiOff size={22} />
              ) : pendientes > 0 ? (
                <RefreshCw size={22} />
              ) : (
                <CloudCheck size={22} />
              )}
            </div>
            <div className={styles.cardBody}>
              <span className={styles.cardLabel}>Sincronización fuera de línea</span>
              <span className={styles.cardValue}>
                {pendientes === 0
                  ? 'Sincronizado (0 pendientes)'
                  : `${pendientes} operación(es) en cola local`}
              </span>
              <span className={styles.cardHelper}>
                {esOffline
                  ? 'Sin red móvil. Sus acciones se guardarán en el dispositivo.'
                  : 'Conexión estable con el servidor.'}
              </span>
            </div>
          </div>

          <div className={styles.syncActions}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={esSincronizando}
              disabled={esOffline || esSincronizando}
              icon={<RefreshCw size={16} />}
              onClick={() => void sincronizar()}
            >
              Sincronizar
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default TerrenoResumenOperativo;
