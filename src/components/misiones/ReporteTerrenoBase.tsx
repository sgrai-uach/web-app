'use client';

import React from 'react';
import {
  CheckCircle,
  WifiOff,
  AlertTriangle,
  ClipboardCheck,
  Edit3,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatearFechaHora24h } from '@/lib/utils/formatters';
import type { EvaluadorReporteTerreno } from '@/types/offline';
import styles from './ReporteTerrenoBase.module.css';

export interface FeedbackReporteState {
  tipo: 'success' | 'offline' | 'error';
  texto: string;
}

/**
 * Formatea en una única línea canónica quién registró un reporte de terreno y cuándo:
 * `Nombre Apellido (correo@valdivia.cl) · DD-MM-YYYY HH:mm`.
 */
export function formatearAutorReporte(
  evaluador?: EvaluadorReporteTerreno | null,
  fecha?: string | null,
  fallbackNombre?: string
): string | null {
  const nombre = evaluador?.nombre?.trim() || fallbackNombre?.trim() || '';
  if (!nombre) return null;

  const email = evaluador?.email?.trim();
  const emailTexto = email ? ` (${email})` : '';
  const fechaTexto = fecha ? ` · ${formatearFechaHora24h(fecha)}` : '';

  return `${nombre}${emailTexto}${fechaTexto}`;
}

export interface AlertaFeedbackReporteProps {
  feedback?: FeedbackReporteState | null;
  errorValidacion?: string | null;
}

/**
 * Renderiza mensajes de resultado (online/offline/error) y alertas de validación
 * con estética plana institucional.
 */
export function AlertaFeedbackReporte({
  feedback,
  errorValidacion,
}: AlertaFeedbackReporteProps) {
  return (
    <>
      {feedback && (
        <div
          className={`${styles.alertBox} ${
            feedback.tipo === 'success'
              ? styles.alertSuccess
              : feedback.tipo === 'offline'
                ? styles.alertOffline
                : styles.alertError
          }`}
          role="status"
        >
          {feedback.tipo === 'success' && (
            <CheckCircle size={18} aria-hidden="true" className={styles.alertIcon} />
          )}
          {feedback.tipo === 'offline' && (
            <WifiOff size={18} aria-hidden="true" className={styles.alertIcon} />
          )}
          {feedback.tipo === 'error' && (
            <AlertTriangle size={18} aria-hidden="true" className={styles.alertIcon} />
          )}
          <span>{feedback.texto}</span>
        </div>
      )}

      {errorValidacion && (
        <div className={`${styles.alertBox} ${styles.alertError}`} role="alert">
          <AlertTriangle size={18} aria-hidden="true" className={styles.alertIcon} />
          <span>{errorValidacion}</span>
        </div>
      )}
    </>
  );
}

export interface BloqueFormularioReporteProps {
  icono: React.ReactNode;
  titulo: string;
  chipDerecha?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Contenedor estándar de sección numerada dentro de los formularios técnicos de terreno.
 */
export function BloqueFormularioReporte({
  icono,
  titulo,
  chipDerecha,
  children,
}: BloqueFormularioReporteProps) {
  return (
    <div className={styles.blockSection}>
      <div className={styles.blockTitleRow}>
        <h4 className={styles.blockTitle}>
          {icono}
          <span>{titulo}</span>
        </h4>
        {chipDerecha}
      </div>
      {children}
    </div>
  );
}

export interface CampoResumenReporteProps {
  label: string;
  valor: React.ReactNode;
  esBloqueTexto?: boolean;
}

/**
 * Fila estandarizada dentro de la grilla de resumen de un reporte de terreno.
 */
export function CampoResumenReporte({
  label,
  valor,
  esBloqueTexto = false,
}: CampoResumenReporteProps) {
  return (
    <div className={styles.resumenItem}>
      <span className={styles.resumenLabel}>{label}</span>
      {esBloqueTexto ? (
        <div className={styles.resumenTextoBloque}>{valor}</div>
      ) : (
        <span className={styles.resumenValor}>{valor}</span>
      )}
    </div>
  );
}

export interface ResumenReporteTerrenoProps {
  testId?: string;
  titulo: string;
  chip?: React.ReactNode;
  registradoPor?: string | null;
  textoModificar?: string;
  onModificar?: () => void;
  deshabilitado?: boolean;
  children?: React.ReactNode;
}

/**
 * Tarjeta estandarizada de resumen de reporte ya enviado en terreno.
 * Presenta cabecera uniforme con chip de estado/versión, autoría única ("Registrado por")
 * sin banners duplicados y acción de edición opcional.
 */
export function ResumenReporteTerreno({
  testId,
  titulo,
  chip,
  registradoPor,
  textoModificar,
  onModificar,
  deshabilitado = false,
  children,
}: ResumenReporteTerrenoProps) {
  return (
    <div className={styles.resumenCard} data-testid={testId}>
      <div className={styles.resumenHeader}>
        <span className={styles.resumenTitulo}>
          <ClipboardCheck size={16} aria-hidden="true" />
          <span>{titulo}</span>
        </span>
        {chip}
      </div>

      {(registradoPor || children) && (
        <div className={styles.resumenGrid}>
          {registradoPor && (
            <CampoResumenReporte label="Registrado por" valor={registradoPor} />
          )}
          {children}
        </div>
      )}

      {!deshabilitado && onModificar && textoModificar && (
        <Button
          type="button"
          variant="outline"
          size="md"
          icon={<Edit3 size={16} />}
          onClick={onModificar}
          className={styles.btnModificar}
        >
          {textoModificar}
        </Button>
      )}
    </div>
  );
}
