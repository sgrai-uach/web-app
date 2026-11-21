'use client';

import React from 'react';
import { CheckCircle2, Info } from 'lucide-react';
import { Chip } from '@/components/ui/Chip';
import {
  ResumenReporteTerreno,
  CampoResumenReporte,
} from '@/components/misiones/ReporteTerrenoBase';
import { formatearFechaHora24h } from '@/lib/utils/formatters';
import { ETIQUETAS_TIPO_MISION, formatearEtiquetaSegura } from '@/lib/utils/labels';
import type { MisionLocal } from '@/types/offline';
import styles from './RecuperacionMisionEstadoCard.module.css';

export interface RecuperacionMisionEstadoCardProps {
  mision: MisionLocal;
}

/**
 * Tarjeta de estado operativo para misiones de tipo RECUPERACION en Patrulla Verificadora.
 * Reutiliza primitivas de ReporteTerrenoBase (patrón H39/H68) sin habilitar acciones
 * de cierre reservadas al Encargado en sgrai-web (H75).
 */
export function RecuperacionMisionEstadoCard({
  mision,
}: RecuperacionMisionEstadoCardProps) {
  const estadoNorm = (mision.estado || '').trim().toUpperCase();
  const estaConcluida =
    estadoNorm === 'COMPLETADA' ||
    estadoNorm === 'FINALIZADA' ||
    estadoNorm === 'CERRADA';

  const tipoEtiqueta =
    formatearEtiquetaSegura(mision.tipoMision, ETIQUETAS_TIPO_MISION) ||
    'Recuperación operativa';

  if (estaConcluida) {
    return (
      <div
        className={styles.cardWrapper}
        data-testid="recuperacion-estado-card"
      >
        <ResumenReporteTerreno
          testId="recuperacion-concluida-resumen"
          titulo="Operativo de recuperación concluido"
          chip={
            <Chip
              variant="success"
              size="sm"
              icon={<CheckCircle2 size={12} />}
            >
              Finalizada
            </Chip>
          }
        >
          <CampoResumenReporte label="Tipo de misión" valor={tipoEtiqueta} />
          <CampoResumenReporte
            label="Estado de la misión"
            valor="Completada por cierre formal del Centro de Mando"
          />
          <CampoResumenReporte
            label="Disponibilidad de patrulla"
            valor="Disponible para nueva asignación"
          />
          {mision.fechaCierre && (
            <CampoResumenReporte
              label="Fecha de cierre"
              valor={formatearFechaHora24h(mision.fechaCierre)}
            />
          )}
        </ResumenReporteTerreno>

        <div className={styles.successBox} role="status">
          <CheckCircle2
            size={18}
            aria-hidden="true"
            style={{ flexShrink: 0, marginTop: '1px' }}
          />
          <span>
            El operativo de recuperación fue declarado concluido. La patrulla se
            encuentra nuevamente disponible.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.cardWrapper} data-testid="recuperacion-estado-card">
      <ResumenReporteTerreno
        testId="recuperacion-en-curso-resumen"
        titulo="Operativo de recuperación en ejecución"
        chip={
          <Chip variant="warning" size="sm">
            En ejecución
          </Chip>
        }
      >
        <CampoResumenReporte label="Tipo de misión" valor={tipoEtiqueta} />
        <CampoResumenReporte
          label="Estado de la patrulla"
          valor="En recuperación"
        />
      </ResumenReporteTerreno>

      <div className={styles.infoBox} role="note">
        <Info size={18} aria-hidden="true" className={styles.infoIcon} />
        <span>
          El cierre formal del operativo y la devolución de insumos se decretan
          desde el Centro de Mando. Al concluir, esta misión pasará a estado
          Finalizada y la patrulla quedará disponible automáticamente.
        </span>
      </div>
    </div>
  );
}
