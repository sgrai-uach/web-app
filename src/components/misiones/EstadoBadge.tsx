import React from 'react';
import { formatearEstado } from '@/lib/utils/formatters';
import styles from './EstadoBadge.module.css';

interface EstadoBadgeProps {
  estado?: string | null;
  className?: string;
}

export function EstadoBadge({ estado, className = '' }: EstadoBadgeProps) {
  const norm = estado?.toUpperCase() || '';

  let varianteClase = styles.neutro;
  if (norm === 'DESPACHADA' || norm === 'ASIGNADA' || norm === 'PLANIFICADA') {
    varianteClase = styles.despachada;
  } else if (norm === 'EN_CURSO' || norm === 'EN_RUTA' || norm === 'EN_TERRENO' || norm === 'EN_PROCESO') {
    varianteClase = styles.enCurso;
  } else if (norm === 'FINALIZADA' || norm === 'COMPLETADA' || norm === 'CERRADA') {
    varianteClase = styles.finalizada;
  } else if (norm === 'CANCELADA' || norm === 'RECHAZADA') {
    varianteClase = styles.cancelada;
  }

  return (
    <span className={`${styles.badge} ${varianteClase} ${className}`.trim()}>
      {formatearEstado(estado)}
    </span>
  );
}
