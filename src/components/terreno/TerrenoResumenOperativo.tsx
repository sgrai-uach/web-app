'use client';

import React from 'react';
import { ShieldCheck, Archive, CloudCheck, WifiOff, RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useConnectivity } from '@/hooks/useConnectivity';
import { UnidadInactivaBanner } from '@/components/common/UnidadInactivaBanner';
import styles from './TerrenoResumenOperativo.module.css';

export function TerrenoResumenOperativo() {
  const { usuario, esCuadrilla, unidadActiva } = useAuth();
  const { status, pendientes } = useConnectivity();

  const esOffline = status === 'offline';

  return (
    <section className={styles.wrapper} aria-label="Resumen de estado operativo en terreno">
      {!unidadActiva && (
        <UnidadInactivaBanner
          tipoUnidad={esCuadrilla ? 'cuadrilla' : 'patrulla'}
          nombreUnidad={usuario?.unidadNombre}
        />
      )}

      <div className={styles.grid}>
        {/* Tarjeta 1: Estado de la Unidad */}
        <div
          className={`${styles.card} ${
            unidadActiva ? styles.cardSuccess : styles.cardWarning
          }`.trim()}
        >
          <div
            className={`${styles.iconBox} ${
              unidadActiva ? styles.iconBoxSuccess : styles.iconBoxWarning
            }`.trim()}
            aria-hidden="true"
          >
            {unidadActiva ? <ShieldCheck size={22} /> : <Archive size={22} />}
          </div>
          <div className={styles.cardBody}>
            <span className={styles.cardLabel}>Estado de Unidad</span>
            <span className={styles.cardValue}>
              {unidadActiva ? 'Unidad Activa y Disponible' : 'Modo Histórico (Inactiva)'}
            </span>
            <span className={styles.cardHelper}>
              {unidadActiva
                ? 'Habilitada para recibir y operar despachos en terreno.'
                : 'Acceso de solo lectura al historial previo a la desactivación.'}
            </span>
          </div>
        </div>

        {/* Tarjeta 2: Conectividad y Cola Offline */}
        <div
          className={`${styles.card} ${
            esOffline ? styles.cardWarning : ''
          }`.trim()}
        >
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
            <span className={styles.cardLabel}>Cola de Sincronización Offline</span>
            <span className={styles.cardValue}>
              {pendientes === 0
                ? 'Sincronizado (0 pendientes)'
                : `${pendientes} operación(es) en cola local`}
            </span>
            <span className={styles.cardHelper}>
              {esOffline
                ? 'Sin red móvil. Sus acciones se guardarán en el dispositivo.'
                : 'Conexión estable con el servidor central SGRAI.'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default TerrenoResumenOperativo;
