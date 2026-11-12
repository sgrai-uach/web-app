'use client';

import React from 'react';
import { AlertTriangle, AlertCircle, LocateFixed, LocateOff } from 'lucide-react';
import type { TelemetriaEstado } from '@/types/telemetria';
import styles from './TelemetryStatusBadge.module.css';

export interface TelemetryStatusBadgeProps {
  estado: TelemetriaEstado;
  onRetry?: () => void;
  mostrarInactivo?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Indicador visual sutil no intrusivo del estado de transmisión de telemetría GPS (HU-70).
 * Diseñado bajo Flat UI y esquinas rectas institucionales.
 */
export function TelemetryStatusBadge({
  estado,
  onRetry,
  mostrarInactivo = false,
  className = '',
  style,
}: TelemetryStatusBadgeProps) {
  if (estado === 'INACTIVO' && !mostrarInactivo) {
    return null;
  }

  let label = 'GPS inactivo';
  let statusClass = styles.inactivo;
  let Icon = LocateOff;
  let tooltip = 'Telemetría GPS inactiva.';

  if (estado === 'TRANSMITIENDO') {
    label = 'GPS activo';
    statusClass = styles.transmitiendo;
    Icon = LocateFixed;
    tooltip = 'Transmitiendo coordenadas en tiempo real al Centro de Mando.';
  } else if (estado === 'SIN_PERMISO') {
    label = 'GPS sin permiso';
    statusClass = styles.sinPermiso;
    Icon = AlertTriangle;
    tooltip = 'Permiso de ubicación denegado en el navegador. Pulse para reintentar.';
  } else if (estado === 'ERROR_GPS') {
    label = 'Sin señal GPS';
    statusClass = styles.errorGps;
    Icon = AlertCircle;
    tooltip = 'Buscando señal satelital GPS... Pulse para reintentar.';
  }

  const esClickeable = Boolean(onRetry && (estado === 'SIN_PERMISO' || estado === 'ERROR_GPS'));

  return (
    <div
      className={`${styles.badge} ${statusClass} ${esClickeable ? styles.clickable : ''} ${className}`.trim()}
      title={tooltip}
      role="status"
      aria-live="polite"
      onClick={esClickeable ? onRetry : undefined}
      onKeyDown={
        esClickeable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onRetry?.();
              }
            }
          : undefined
      }
      tabIndex={esClickeable ? 0 : undefined}
      style={style}
    >
      <span className={`${styles.dot}`} aria-hidden="true" />
      <Icon size={13} aria-hidden="true" style={{ flexShrink: 0 }} />
      <span className={styles.label}>{label}</span>
    </div>
  );
}

export interface TelemetryWarningBannerProps {
  estado: TelemetriaEstado;
  onRetry?: () => void;
  className?: string;
}

/**
 * Banner no bloqueante desplegado en la vista de misión activa cuando no se cuenta con permisos de GPS.
 */
export function TelemetryWarningBanner({
  estado,
  onRetry,
  className = '',
}: TelemetryWarningBannerProps) {
  if (estado !== 'SIN_PERMISO') {
    return null;
  }

  return (
    <div className={`${styles.warningBanner} ${className}`.trim()} role="status" aria-live="polite">
      <AlertTriangle size={18} aria-hidden="true" className={styles.warningIcon} />
      <div className={styles.warningContent}>
        <span className={styles.warningTitle}>Ubicación GPS no autorizada</span>
        <span className={styles.warningText}>
          Para que el Centro de Mando visualice la unidad en el mapa en tiempo real, habilite el
          permiso de ubicación en los ajustes del navegador de su dispositivo móvil.
        </span>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={styles.retryButton}
          aria-label="Reintentar solicitud de permiso de ubicación"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}

export default TelemetryStatusBadge;
