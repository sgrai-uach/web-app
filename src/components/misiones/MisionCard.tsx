import React from 'react';
import Link from 'next/link';
import { MapPin, ChevronRight, Archive, ShieldCheck, Package } from 'lucide-react';
import { EstadoBadge } from './EstadoBadge';
import { Chip } from '@/components/ui/Chip';
import { obtenerVarianteChipPrioridad } from '@/lib/utils/chipVariants';
import {
  formatearPrioridad,
  formatearFechaHora24h,
  esMisionDePrevencion,
  formatearTipologia,
} from '@/lib/utils/formatters';
import { obtenerContextoPrevencionMision } from '@/services/prevencionService';
import type { MisionLocal } from '@/types/offline';
import styles from './MisionCard.module.css';

interface MisionCardProps {
  mision: MisionLocal;
  href: string;
  esInactiva?: boolean;
}

export function MisionCard({ mision, href, esInactiva = false }: MisionCardProps) {
  const esPrevencion = esMisionDePrevencion(mision);
  const contextoPrevencion = esPrevencion ? obtenerContextoPrevencionMision(mision) : null;
  const totalRecursos = contextoPrevencion?.recursosMision.length ?? 0;

  return (
    <Link
      href={href}
      className={esPrevencion ? `${styles.card} ${styles.cardPrevencion}` : styles.card}
      tabIndex={0}
    >
      <div className={styles.headerRow}>
        <div className={styles.codeAndPriority}>
          <span className={styles.code}>{mision.codigoIncidente}</span>
          <Chip variant={obtenerVarianteChipPrioridad(mision.prioridad)} size="md">
            {formatearPrioridad(mision.prioridad)}
          </Chip>
        </div>
        <div className={styles.statusAndChevron}>
          <EstadoBadge estado={mision.estado} size="md" />
          <ChevronRight size={18} className={styles.chevron} aria-hidden="true" />
        </div>
      </div>

      {esPrevencion && (
        <div className={styles.prevencionRow}>
          <Chip variant="teal" size="sm">
            <ShieldCheck size={12} aria-hidden="true" />
            Prevención territorial
          </Chip>
        </div>
      )}

      <div className={styles.typology}>{formatearTipologia(mision.tipologia)}</div>

      <div className={styles.locationRow}>
        <MapPin size={16} className={styles.locationIcon} aria-hidden="true" />
        <span>{mision.direccion}</span>
      </div>

      {esPrevencion && totalRecursos > 0 && (
        <div className={styles.recursosRow}>
          <Package size={16} className={styles.locationIcon} aria-hidden="true" />
          <span>
            {totalRecursos}{' '}
            {totalRecursos === 1
              ? 'recurso logístico asignado'
              : 'recursos logísticos asignados'}
          </span>
        </div>
      )}

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
