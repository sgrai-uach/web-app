import React from 'react';
import styles from './ConnectionStatusBadge.module.css';

export type ConnectivityState = 'connected' | 'offline' | 'syncing';

export interface ConnectionStatusBadgeProps {
  connected?: boolean;
  status?: ConnectivityState;
  pendingCount?: number;
  activeLabel?: string;
  inactiveLabel?: string;
  syncingLabel?: string;
  tooltip?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function ConnectionStatusBadge({
  connected,
  status,
  pendingCount = 0,
  activeLabel = 'Sincronizado',
  inactiveLabel = 'Trabajando offline',
  syncingLabel = 'Sincronizando...',
  tooltip,
  className = '',
  style,
}: ConnectionStatusBadgeProps) {
  // Inferir estado canónico
  const resolvedStatus: ConnectivityState =
    status ||
    (pendingCount > 0 && connected
      ? 'syncing'
      : connected === false
      ? 'offline'
      : 'connected');

  let label = activeLabel;
  let statusClass = styles.connected;
  let defaultTooltip = 'Conexión activa con el servidor central.';

  if (resolvedStatus === 'offline') {
    label = pendingCount > 0 ? `${inactiveLabel} (${pendingCount} pendientes)` : inactiveLabel;
    statusClass = styles.offline;
    defaultTooltip = 'Sin conexión a internet. Los datos se guardan localmente en el dispositivo.';
  } else if (resolvedStatus === 'syncing') {
    label = pendingCount > 0 ? `Sincronizando (${pendingCount} pendientes)...` : syncingLabel;
    statusClass = styles.syncing;
    defaultTooltip = 'Transmitiendo datos guardados localmente hacia el servidor central.';
  }

  return (
    <div
      className={`${styles.badge} ${statusClass} ${className}`.trim()}
      title={tooltip || defaultTooltip}
      role="status"
      aria-live="polite"
      style={style}
    >
      <span className={`${styles.dot} ${statusClass}`} aria-hidden="true" />
      <span className={styles.label}>{label}</span>
    </div>
  );
}
