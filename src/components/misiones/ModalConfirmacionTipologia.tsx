'use client';

import React from 'react';
import { ClipboardCheck, ArrowRight, CheckCircle2 } from 'lucide-react';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import {
  ConfirmacionResumen,
  ConfirmacionResumenFila,
  ConfirmacionResumenJustificacion,
} from '@/components/common/ConfirmacionResumen';
import { Chip } from '@/components/ui/Chip';
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
  const mensaje = esReclasificacion
    ? '¿Desea confirmar la reclasificación de la tipología del incidente con los siguientes antecedentes técnicos?'
    : '¿Desea ratificar la tipología del incidente constatada presencialmente en terreno?';

  return (
    <ConfirmModal
      abierto={abierto}
      variante="teal"
      tamano="md"
      titleId="modal-tipologia-titulo"
      titulo="Confirmar Evaluación de Tipología"
      mensaje={mensaje}
      icono={<ClipboardCheck size={22} />}
      textoConfirmar="Confirmar y Enviar"
      textoCargando="Guardando..."
      textoCancelar="Cancelar"
      iconoConfirmar={<CheckCircle2 size={18} />}
      cargando={cargando}
      alConfirmar={alConfirmar}
      alCancelar={alCancelar}
    >
      <ConfirmacionResumen>
        <ConfirmacionResumenFila etiqueta="Acción">
          {esReclasificacion ? 'Reclasificación en terreno' : 'Ratificación presencial'}
        </ConfirmacionResumenFila>

        <ConfirmacionResumenFila etiqueta="Tipología">
          {esReclasificacion ? (
            <div className={styles.chipTransition}>
              <Chip variant="neutral" size="md">
                {tipologiaOriginal || 'Sin clasificar'}
              </Chip>
              <ArrowRight
                size={14}
                className={styles.transitionArrow}
                aria-hidden="true"
              />
              <Chip variant="teal" size="md">
                {tipologiaNueva}
              </Chip>
            </div>
          ) : (
            <Chip variant="teal" size="md">
              {tipologiaNueva}
            </Chip>
          )}
        </ConfirmacionResumenFila>

        {esReclasificacion && justificacion && (
          <ConfirmacionResumenJustificacion
            etiqueta="Justificación técnica"
            contenido={justificacion}
          />
        )}
      </ConfirmacionResumen>
    </ConfirmModal>
  );
}

export default ModalConfirmacionTipologia;
