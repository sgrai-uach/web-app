'use client';

import React from 'react';
import { AlertTriangle, MapPin, Clock, ArrowRight, X, BellRing } from 'lucide-react';
import type { MisionAsignadaAlerta } from '@/types/notificaciones';
import { formatearFechaHora24h } from '@/lib/utils/formatters';
import styles from './MisionAsignadaBanner.module.css';

export interface MisionAsignadaBannerProps {
  alerta: MisionAsignadaAlerta | null;
  onVerMision: (alerta: MisionAsignadaAlerta) => void;
  onCerrar: () => void;
}

function obtenerClasePrioridad(prioridad?: string): string {
  const p = (prioridad || '').toUpperCase();
  if (p === 'CRITICA') return styles.prioridadCritica;
  if (p === 'ALTA') return styles.prioridadAlta;
  if (p === 'MEDIA') return styles.prioridadMedia;
  return styles.prioridadBaja;
}

export const MisionAsignadaBanner: React.FC<MisionAsignadaBannerProps> = ({
  alerta,
  onVerMision,
  onCerrar,
}) => {
  if (!alerta) {
    return null;
  }

  const clasePrioridad = obtenerClasePrioridad(alerta.prioridad);

  return (
    <aside
      className={styles.bannerContainer}
      role="alert"
      aria-live="assertive"
      aria-labelledby="banner-mision-titulo"
    >
      <div className={styles.header}>
        <div className={styles.headerTitleWrapper}>
          <BellRing className={styles.headerIcon} size={18} aria-hidden="true" />
          <h2 id="banner-mision-titulo" className={styles.headerTitle}>
            Misión Asignada en Terreno
          </h2>
        </div>
        <span
          className={`${styles.badgePrioridad} ${clasePrioridad}`}
          data-testid="badge-prioridad-banner"
        >
          <AlertTriangle size={12} aria-hidden="true" style={{ marginRight: '4px', verticalAlign: 'middle' }} />
          <span>{alerta.prioridad || 'ALTA'}</span>
        </span>
      </div>

      <div className={styles.contentBody}>
        <div className={styles.identificadoresRow}>
          <span className={styles.codigoMision} data-testid="codigo-mision-banner">
            {alerta.codigo}
          </span>
          {alerta.incidenteFolio && (
            <span className={styles.folioIncidente} data-testid="folio-incidente-banner">
              Folio: {alerta.incidenteFolio}
            </span>
          )}
        </div>

        <div className={styles.afectacionTitulo} data-testid="afectacion-banner">
          {alerta.tipoAfectacion || 'Verificación operativa de incidente'}
        </div>

        {alerta.direccion && (
          <div className={styles.metaRow}>
            <MapPin className={styles.metaIcon} size={16} aria-hidden="true" />
            <span className={styles.metaText} data-testid="direccion-banner">
              {alerta.direccion}
            </span>
          </div>
        )}

        <div className={styles.metaRow}>
          <Clock className={styles.metaIcon} size={16} aria-hidden="true" />
          <span className={styles.metaText} data-testid="fecha-despacho-banner">
            Despachado: {formatearFechaHora24h(alerta.asignadoEn)}
          </span>
        </div>
      </div>

      <div className={styles.actionsRow}>
        <button
          type="button"
          className={styles.btnVerMision}
          onClick={() => onVerMision(alerta)}
          data-testid="btn-ver-mision-banner"
          aria-label={`Ver detalles de la misión ${alerta.codigo}`}
        >
          <span>Ver Misión</span>
          <ArrowRight size={18} aria-hidden="true" />
        </button>

        <button
          type="button"
          className={styles.btnCerrar}
          onClick={onCerrar}
          data-testid="btn-cerrar-banner"
          aria-label="Cerrar notificación de misión"
        >
          <X size={16} aria-hidden="true" />
          <span>Cerrar</span>
        </button>
      </div>
    </aside>
  );
};
