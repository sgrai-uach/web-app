'use client';

import React from 'react';
import { AlertTriangle, UserX } from 'lucide-react';
import styles from './UnidadEstadoBanner.module.css';

export interface UnidadEstadoBannerProps {
  variante: 'sin_asignacion' | 'desactivada';
  tipoUnidad?: 'cuadrilla' | 'patrulla';
  nombreOperador?: string | null;
  nombreUnidad?: string | null;
}

/**
 * Banner institucional único para estados especiales de unidad operativa
 * (sin asignación vigente o desactivada en modo solo lectura).
 */
export function UnidadEstadoBanner({
  variante,
  tipoUnidad = 'patrulla',
  nombreOperador,
  nombreUnidad,
}: UnidadEstadoBannerProps) {
  const esCuadrilla = tipoUnidad === 'cuadrilla';
  const esDesactivada = variante === 'desactivada';

  if (esDesactivada) {
    return (
      <div
        className={`${styles.banner} ${styles.bannerDesactivada}`}
        role="alert"
        aria-live="polite"
      >
        <div className={`${styles.iconWrapper} ${styles.iconDesactivada}`}>
          <AlertTriangle size={16} aria-hidden="true" />
        </div>
        <div className={styles.content}>
          <h3 className={styles.title}>
            {esCuadrilla ? 'Cuadrilla Desactivada' : 'Patrulla Desactivada'}
            {nombreUnidad ? ` — ${nombreUnidad}` : ''}
          </h3>
          <p className={styles.message}>
            Esta unidad ha sido retirada del servicio activo (§3.7 de baja lógica). Se encuentra en{' '}
            <strong>modo histórico de solo lectura</strong> para consulta de faenas anteriores. No es
            posible recibir nuevos despachos ni ejecutar acciones operativas.
          </p>
        </div>
      </div>
    );
  }

  const unidadTermino = esCuadrilla ? 'cuadrilla' : 'patrulla verificadora';
  const titulo = esCuadrilla ? 'Sin Cuadrilla Asignada' : 'Sin Patrulla Asignada';

  return (
    <div
      className={`${styles.banner} ${styles.bannerSinAsignacion}`}
      role="status"
      aria-live="polite"
    >
      <div className={`${styles.iconWrapper} ${styles.iconSinAsignacion}`}>
        <UserX size={16} aria-hidden="true" />
      </div>
      <div className={styles.content}>
        <h3 className={styles.title}>
          {titulo}
          {nombreOperador ? ` — ${nombreOperador}` : ''}
        </h3>
        <p className={styles.message}>
          Actualmente no cuentas con una {unidadTermino} asignada para este turno.
          Comunícate con el Centro de Mando o Supervisor para coordinar tu asignación operativa antes de recibir despachos.
        </p>
      </div>
    </div>
  );
}

export default UnidadEstadoBanner;
