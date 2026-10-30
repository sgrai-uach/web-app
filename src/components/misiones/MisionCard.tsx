import React from 'react';
import Link from 'next/link';
import { MapPin, ChevronRight, Archive } from 'lucide-react';
import { EstadoBadge } from './EstadoBadge';
import { formatearPrioridad, formatearFechaHora24h } from '@/lib/utils/formatters';
import type { MisionLocal } from '@/types/offline';
import styles from './MisionCard.module.css';

interface MisionCardProps {
  mision: MisionLocal;
  href: string;
  esInactiva?: boolean;
}

export function MisionCard({ mision, href, esInactiva = false }: MisionCardProps) {
  const normPrioridad = mision.prioridad?.toUpperCase() || '';

  let prioridadClase = styles.priorityNeutro;
  if (normPrioridad === 'CRITICA') {
    prioridadClase = styles.priorityCritica;
  } else if (normPrioridad === 'ALTA') {
    prioridadClase = styles.priorityAlta;
  }

  return (
    <Link href={href} className={styles.card} tabIndex={0}>
      <div className={styles.headerRow}>
        <div className={styles.codeAndPriority}>
          <span className={styles.code}>{mision.codigoIncidente}</span>
          <span className={`${styles.priorityChip} ${prioridadClase}`}>
            {formatearPrioridad(mision.prioridad)}
          </span>
        </div>
        <div className={styles.statusAndChevron}>
          <EstadoBadge estado={mision.estado} />
          <ChevronRight size={18} className={styles.chevron} aria-hidden="true" />
        </div>
      </div>

      <div className={styles.typology}>{mision.tipologia}</div>

      <div className={styles.locationRow}>
        <MapPin size={16} className={styles.locationIcon} aria-hidden="true" />
        <span>{mision.direccion}</span>
      </div>

      <div className={styles.footerRow}>
        <span>Despachada: {formatearFechaHora24h(mision.fechaDespacho)}</span>
        {esInactiva && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Archive size={13} aria-hidden="true" />
            Solo lectura
          </span>
        )}
      </div>
    </Link>
  );
}
