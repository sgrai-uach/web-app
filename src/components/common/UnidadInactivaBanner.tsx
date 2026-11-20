'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import styles from './UnidadInactivaBanner.module.css';

export interface UnidadInactivaBannerProps {
  tipoUnidad: 'cuadrilla' | 'patrulla';
  nombreUnidad?: string | null;
}

export const UnidadInactivaBanner: React.FC<UnidadInactivaBannerProps> = ({
  tipoUnidad,
  nombreUnidad,
}) => {
  const esCuadrilla = tipoUnidad === 'cuadrilla';

  return (
    <div className={styles.banner} role="alert" aria-live="polite">
      <div className={styles.iconWrapper}>
        <AlertTriangle size={16} aria-hidden="true" />
      </div>
      <div className={styles.content}>
        <h3 className={styles.title}>
          {esCuadrilla ? 'Cuadrilla Desactivada' : 'Patrulla Desactivada'}
          {nombreUnidad ? ` — ${nombreUnidad}` : ''}
        </h3>
        <p className={styles.message}>
          Esta unidad ha sido retirada del servicio activo. Se encuentra en{' '}
          <strong>modo histórico de solo lectura</strong> para consulta de faenas anteriores. No es
          posible recibir nuevos despachos ni ejecutar acciones operativas.
        </p>
      </div>
    </div>
  );
};

export default UnidadInactivaBanner;
