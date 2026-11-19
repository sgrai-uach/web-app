'use client';

import React, { useEffect } from 'react';
import { ClipboardCheck, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import styles from './ModalConfirmacionTipologia.module.css';

export interface ModalConfirmacionTipologiaProps {
  abierto: boolean;
  tipologiaOriginal: string;
  tipologiaNueva: string;
  esReclasificacion: boolean;
  justificacion?: string;
  cargando?: boolean;
  alConfirmar: () => void;
  alCancelar: () => void;
}

export function ModalConfirmacionTipologia({
  abierto,
  tipologiaOriginal,
  tipologiaNueva,
  esReclasificacion,
  justificacion,
  cargando = false,
  alConfirmar,
  alCancelar,
}: ModalConfirmacionTipologiaProps) {
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

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-tipologia-titulo"
    >
      <div className={styles.modal}>
        <div className={styles.headerRow}>
          <div className={styles.iconContainer} aria-hidden="true">
            <ClipboardCheck size={22} />
          </div>
          <h2 id="modal-tipologia-titulo" className={styles.title}>
            Confirmar Evaluación de Tipología
          </h2>
        </div>

        <div className={styles.body}>
          <p className={styles.message}>
            {esReclasificacion
              ? '¿Desea confirmar la reclasificación de la tipología del incidente con los siguientes antecedentes técnicos?'
              : '¿Desea ratificar la tipología del incidente constatada presencialmente en terreno?'}
          </p>

          <div className={styles.summaryBox}>
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>Acción</span>
              <span className={styles.summaryValue}>
                {esReclasificacion ? 'Reclasificación en terreno' : 'Ratificación presencial'}
              </span>
            </div>

            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>Tipología</span>
              {esReclasificacion ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className={styles.tipoChip}>{tipologiaOriginal || 'Sin clasificar'}</span>
                  <ArrowRight size={14} color="var(--color-primary-teal)" aria-hidden="true" />
                  <span className={`${styles.tipoChip} ${styles.chipReclasificado}`}>
                    {tipologiaNueva}
                  </span>
                </div>
              ) : (
                <span className={styles.tipoChip}>{tipologiaNueva}</span>
              )}
            </div>

            {esReclasificacion && justificacion && (
              <div>
                <span className={styles.summaryLabel}>Justificación técnica:</span>
                <div className={styles.justificacionBox}>{justificacion}</div>
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
            {cargando ? 'Guardando...' : 'Confirmar y Enviar'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ModalConfirmacionTipologia;

