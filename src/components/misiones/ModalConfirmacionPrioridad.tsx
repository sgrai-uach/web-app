'use client';

import React from 'react';
import { ShieldAlert, ArrowRight, CheckCircle2 } from 'lucide-react';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import {
  ConfirmacionResumen,
  ConfirmacionResumenFila,
  ConfirmacionResumenJustificacion,
} from '@/components/common/ConfirmacionResumen';
import { Chip } from '@/components/ui/Chip';
import { obtenerVarianteChipPrioridad } from '@/lib/utils/chipVariants';
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
  const esActualizacion = versionReporte > 1;
  const mensaje = esActualizacion
    ? `¿Desea enviar la actualización del reporte en terreno (Reporte #${versionReporte}) al Centro de Mando y actualizar la prioridad del incidente?`
    : esModificacionPrioridad
      ? '¿Desea confirmar el ajuste fundado de prioridad respecto a la sugerencia del sistema y despachar el reporte al Centro de Mando?'
      : '¿Desea ratificar la prioridad sugerida por el sistema y enviar el reporte de evaluación en terreno al Centro de Mando?';

  return (
    <ConfirmModal
      abierto={abierto}
      variante="teal"
      tamano="md"
      titleId="modal-prioridad-titulo"
      titulo="Confirmar Evaluación y Prioridad"
      mensaje={mensaje}
      icono={<ShieldAlert size={22} />}
      textoConfirmar="Confirmar y Enviar"
      textoCargando="Enviando..."
      textoCancelar="Cancelar"
      iconoConfirmar={<CheckCircle2 size={18} />}
      cargando={cargando}
      alConfirmar={alConfirmar}
      alCancelar={alCancelar}
    >
      <ConfirmacionResumen>
        <ConfirmacionResumenFila etiqueta="Versión de Reporte">
          {esActualizacion
            ? `Actualización (Reporte #${versionReporte})`
            : 'Reporte inicial (Reporte #1)'}
        </ConfirmacionResumenFila>

        <ConfirmacionResumenFila etiqueta="Dictamen">
          {esModificacionPrioridad
            ? 'Prioridad modificada por patrulla'
            : 'Prioridad sugerida ratificada'}
        </ConfirmacionResumenFila>

        <ConfirmacionResumenFila etiqueta="Prioridad">
          {esModificacionPrioridad ? (
            <div className={styles.chipTransition}>
              <Chip
                variant={obtenerVarianteChipPrioridad(prioridadSugerida)}
                size="md"
              >
                Sugerida: {formatearPrioridad(prioridadSugerida)}
              </Chip>
              <ArrowRight
                size={14}
                className={styles.transitionArrow}
                aria-hidden="true"
              />
              <Chip
                variant={obtenerVarianteChipPrioridad(prioridadSeleccionada)}
                size="md"
              >
                Final: {formatearPrioridad(prioridadSeleccionada)}
              </Chip>
            </div>
          ) : (
            <Chip
              variant={obtenerVarianteChipPrioridad(prioridadSeleccionada)}
              size="md"
            >
              {formatearPrioridad(prioridadSeleccionada)}
            </Chip>
          )}
        </ConfirmacionResumenFila>

        <ConfirmacionResumenFila etiqueta="Afectación relevada">
          {nucleoFamiliarTotal} personas · {viviendasAfectadas} viviendas ·{' '}
          {peligrosActivosCount} alertas activas
        </ConfirmacionResumenFila>

        {esModificacionPrioridad && justificacionPrioridad && (
          <ConfirmacionResumenJustificacion
            etiqueta="Justificación técnica"
            contenido={justificacionPrioridad}
          />
        )}
      </ConfirmacionResumen>
    </ConfirmModal>
  );
}

export default ModalConfirmacionPrioridad;
