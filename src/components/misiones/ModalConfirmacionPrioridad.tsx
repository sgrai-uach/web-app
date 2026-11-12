'use client';

import React, { useEffect } from 'react';
import { ShieldAlert, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatearPrioridad } from '@/lib/utils/formatters';
import type { PrioridadIncidente } from '@/types/offline';
import styles from './ModalConfirmacionPrioridad.module.css';

export interface ModalConfirmacionPrioridadProps {
  abierto: boolean;
  versionReporte: number;
  prioridadSugerida: PrioridadIncidente;
  prioridadSeleccionada: PrioridadIncidente;
  esModificacionPrioridad: boolean;
  justificacionPrioridad?: string;
  nucleoFamiliarTotal: number;
  viviendasAfectadas: number;
  peligrosActivosCount: number;
  cargando?: boolean;
  alConfirmar: () => void;
  alCancelar: () => void;
}

function obtenerClasePrioridad(prioridad: PrioridadIncidente): string {
  switch (prioridad) {
    case 'CRITICA':
      return styles.prioCritica;
    case 'ALTA':
      return styles.prioAlta;
    case 'MEDIA':
      return styles.prioMedia;
    default:
      return styles.prioBaja;
  }
}

export function ModalConfirmacionPrioridad({
  abierto,
  versionReporte,
  prioridadSugerida,
  prioridadSeleccionada,
  esModificacionPrioridad,
  justificacionPrioridad,
  nucleoFamiliarTotal,
  viviendasAfectadas,
  peligrosActivosCount,
  cargando = false,
  alConfirmar,
  alCancelar,
}: ModalConfirmacionPrioridadProps) {
  useEffect(() => {
    if (!abierto) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !cargando) {
        alCancelar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [abierto, cargando, alCancelar]);

  if (!abierto) return null;

  const esActualizacion = versionReporte > 1;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-prioridad-titulo"
    >
      <div className={styles.modal}>
        <div className={styles.headerRow}>
          <div className={styles.iconContainer} aria-hidden="true">
            <ShieldAlert size={22} />
          </div>
          <h2 id="modal-prioridad-titulo" className={styles.title}>
            Confirmar Evaluación y Prioridad
          </h2>
        </div>

        <div className={styles.body}>
          <p className={styles.message}>
            {esActualizacion
              ? `¿Desea enviar la actualización del reporte en terreno (Reporte #${versionReporte}) al Centro de Mando y actualizar la prioridad del incidente?`
              : esModificacionPrioridad
                ? '¿Desea confirmar el ajuste fundado de prioridad respecto a la sugerencia del sistema y despachar el reporte al Centro de Mando?'
                : '¿Desea ratificar la prioridad sugerida por el sistema y enviar el reporte de evaluación en terreno al Centro de Mando?'}
          </p>

          <div className={styles.summaryBox}>
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>Versión de Reporte</span>
              <span className={styles.summaryValue}>
                {esActualizacion
                  ? `Actualización (Reporte #${versionReporte})`
                  : 'Reporte inicial (Reporte #1)'}
              </span>
            </div>

            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>Dictamen</span>
              <span className={styles.summaryValue}>
                {esModificacionPrioridad
                  ? 'Prioridad modificada por patrulla'
                  : 'Prioridad sugerida ratificada'}
              </span>
            </div>

            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>Prioridad</span>
              {esModificacionPrioridad ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    className={`${styles.prioChip} ${obtenerClasePrioridad(prioridadSugerida)}`}
                  >
                    Sugerida: {formatearPrioridad(prioridadSugerida)}
                  </span>
                  <ArrowRight
                    size={14}
                    color="var(--color-primary-teal)"
                    aria-hidden="true"
                  />
                  <span
                    className={`${styles.prioChip} ${obtenerClasePrioridad(prioridadSeleccionada)}`}
                  >
                    Final: {formatearPrioridad(prioridadSeleccionada)}
                  </span>
                </div>
              ) : (
                <span
                  className={`${styles.prioChip} ${obtenerClasePrioridad(prioridadSeleccionada)}`}
                >
                  {formatearPrioridad(prioridadSeleccionada)}
                </span>
              )}
            </div>

            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>Afectación relevada</span>
              <span className={styles.summaryValue}>
                {nucleoFamiliarTotal} personas · {viviendasAfectadas} viviendas ·{' '}
                {peligrosActivosCount} alertas activas
              </span>
            </div>

            {esModificacionPrioridad && justificacionPrioridad && (
              <div>
                <span className={styles.summaryLabel}>Justificación técnica:</span>
                <div className={styles.justificacionBox}>{justificacionPrioridad}</div>
              </div>
            )}
          </div>
        </div>

        <div className={styles.actionRow}>
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={alCancelar}
            disabled={cargando}
            className={styles.actionBtn}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={alConfirmar}
            loading={cargando}
            icon={<CheckCircle2 size={18} />}
            className={styles.actionBtn}
          >
            {cargando ? 'Enviando...' : 'Confirmar y Enviar'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ModalConfirmacionPrioridad;

