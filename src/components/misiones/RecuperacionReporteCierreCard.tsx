'use client';

import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  Clock,
  PackageCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { useToastOptional } from '@/components/ui/Toast';
import {
  AlertaFeedbackReporte,
  BloqueFormularioReporte,
  CampoResumenReporte,
  ResumenReporteTerreno,
  type FeedbackReporteState,
} from '@/components/misiones/ReporteTerrenoBase';
import { ModalConfirmacionCierreRecuperacion } from '@/components/misiones/ModalConfirmacionCierreRecuperacion';
import {
  obtenerRecuperacionDeMision,
  reportarCierreRecuperacionTerreno,
} from '@/services/reporteRecuperacionService';
import { formatearFechaHora24h } from '@/lib/utils/formatters';
import type { MisionLocal } from '@/types/offline';
import styles from './RecuperacionReporteCierreCard.module.css';

export interface RecuperacionReporteCierreCardProps {
  misionActual: MisionLocal;
  onReporteEnviado?: (misionActualizada: MisionLocal) => void;
  deshabilitado?: boolean;
}

/**
 * Formulario de cierre en terreno para misiones de tipo RECUPERACION.
 * Reutiliza las primitivas visuales y de flujo de H39 (ReporteTerrenoBase + ConfirmModal)
 * y envía el resumen + consumos para confirmación en el Centro de Mando.
 */
