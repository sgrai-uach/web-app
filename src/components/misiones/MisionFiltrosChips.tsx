'use client';

import React from 'react';
import styles from './MisionFiltrosChips.module.css';

export type FiltroEstado = 'todas' | 'pendientes' | 'en_curso' | 'finalizadas';

export interface ConteoFiltros {
  todas: number;
  pendientes: number;
  en_curso: number;
  finalizadas: number;
}

interface MisionFiltrosChipsProps {
  filtroActual: FiltroEstado;
  conteos: ConteoFiltros;
  onCambiarFiltro: (nuevoFiltro: FiltroEstado) => void;
}

export function MisionFiltrosChips({
  filtroActual,
  conteos,
  onCambiarFiltro,
}: MisionFiltrosChipsProps) {
  const opciones: Array<{ key: FiltroEstado; label: string; count: number }> = [
    { key: 'todas', label: 'Todas', count: conteos.todas },
    { key: 'pendientes', label: 'Pendientes', count: conteos.pendientes },
    { key: 'en_curso', label: 'En curso', count: conteos.en_curso },
    { key: 'finalizadas', label: 'Finalizadas', count: conteos.finalizadas },
  ];

  return (
    <div className={styles.chipsContainer} role="tablist" aria-label="Filtro de misiones">
      {opciones.map((opcion) => {
        const isActive = filtroActual === opcion.key;
        return (
          <button
            key={opcion.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`${styles.chip} ${isActive ? styles.chipActive : ''}`.trim()}
            onClick={() => onCambiarFiltro(opcion.key)}
          >
            <span>{opcion.label}</span>
            <span className={styles.badgeCount}>{opcion.count}</span>
          </button>
        );
      })}
    </div>
  );
}
