'use client';

import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import {
  ConfirmacionResumen,
  ConfirmacionResumenFila,
  ConfirmacionResumenJustificacion,
} from '@/components/common/ConfirmacionResumen';

export interface ModalConfirmacionCierreRecuperacionProps {
  abierto: boolean;
  resumenCierre: string;
  totalInsumosAsignados: number;
  totalInsumosConsumidos: number;
  cargando?: boolean;
  alConfirmar: () => void;
  alCancelar: () => void;
}

/**
 * Modal de confirmación antes de enviar el reporte de cierre de recuperación
 * desde terreno (patrón H39 reutilizando ConfirmModal y ConfirmacionResumen).
 */
export function ModalConfirmacionCierreRecuperacion({
  abierto,
  resumenCierre,
  totalInsumosAsignados,
  totalInsumosConsumidos,
  cargando = false,
  alConfirmar,
  alCancelar,
}: ModalConfirmacionCierreRecuperacionProps) {
  const totalRemanente = Math.max(0, totalInsumosAsignados - totalInsumosConsumidos);

  return (
    <ConfirmModal
      abierto={abierto}
      titulo="Confirmar envío de reporte de cierre"
      mensaje="¿Confirma enviar el reporte de término de entrega y consumo de insumos al Centro de Mando para su confirmación final?"
      textoConfirmar="Enviar Reporte de Cierre"
      textoCargando="Enviando..."
      textoCancelar="Revisar"
      variante="teal"
      tamano="md"
      icono={<CheckCircle2 size={22} />}
      iconoConfirmar={<CheckCircle2 size={16} />}
      cargando={cargando}
      titleId="modal-cierre-recuperacion-titulo"
      alConfirmar={alConfirmar}
      alCancelar={alCancelar}
    >
      <ConfirmacionResumen>
        <ConfirmacionResumenJustificacion
          etiqueta="Resumen de cierre"
          contenido={resumenCierre}
        />
        {totalInsumosAsignados > 0 && (
          <>
            <ConfirmacionResumenFila etiqueta="Insumos consumidos">
              {totalInsumosConsumidos} de {totalInsumosAsignados} un.
            </ConfirmacionResumenFila>
            <ConfirmacionResumenFila etiqueta="Remanente a devolver">
              {totalRemanente} un.
            </ConfirmacionResumenFila>
          </>
        )}
      </ConfirmacionResumen>
    </ConfirmModal>
  );
}

export default ModalConfirmacionCierreRecuperacion;
