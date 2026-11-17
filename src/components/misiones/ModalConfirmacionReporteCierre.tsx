'use client';

import React from 'react';
import { ClipboardCheck, AlertOctagon, CheckCircle2 } from 'lucide-react';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import {
  ConfirmacionResumen,
  ConfirmacionResumenFila,
  ConfirmacionResumenJustificacion,
} from '@/components/common/ConfirmacionResumen';
import { Chip } from '@/components/ui/Chip';
import { formatearDictamenAtencion } from '@/lib/utils/formatters';
import type { DictamenAtencion } from '@/types/offline';
import styles from './ModalConfirmacionReporteCierre.module.css';

export interface ModalConfirmacionReporteCierreProps {
  abierto: boolean;
  dictamen: DictamenAtencion;
  motivoNoAbordable?: string;
  resumenTecnico: string;
  personasAfectadas: number;
  requiereAsistenciaSocial: boolean;
  cargando?: boolean;
  alConfirmar: () => void;
  alCancelar: () => void;
}

export function ModalConfirmacionReporteCierre({
  abierto,
  dictamen,
  motivoNoAbordable,
  resumenTecnico,
  personasAfectadas,
  requiereAsistenciaSocial,
  cargando = false,
  alConfirmar,
  alCancelar,
}: ModalConfirmacionReporteCierreProps) {
  const esNoAbordable = dictamen === 'NO_ABORDABLE';

  const mensaje = esNoAbordable
    ? '¿Confirma declarar este incidente como No Abordable, cerrar la misión de verificación y liberar la patrulla a estado Disponible?'
    : '¿Confirma enviar el informe técnico de verificación al Centro de Mando, cerrar la misión y dejar la patrulla Disponible?';

  return (
    <ConfirmModal
      abierto={abierto}
      variante={esNoAbordable ? 'danger' : 'teal'}
      tamano="md"
      titleId="modal-reporte-cierre-titulo"
      titulo={
        esNoAbordable
          ? 'Confirmar Cierre como No Abordable'
          : 'Confirmar Informe Técnico y Cierre'
      }
      mensaje={mensaje}
      icono={esNoAbordable ? <AlertOctagon size={22} /> : <ClipboardCheck size={22} />}
      textoConfirmar="Confirmar y Cerrar Misión"
      textoCargando="Enviando..."
      textoCancelar="Cancelar"
      iconoConfirmar={<CheckCircle2 size={18} />}
      cargando={cargando}
      alConfirmar={alConfirmar}
      alCancelar={alCancelar}
    >
      <ConfirmacionResumen>
        <ConfirmacionResumenFila etiqueta="Dictamen de Atención">
          <Chip variant={esNoAbordable ? 'danger' : 'teal'} size="md">
            {formatearDictamenAtencion(dictamen)}
          </Chip>
        </ConfirmacionResumenFila>

        <ConfirmacionResumenFila etiqueta="Personas Damnificadas">
          {personasAfectadas}
        </ConfirmacionResumenFila>

        <ConfirmacionResumenFila etiqueta="Asistencia Social (FIBE)">
          {requiereAsistenciaSocial ? 'Solicitada' : 'No requerida'}
        </ConfirmacionResumenFila>

        <ConfirmacionResumenJustificacion
          etiqueta="Resumen Técnico"
          contenido={resumenTecnico}
        />

        {esNoAbordable && motivoNoAbordable && (
          <ConfirmacionResumenJustificacion
            etiqueta="Motivo de No Abordabilidad"
            contenido={motivoNoAbordable}
          />
        )}
      </ConfirmacionResumen>

      {esNoAbordable && (
        <div className={styles.warningNotice} role="note">
          Al confirmar, el incidente cerrará formalmente con estado No abordable y
          la patrulla quedará liberada.
        </div>
      )}
    </ConfirmModal>
  );
}

export default ModalConfirmacionReporteCierre;
