'use client';

import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Chip } from '@/components/ui/Chip';
import {
  ResumenReporteTerreno,
  CampoResumenReporte,
} from '@/components/misiones/ReporteTerrenoBase';
import { formatearFechaHora24h } from '@/lib/utils/formatters';
import { ETIQUETAS_TIPO_MISION, formatearEtiquetaSegura } from '@/lib/utils/labels';
import { RecuperacionReporteCierreCard } from '@/components/misiones/RecuperacionReporteCierreCard';
import type { MisionLocal } from '@/types/offline';
import styles from './RecuperacionMisionEstadoCard.module.css';

export interface RecuperacionMisionEstadoCardProps {
  mision: MisionLocal;
  onReporteEnviado?: (misionActualizada: MisionLocal) => void;
  deshabilitado?: boolean;
}

/**
 * Tarjeta de estado operativo para misiones de tipo RECUPERACION en Patrulla Verificadora.
 * Reutiliza primitivas de ReporteTerrenoBase (patrón H39/H68) y permite a la patrulla
 * reportar el cierre en terreno para su confirmación final en Centro de Mando.
 */
export function RecuperacionMisionEstadoCard({
  mision,
  onReporteEnviado,
  deshabilitado = false,
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
      <RecuperacionReporteCierreCard
        misionActual={mision}
        onReporteEnviado={onReporteEnviado}
        deshabilitado={deshabilitado}
      />
    </div>
  );
}
