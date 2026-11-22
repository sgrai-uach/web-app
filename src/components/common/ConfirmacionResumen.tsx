'use client';

import React from 'react';
import styles from './ConfirmacionResumen.module.css';

export interface ConfirmacionResumenProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Caja de resumen técnico para modales de confirmación operativa.
 */
export function ConfirmacionResumen({
  children,
  className = '',
}: ConfirmacionResumenProps) {
  return (
    <div className={`${styles.summaryBox} ${className}`.trim()}>
      {children}
    </div>
  );
}

export interface ConfirmacionResumenFilaProps {
  etiqueta: string;
  children: React.ReactNode;
}

/**
 * Fila clave-valor con soporte de ajuste automático (`flex-wrap`) para móvil.
 */
export function ConfirmacionResumenFila({
  etiqueta,
  children,
}: ConfirmacionResumenFilaProps) {
  return (
    <div className={styles.summaryRow}>
      <span className={styles.summaryLabel}>{etiqueta}</span>
      <div className={styles.summaryValue}>{children}</div>
    </div>
  );
}

export interface ConfirmacionResumenJustificacionProps {
  etiqueta?: string;
  contenido: string;
}

/**
 * Bloque estandarizado para mostrar la justificación técnica en confirmaciones.
 */
export function ConfirmacionResumenJustificacion({
  etiqueta = 'Justificación técnica',
  contenido,
}: ConfirmacionResumenJustificacionProps) {
  return (
    <div className={styles.justificacionBlock}>
      <span className={styles.summaryLabel}>{etiqueta}</span>
      <div className={styles.justificacionBox}>{contenido}</div>
    </div>
  );
}

