'use client';

import React, { useState, useId, useMemo } from 'react';
import { LifeBuoy, Send, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Textarea } from '@/components/ui/Textarea';
import { useToastOptional } from '@/components/ui/Toast';
import {
  AlertaFeedbackReporte,
  BloqueFormularioReporte,
  CampoResumenReporte,
  ContadorCaracteresReporte,
  NotaInformativaReporte,
  ResumenReporteTerreno,
  formatearAutorReporte,
  type FeedbackReporteState,
} from './ReporteTerrenoBase';
import {
  DETALLE_APOYO_MIN,
  TEXTAREA_MAX,
  VALORES_INICIALES_SOLICITUD_APOYO,
  solicitudApoyoSchema,
} from '@/lib/validations/solicitudApoyo';
import {
  obtenerSolicitudesApoyoMision,
  solicitarApoyoAdicional,
  type ResultadoSolicitudApoyo,
} from '@/services/solicitudApoyoService';
import type { MisionLocal, SolicitudApoyoCuadrillaForm } from '@/types/offline';
import styles from './SolicitudApoyoCuadrillaCard.module.css';

export interface SolicitudApoyoCuadrillaCardProps {
  misionActual: MisionLocal;
  deshabilitado?: boolean;
  onApoyoSolicitado?: (resultado: ResultadoSolicitudApoyo) => void | Promise<void>;
}

/**
 * Formulario interactivo para solicitar apoyo adicional de recursos materiales o humanos
 * desde terreno sin interrumpir la faena en curso (HU-44).
 * Reutiliza las primitivas de `ReporteTerrenoBase` compartidas con Patrulla Verificadora.
 */
