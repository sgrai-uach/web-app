'use client';

import React from 'react';
import {
  CheckCircle,
  WifiOff,
  AlertTriangle,
  ClipboardCheck,
  Edit3,
  Plus,
  Minus,
  Info,
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

export interface ContadorCaracteresReporteProps {
  id?: string;
  actual: number;
  minimo: number;
  maximo: number;
}

/**
 * Pie de validación reutilizable para campos Textarea en formularios de terreno (Patrulla / Cuadrilla).
 */
export function ContadorCaracteresReporte({
  id,
  actual,
  minimo,
  maximo,
}: ContadorCaracteresReporteProps) {
  const esValido = actual >= minimo;
  const claseContador =
    actual === 0 ? '' : esValido ? styles.counterValid : styles.counterInvalid;

  return (
    <div id={id} className={styles.counterRow}>
      <span>Mínimo {minimo} caracteres</span>
      <span className={claseContador}>
        {actual} / {maximo}
      </span>
    </div>
  );
}

export interface SwitchReporteTerrenoProps {
  activo: boolean;
  onChange: (nuevoValor: boolean) => void;
  etiqueta: string;
  icono?: React.ReactNode;
  textoActivo?: string;
  textoInactivo?: string;
  disabled?: boolean;
  testId?: string;
}

/**
 * Interruptor táctil plano reutilizable (role="switch", >= 52px) compartido entre
 * Patrulla (H39) y Cuadrilla (H68) para Ficha FIBE y Solicitud de Apoyo Adicional.
 */
export function SwitchReporteTerreno({
  activo,
  onChange,
  etiqueta,
  icono,
  textoActivo = 'Solicitada',
  textoInactivo = 'No requerida',
  disabled = false,
  testId,
}: SwitchReporteTerrenoProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      disabled={disabled}
      data-testid={testId}
      onClick={() => onChange(!activo)}
      className={`${styles.switchBtn} ${activo ? styles.switchBtnActive : ''}`}
    >
      <span className={styles.switchLabelGroup}>
        {icono}
        <span>{etiqueta}</span>
      </span>
      <span className={styles.switchStateTag}>
        {activo ? textoActivo : textoInactivo}
      </span>
    </button>
  );
}

export interface StepperNumericoReporteProps {
  id?: string;
  valor: number;
  onChange: (nuevoValor: number) => void;
  min?: number;
  max?: number;
  step?: number;
  presets?: Array<{ valor: number; etiqueta: string }>;
  disabled?: boolean;
  ariaLabelInput: string;
  ariaLabelDecrementar: string;
  ariaLabelIncrementar: string;
}

/**
 * Control numérico táctil (- / input / +) con atajos rápidos opcionales,
 * adaptado del selector de personas afectadas de Patrulla para reutilización en Cuadrilla.
 */
export function StepperNumericoReporte({
  id,
  valor,
  onChange,
  min = 0,
  max = 1000,
  step = 1,
  presets,
  disabled = false,
  ariaLabelInput,
  ariaLabelDecrementar,
  ariaLabelIncrementar,
}: StepperNumericoReporteProps) {
  const redondear = (num: number) => Math.round(num * 100) / 100;

  const ajustar = (delta: number) => {
    const siguiente = redondear(Math.max(min, Math.min(max, valor + delta)));
    onChange(siguiente);
  };

  const handleInputChange = (raw: string) => {
    if (raw === '') {
      onChange(min);
      return;
    }
    const parsed = Number.parseFloat(raw);
    if (!Number.isNaN(parsed)) {
      onChange(redondear(Math.max(0, Math.min(max, parsed))));
    }
  };

  return (
    <div className={styles.stepperContainer}>
      <div className={styles.stepperControlRow}>
        <button
          type="button"
          className={styles.counterBtn}
          aria-label={ariaLabelDecrementar}
          disabled={disabled || valor <= min}
          onClick={() => ajustar(-step)}
        >
          <Minus size={18} aria-hidden="true" />
        </button>

        <input
          id={id}
          type="number"
          inputMode={step < 1 ? 'decimal' : 'numeric'}
          min={min}
          max={max}
          step={step}
          value={valor}
          disabled={disabled}
          aria-label={ariaLabelInput}
          onChange={(e) => handleInputChange(e.target.value)}
          className={styles.stepperNumberInput}
        />

        <button
          type="button"
          className={styles.counterBtn}
          aria-label={ariaLabelIncrementar}
          disabled={disabled || valor >= max}
          onClick={() => ajustar(step)}
        >
          <Plus size={18} aria-hidden="true" />
        </button>
      </div>

      {presets && presets.length > 0 && (
        <div className={styles.presetsRow} role="group" aria-label="Atajos rápidos">
          {presets.map((preset) => {
            const activo = valor === preset.valor;
            return (
              <button
                key={preset.valor}
                type="button"
                disabled={disabled}
                onClick={() => onChange(preset.valor)}
                className={`${styles.presetBtn} ${activo ? styles.presetBtnActive : ''}`}
              >
                {preset.etiqueta}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export interface NotaInformativaReporteProps {
  children: React.ReactNode;
  testId?: string;
}

/**
 * Banner informativo institucional con borde izquierdo teal reutilizable en formularios de terreno.
 */
export function NotaInformativaReporte({
  children,
  testId,
}: NotaInformativaReporteProps) {
  return (
    <div className={styles.infoNote} role="note" data-testid={testId}>
      <Info
        size={16}
        aria-hidden="true"
        style={{ flexShrink: 0, marginTop: '2px' }}
      />
      <span>{children}</span>
    </div>
  );
}