export function RecuperacionReporteCierreCard({
  misionActual,
  onReporteEnviado,
  deshabilitado = false,
}: RecuperacionReporteCierreCardProps) {
  const toast = useToastOptional();
  const recuperacion = useMemo(
    () => obtenerRecuperacionDeMision(misionActual),
    [misionActual]
  );

  const recursos = useMemo(() => recuperacion?.recursos ?? [], [recuperacion]);
  const reporteExistente = recuperacion?.reportePatrulla ?? null;

  const [resumenCierre, setResumenCierre] = useState<string>('');
  const [consumosPorRecurso, setConsumosPorRecurso] = useState<Record<string, number>>(
    () => {
      const inicial: Record<string, number> = {};
      for (const rec of recursos) {
        inicial[rec.recursoId] = rec.cantidadAsignada;
      }
      return inicial;
    }
  );
  const [guardando, setGuardando] = useState<boolean>(false);
  const [modalAbierto, setModalAbierto] = useState<boolean>(false);
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackReporteState | null>(null);

  const totales = useMemo(() => {
    let asignado = 0;
    let consumido = 0;
    for (const rec of recursos) {
      const val = consumosPorRecurso[rec.recursoId] ?? rec.cantidadAsignada;
      const clamped = Number.isFinite(val)
        ? Math.max(0, Math.min(rec.cantidadAsignada, val))
        : 0;
      asignado += rec.cantidadAsignada;
      consumido += clamped;
    }
    return { asignado, consumido };
  }, [recursos, consumosPorRecurso]);

  if (reporteExistente) {
    return (
      <div className={styles.card} data-testid="recuperacion-reporte-enviado-card">
        <ResumenReporteTerreno
          testId="resumen-reporte-cierre-recuperacion"
          titulo="Reporte de cierre enviado desde terreno"
          chip={
            <Chip variant="warning" size="sm" icon={<Clock size={12} />}>
              Pendiente de confirmación
            </Chip>
          }
          registradoPor={
            reporteExistente.reportadoPor?.nombre
              ? `${reporteExistente.reportadoPor.nombre} · ${formatearFechaHora24h(
                  reporteExistente.reportadoEn
                )}`
              : formatearFechaHora24h(reporteExistente.reportadoEn)
          }
        >
          <CampoResumenReporte
            label="Resumen de cierre"
            valor={reporteExistente.resumen}
            esBloqueTexto
          />
          {recursos.map((rec) => {
            const consumoReportado = reporteExistente.consumos.find(
              (c) => c.recursoId === rec.recursoId
            );
            const cantConsumida =
              consumoReportado?.cantidadConsumida ?? rec.cantidadAsignada;
            const cantDevuelta = Math.max(0, rec.cantidadAsignada - cantConsumida);
            return (
              <CampoResumenReporte
                key={rec.recursoId}
                label={rec.nombre}
                valor={`Consumido: ${cantConsumida} / ${rec.cantidadAsignada} un. (Devolver: ${cantDevuelta} un.)`}
              />
            );
          })}
        </ResumenReporteTerreno>

        <div className={styles.pendingNotice} role="status">
          <Clock size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>
            El reporte fue enviado al Centro de Mando. Solo resta que el Encargado
            confirme la conclusión formal para liberar la patrulla y reintegrar el inventario.
          </span>
        </div>
      </div>
    );
  }

  const handleAbrirConfirmacion = () => {
    setErrorValidacion(null);
    setFeedback(null);

    if (resumenCierre.trim().length < 10) {
      setErrorValidacion(
        'El resumen de cierre debe tener al menos 10 caracteres.'
      );
      return;
    }

    for (const rec of recursos) {
      const val = consumosPorRecurso[rec.recursoId] ?? rec.cantidadAsignada;
      if (!Number.isInteger(val) || val < 0 || val > rec.cantidadAsignada) {
        setErrorValidacion(
          `El consumo de "${rec.nombre}" debe estar entre 0 y ${rec.cantidadAsignada} unidades.`
        );
        return;
      }
    }

    setModalAbierto(true);
  };

  const handleConfirmarEnvio = async () => {
    setGuardando(true);
    setErrorValidacion(null);
    try {
      const consumos = recursos.map((rec) => ({
        recursoId: rec.recursoId,
        cantidadConsumida:
          consumosPorRecurso[rec.recursoId] ?? rec.cantidadAsignada,
      }));

      const resultado = await reportarCierreRecuperacionTerreno(misionActual.id, {
        resumenCierre: resumenCierre.trim(),
        consumos,
        misionActual,
      });

      setModalAbierto(false);
      setFeedback({
        tipo: resultado.enColaOffline ? 'offline' : 'success',
        texto: resultado.mensaje,
      });

      if (resultado.enColaOffline) {
        toast?.showWarning(resultado.mensaje, 'Guardado sin conexión');
      } else {
        toast?.showSuccess(resultado.mensaje, 'Reporte enviado');
      }

      onReporteEnviado?.(resultado.mision);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'No fue posible enviar el reporte de cierre.';
      setModalAbierto(false);
      setFeedback({ tipo: 'error', texto: msg });
      toast?.showError(msg, 'Error al reportar cierre');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className={styles.card} data-testid="recuperacion-reporte-cierre-card">
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <ClipboardCheck size={18} color="var(--color-primary-teal, #1B6F7D)" />
          <h3 className={styles.title}>Cierre de Operativo en Terreno</h3>
        </div>
        <Chip variant="info" size="sm">
          En ejecución
        </Chip>
      </div>

      <AlertaFeedbackReporte
        feedback={feedback}
        errorValidacion={errorValidacion}
      />

      <BloqueFormularioReporte
        icono={<ClipboardCheck size={16} />}
        titulo="1. Resumen de entrega y rehabilitación"
      >
        <Textarea
          aria-label="Resumen de cierre en terreno"
          rows={3}
          maxLength={2000}
          value={resumenCierre}
          onChange={(e) => {
            setResumenCierre(e.target.value);
            setErrorValidacion(null);
          }}
          placeholder="Detalle las ayudas entregadas, familias atendidas o trabajos de rehabilitación completados (mín. 10 caracteres)..."
          disabled={deshabilitado || guardando}
        />
        <div className={styles.charCount}>
          {resumenCierre.trim().length} / 2000 caracteres
        </div>
      </BloqueFormularioReporte>

      {recursos.length > 0 && (
        <BloqueFormularioReporte
          icono={<PackageCheck size={16} />}
          titulo="2. Consumo de insumos asignados"
        >
          <div className={styles.recursosLista}>
            {recursos.map((rec) => {
              const consumido =
                consumosPorRecurso[rec.recursoId] ?? rec.cantidadAsignada;
              const devolver = Math.max(0, rec.cantidadAsignada - consumido);

              return (
                <div key={rec.recursoId} className={styles.recursoItem}>
                  <div className={styles.recursoInfo}>
                    <span className={styles.recursoNombre}>{rec.nombre}</span>
                    <span className={styles.recursoMeta}>
                      Asignado: {rec.cantidadAsignada} un. · Remanente a devolver:{' '}
                      <strong>{devolver} un.</strong>
                    </span>
                  </div>
                  <div className={styles.recursoInputBox}>
                    <Input
                      aria-label={`Consumido de ${rec.nombre}`}
                      type="number"
                      min={0}
                      max={rec.cantidadAsignada}
                      step={1}
                      value={consumido}
                      onChange={(e) => {
                        const parsed =
                          e.target.value === ''
                            ? 0
                            : Number.parseInt(e.target.value, 10);
                        setConsumosPorRecurso((prev) => ({
                          ...prev,
                          [rec.recursoId]: Number.isNaN(parsed) ? 0 : parsed,
                        }));
                        setErrorValidacion(null);
                      }}
                      disabled={deshabilitado || guardando}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </BloqueFormularioReporte>
      )}

      <Button
        type="button"
        variant="primary"
        size="lg"
        fullWidth
        loading={guardando}
        disabled={deshabilitado || guardando}
        icon={<CheckCircle2 size={18} />}
        onClick={handleAbrirConfirmacion}
      >
        Enviar Reporte de Cierre
      </Button>

      <ModalConfirmacionCierreRecuperacion
        abierto={modalAbierto}
        resumenCierre={resumenCierre.trim()}
        totalInsumosAsignados={totales.asignado}
        totalInsumosConsumidos={totales.consumido}
        cargando={guardando}
        alConfirmar={handleConfirmarEnvio}
        alCancelar={() => setModalAbierto(false)}
      />
    </div>
  );
}

export default RecuperacionReporteCierreCard;