export function SolicitudApoyoCuadrillaCard({
  misionActual,
  deshabilitado = false,
  onApoyoSolicitado,
}: SolicitudApoyoCuadrillaCardProps) {
  const checkboxId = useId();
  const cuadrillaCheckboxId = useId();
  const detalleId = useId();
  const resumenId = useId();
  const observacionesId = useId();
  const toast = useToastOptional();

  const solicitudesRegistradas = useMemo(
    () => obtenerSolicitudesApoyoMision(misionActual),
    [misionActual]
  );

  const [form, setForm] = useState<SolicitudApoyoCuadrillaForm>(() => ({
    ...VALORES_INICIALES_SOLICITUD_APOYO,
  }));
  const [enviando, setEnviando] = useState<boolean>(false);
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackReporteState | null>(null);

  const detalleLimpio = form.detalleApoyoRequerido.trim();

  const handleToggleApoyo = (checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      requiereApoyoAdicional: checked,
      requiereCuadrillaAdicional: checked ? prev.requiereCuadrillaAdicional : false,
    }));
    setErrorValidacion(null);
    if (checked) {
      setFeedback(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deshabilitado || enviando) return;

    setErrorValidacion(null);
    setFeedback(null);

    if (!form.requiereApoyoAdicional) {
      setErrorValidacion(
        'Marque la casilla "Requiere apoyo adicional" para especificar los refuerzos necesarios.'
      );
      return;
    }

    const validacion = solicitudApoyoSchema.safeParse(form);
    if (!validacion.success) {
      const primerIssue = validacion.error.issues[0];
      setErrorValidacion(
        primerIssue?.message ||
          `Debe ingresar el detalle de apoyo requerido con al menos ${DETALLE_APOYO_MIN} caracteres.`
      );
      return;
    }

    setEnviando(true);
    try {
      const resultado = await solicitarApoyoAdicional(misionActual.id, form, {
        misionActual,
      });

      setFeedback({
        tipo: resultado.enColaOffline ? 'offline' : 'success',
        texto: resultado.mensaje,
      });

      if (toast) {
        if (resultado.enColaOffline) {
          toast.showWarning(resultado.mensaje, 'Guardado sin conexión', {
            dedupKey: `apoyo-offline-${misionActual.id}-${resultado.solicitud.localId || ''}`,
          });
        } else {
          toast.showSuccess(resultado.mensaje, 'Central alertada', {
            dedupKey: `apoyo-enviado-${misionActual.id}-${resultado.solicitud.id || ''}`,
          });
        }
      }

      setForm({ ...VALORES_INICIALES_SOLICITUD_APOYO });

      if (onApoyoSolicitado) {
        await onApoyoSolicitado(resultado);
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'No fue posible registrar la solicitud de apoyo adicional.';
      setFeedback({
        tipo: 'error',
        texto: msg,
      });
      if (toast) {
        toast.showError(msg, 'Error al solicitar apoyo');
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className={styles.container}>
      <AlertaFeedbackReporte feedback={feedback} errorValidacion={errorValidacion} />

      {!deshabilitado && (
        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <BloqueFormularioReporte
            icono={<LifeBuoy size={16} aria-hidden="true" />}
            titulo="Solicitud de Refuerzos en Terreno"
            chipDerecha={
              form.requiereApoyoAdicional ? (
                <Chip variant="warning" size="sm">
                  Apoyo requerido
                </Chip>
              ) : null
            }
          >
            <label
              htmlFor={checkboxId}
              className={`${styles.checkboxHighlight} ${
                form.requiereApoyoAdicional ? styles.checkboxHighlightActive : ''
              } ${deshabilitado || enviando ? styles.checkboxHighlightDisabled : ''}`}
            >
              <span className={styles.checkboxControlRow}>
                <input
                  id={checkboxId}
                  type="checkbox"
                  checked={form.requiereApoyoAdicional}
                  disabled={deshabilitado || enviando}
                  onChange={(e) => handleToggleApoyo(e.target.checked)}
                  className={styles.checkboxInput}
                />
                <span className={styles.checkboxTextGroup}>
                  <span className={styles.checkboxTitle}>
                    <LifeBuoy size={17} aria-hidden="true" />
                    <span>Requiere apoyo adicional</span>
                  </span>
                  <span className={styles.checkboxSubtitle}>
                    Alerta de inmediato a la central logística y de operaciones sin
                    detener la faena en curso.
                  </span>
                </span>
              </span>
              <Chip
                variant={form.requiereApoyoAdicional ? 'warning' : 'neutral'}
                size="sm"
              >
                {form.requiereApoyoAdicional ? 'Activo' : 'Opcional'}
              </Chip>
            </label>

            {form.requiereApoyoAdicional && (
              <div
                className={styles.conditionalPanel}
                data-testid="panel-detalle-apoyo"
              >
                <label
                  htmlFor={cuadrillaCheckboxId}
                  className={`${styles.checkboxCuadrillaCard} ${
                    form.requiereCuadrillaAdicional ? styles.checkboxCuadrillaCardActive : ''
                  } ${deshabilitado || enviando ? styles.checkboxHighlightDisabled : ''}`}
                >
                  <span className={styles.checkboxControlRow}>
                    <input
                      id={cuadrillaCheckboxId}
                      type="checkbox"
                      checked={form.requiereCuadrillaAdicional}
                      disabled={deshabilitado || enviando}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          requiereCuadrillaAdicional: e.target.checked,
                        }))
                      }
                      className={styles.checkboxCuadrillaInput}
                    />
                    <span className={styles.checkboxTextGroup}>
                      <span className={styles.checkboxTitle}>
                        Requiere cuadrilla adicional
                      </span>
                      <span className={styles.checkboxSubtitle}>
                        Habilita y destaca en el Centro de Mando el despacho de una segunda cuadrilla con una misión distinta.
                      </span>
                    </span>
                  </span>
                  <Chip
                    variant={form.requiereCuadrillaAdicional ? 'danger' : 'neutral'}
                    size="sm"
                  >
                    {form.requiereCuadrillaAdicional ? 'Sí' : 'Opcional'}
                  </Chip>
                </label>

                <div className={styles.fieldGroup}>
                  <label htmlFor={detalleId} className={styles.fieldLabel}>
                    Detalle de apoyo requerido{' '}
                    <span className={styles.requiredMark} aria-hidden="true">
                      *
                    </span>
                  </label>
                  <span className={styles.fieldHint}>
                    Especifique el equipamiento, maquinaria o personal adicional
                    necesario (mínimo {DETALLE_APOYO_MIN} caracteres).
                  </span>
                  <Textarea
                    id={detalleId}
                    name="detalle_apoyo_requerido"
                    required
                    aria-required="true"
                    maxLength={TEXTAREA_MAX}
                    value={form.detalleApoyoRequerido}
                    onChange={(e) => {
                      setForm((prev) => ({
                        ...prev,
                        detalleApoyoRequerido: e.target.value,
                      }));
                      setErrorValidacion(null);
                    }}
                    placeholder="Ej. Se solicita motoniveladora y cuadrilla adicional de despeje"
                    disabled={deshabilitado || enviando}
                    className={styles.textareaField}
                  />
                  <ContadorCaracteresReporte
                    actual={detalleLimpio.length}
                    minimo={DETALLE_APOYO_MIN}
                    maximo={TEXTAREA_MAX}
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label htmlFor={resumenId} className={styles.fieldLabel}>
                    Contexto breve de la faena (opcional)
                  </label>
                  <Textarea
                    id={resumenId}
                    name="resumen_tecnico"
                    maxLength={TEXTAREA_MAX}
                    value={form.resumenTecnico}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        resumenTecnico: e.target.value,
                      }))
                    }
                    placeholder="Ej. Tronco de gran diámetro bloqueando ambas pistas"
                    disabled={deshabilitado || enviando}
                    className={styles.textareaSecondary}
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label htmlFor={observacionesId} className={styles.fieldLabel}>
                    Observaciones adicionales (opcional)
                  </label>
                  <Textarea
                    id={observacionesId}
                    name="observaciones"
                    maxLength={TEXTAREA_MAX}
                    value={form.observaciones}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        observaciones: e.target.value,
                      }))
                    }
                    placeholder="Ej. Acceso habilitado por calle lateral para maquinaria"
                    disabled={deshabilitado || enviando}
                    className={styles.textareaSecondary}
                  />
                </div>

                <NotaInformativaReporte>
                  Al enviar, la tarjeta del incidente en el Centro de Mando mostrará
                  el indicador de Apoyo Solicitado y se notificará en tiempo real al
                  Encargado. La misión continuará en estado En curso.
                </NotaInformativaReporte>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={enviando}
                  disabled={deshabilitado || enviando}
                  icon={<Send size={18} />}
                  className={styles.submitBtn}
                >
                  {enviando
                    ? 'Enviando solicitud...'
                    : 'Enviar Solicitud de Apoyo'}
                </Button>
              </div>
            )}
          </BloqueFormularioReporte>
        </form>
      )}

      {solicitudesRegistradas.length > 0 && (
        <div
          className={styles.historyStack}
          data-testid="historial-solicitudes-apoyo"
        >
          {solicitudesRegistradas.map((item, idx) => {
            const autor = formatearAutorReporte(item.evaluador, item.creadoEn);
            const tituloNumero = solicitudesRegistradas.length - idx;
            return (
              <ResumenReporteTerreno
                key={item.id || item.localId || `${item.creadoEn}-${idx}`}
                testId={`resumen-apoyo-${idx}`}
                titulo={`Solicitud de Apoyo #${tituloNumero}`}
                registradoPor={autor}
                deshabilitado
                chip={
                  <span className={styles.historyChipsGroup}>
                    {item.requiereCuadrillaAdicional && (
                      <Chip
                        variant="danger"
                        size="sm"
                        data-testid={`badge-cuadrilla-adicional-hist-${idx}`}
                      >
                        Cuadrilla adicional solicitada
                      </Chip>
                    )}
                    {item.sincronizado ? (
                      <Chip variant="warning" size="sm">
                        Apoyo Solicitado
                      </Chip>
                    ) : (
                      <Chip
                        variant="warning"
                        size="sm"
                        icon={<Clock size={12} />}
                      >
                        Pendiente de sincronizar
                      </Chip>
                    )}
                  </span>
                }
              >
                <CampoResumenReporte
                  label="Detalle de apoyo requerido"
                  valor={item.detalleApoyoRequerido}
                  esBloqueTexto
                />
                {item.resumenTecnico && (
                  <CampoResumenReporte
                    label="Contexto de la faena"
                    valor={item.resumenTecnico}
                    esBloqueTexto
                  />
                )}
                {item.observaciones && (
                  <CampoResumenReporte
                    label="Observaciones"
                    valor={item.observaciones}
                    esBloqueTexto
                  />
                )}
              </ResumenReporteTerreno>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SolicitudApoyoCuadrillaCard;
