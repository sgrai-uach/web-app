'use client';

import React from 'react';
import { ClipboardCheck, CheckCircle2 } from 'lucide-react';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import {
  ConfirmacionResumen,
  ConfirmacionResumenFila,
  ConfirmacionResumenJustificacion,
} from '@/components/common/ConfirmacionResumen';
import { Chip } from '@/components/ui/Chip';
import { formatearEstadoTerreno } from '@/lib/utils/formatters';
import { obtenerVarianteChipEstadoTerreno } from '@/lib/utils/chipVariants';
import type {
  EstadoTerrenoCierreCuadrilla,
  MaterialConsumidoFormItem,
} from '@/types/offline';
import styles from './ModalConfirmacionCierreCuadrilla.module.css';

export interface ModalConfirmacionCierreCuadrillaProps {
  abierto: boolean;
  resumenFaenas: string;
  horasHombre: number;
  estadoTerreno: EstadoTerrenoCierreCuadrilla;
  materialesConsumidos: MaterialConsumidoFormItem[];
  requiereApoyoAdicional: boolean;
  totalAdjuntosSincronizados?: number;
  totalAdjuntosPendientes?: number;
  cargando?: boolean;
  alConfirmar: () => void;
  alCancelar: () => void;
}

export function ModalConfirmacionCierreCuadrilla({
  abierto,
  resumenFaenas,
  horasHombre,
  estadoTerreno,
  materialesConsumidos,
  requiereApoyoAdicional,
  totalAdjuntosSincronizados = 0,
  totalAdjuntosPendientes = 0,
  cargando = false,
  alConfirmar,
  alCancelar,
}: ModalConfirmacionCierreCuadrillaProps) {
  const totalEvidencias = totalAdjuntosSincronizados + totalAdjuntosPendientes;

  return (
    <ConfirmModal
      abierto={abierto}
      variante="teal"
      tamano="md"
      titleId="modal-cierre-cuadrilla-titulo"
      titulo="Confirmar Cierre de Misión e Informe Técnico"
      mensaje="¿Confirma enviar el informe técnico final al Centro de Mando, finalizar la misión y liberar la cuadrilla a estado Disponible?"
      icono={<ClipboardCheck size={22} />}
      textoConfirmar="Confirmar y Finalizar Misión"
      textoCargando="Enviando informe..."
      textoCancelar="Cancelar"
      iconoConfirmar={<CheckCircle2 size={18} />}
      cargando={cargando}
      alConfirmar={alConfirmar}
      alCancelar={alCancelar}
    >
      <ConfirmacionResumen>
        <ConfirmacionResumenFila etiqueta="Estado Final del Terreno">
          <Chip
            variant={obtenerVarianteChipEstadoTerreno(estadoTerreno)}
            size="md"
          >
            {formatearEstadoTerreno(estadoTerreno)}
          </Chip>
        </ConfirmacionResumenFila>

        <ConfirmacionResumenFila etiqueta="Horas Hombre Invertidas">
          {horasHombre} h
        </ConfirmacionResumenFila>

        <ConfirmacionResumenFila etiqueta="Materiales Consumidos">
          {materialesConsumidos.length > 0 ? (
            <ul className={styles.materialList}>
              {materialesConsumidos.map((mat, idx) => (
                <li key={`${mat.recurso_id}-${idx}`}>
                  {mat.nombre || mat.recurso_id}: {mat.cantidad}
                  {mat.unidad ? ` ${mat.unidad}` : ''}
                </li>
              ))}
            </ul>
          ) : (
            'Sin consumo de materiales'
          )}
        </ConfirmacionResumenFila>

        <ConfirmacionResumenFila etiqueta="Evidencia Multimedia">
          {totalEvidencias === 0
            ? 'Sin archivos adjuntos'
            : totalAdjuntosPendientes > 0
              ? `${totalEvidencias} archivo(s) (${totalAdjuntosSincronizados} sincronizado(s), ${totalAdjuntosPendientes} en cola offline)`
              : `${totalAdjuntosSincronizados} archivo(s) vinculado(s)`}
        </ConfirmacionResumenFila>

        <ConfirmacionResumenFila etiqueta="Apoyo Adicional">
          {requiereApoyoAdicional ? 'Solicitado' : 'No requerido'}
        </ConfirmacionResumenFila>

        <ConfirmacionResumenJustificacion
          etiqueta="Resumen de Faenas"
          contenido={resumenFaenas}
        />
      </ConfirmacionResumen>

      <div className={styles.infoNotice} role="note">
        Al confirmar, la misión pasará a estado Finalizada y la cuadrilla quedará
        Disponible. El incidente permanecerá en evaluación del Centro de Mando para
        su resolución definitiva.
      </div>
    </ConfirmModal>
  );
}

export default ModalConfirmacionCierreCuadrilla;
