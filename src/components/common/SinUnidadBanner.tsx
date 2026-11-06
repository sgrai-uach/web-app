'use client';

import React from 'react';
import { UserX } from 'lucide-react';
import styles from './SinUnidadBanner.module.css';

export interface SinUnidadBannerProps {
  tipoUnidad?: 'patrulla' | 'cuadrilla';
  nombreOperador?: string | null;
}

export const SinUnidadBanner: React.FC<SinUnidadBannerProps> = ({
  tipoUnidad = 'patrulla',
  nombreOperador,
}) => {
  const esCuadrilla = tipoUnidad === 'cuadrilla';
  const unidadTermino = esCuadrilla ? 'cuadrilla' : 'patrulla verificadora';
  const titulo = esCuadrilla ? 'Sin Cuadrilla Asignada' : 'Sin Patrulla Asignada';

  return (
    <div className={styles.banner} role="status" aria-live="polite">
      <div className={styles.iconWrapper}>
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
};

export default SinUnidadBanner;
