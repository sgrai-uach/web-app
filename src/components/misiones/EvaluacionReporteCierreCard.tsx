'use client';

import React, { useState, useEffect, useId, useMemo } from 'react';
import {
  CheckCircle,
  ClipboardCheck,
  AlertOctagon,
  Truck,
  Users,
  Plus,
  Minus,
  Info,
  HeartHandshake,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Textarea } from '@/components/ui/Textarea';
import { CargaEvidenciaCard } from './CargaEvidenciaCard';
import { FamiliasTerrenoSection } from './FamiliasTerrenoSection';
import { ModalConfirmacionReporteCierre } from './ModalConfirmacionReporteCierre';
import {
  AlertaFeedbackReporte,
  CampoResumenReporte,
  ResumenReporteTerreno,
  formatearAutorReporte,
  type FeedbackReporteState,
} from './ReporteTerrenoBase';
import {
  DICTAMENES_ATENCION,
  MOTIVO_NO_ABORDABLE_MIN,
  RESUMEN_TECNICO_MIN,
  VALORES_INICIALES_REPORTE_VERIFICACION,
} from '@/lib/validations/reporteVerificacion';
import {
  obtenerPersonasAfectadasPrevias,
  obtenerUltimoReportePrioridad,
} from '@/services/prioridadService';
import { validarCoherenciaFamiliaTerreno } from '@/lib/validations/prioridad';
import {
  enviarReporteVerificacionTerreno,
  obtenerReporteVerificacionMision,
  type ResultadoEnvioReporteVerificacion,
} from '@/services/reporteVerificacionService';
import { formatearDictamenAtencion } from '@/lib/utils/formatters';
import { extraerAdjuntosDeMision } from '@/services/offlineQueue';
import type {
  AdjuntoLocal,
  DictamenAtencion,
  FamiliaAfectadaItem,
  MisionLocal,
  ReporteVerificacionTerrenoForm,
} from '@/types/offline';
import styles from './EvaluacionReporteCierreCard.module.css';

const TEXTAREA_MAX = 2000;

export interface EvaluacionReporteCierreCardProps {
  misionActual: MisionLocal;
  usuarioActualId?: string;
  onReporteEnviado?: (resultado: ResultadoEnvioReporteVerificacion) => void;
  deshabilitado?: boolean;
}

export function EvaluacionReporteCierreCard({
  misionActual,
  onReporteEnviado,
  deshabilitado = false,
}: EvaluacionReporteCierreCardProps) {
  const motivoId = useId();
  const resumenId = useId();
  const personasId = useId();
  const danosId = useId();
  const observacionesId = useId();

  const reporteExistente = useMemo(
    () => obtenerReporteVerificacionMision(misionActual),
    [misionActual]
  );

  const infoPersonasPrevias = useMemo(
    () => obtenerPersonasAfectadasPrevias(misionActual),
    [misionActual]
  );

  const familiasPrevias = useMemo<FamiliaAfectadaItem[]>(() => {
    const ultimo = obtenerUltimoReportePrioridad(misionActual);
    return ultimo?.evaluacion?.familias ?? [];
  }, [misionActual]);

  const yaEnviado =
    Boolean(reporteExistente) ||
    Boolean(misionActual?.datosAdicionales?.reporteVerificacionEnviado);

  const [personasEditadasManualmente, setPersonasEditadasManualmente] =
    useState<boolean>(false);

  const [form, setForm] = useState<ReporteVerificacionTerrenoForm>(() => ({
    ...VALORES_INICIALES_REPORTE_VERIFICACION,
    personas_afectadas: infoPersonasPrevias.cantidad,
    familias: familiasPrevias,
  }));

  const [guardando, setGuardando] = useState<boolean>(false);
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);
  const [modalConfirmacionAbierto, setModalConfirmacionAbierto] =
    useState<boolean>(false);
  const [adjuntosEvidencia, setAdjuntosEvidencia] = useState<AdjuntoLocal[]>(() =>
    extraerAdjuntosDeMision(misionActual)
  );
  const reporteTerrenoIdActual =
    typeof misionActual.datosAdicionales?.reporteTerrenoId === 'string'
      ? misionActual.datosAdicionales.reporteTerrenoId
      : undefined;
  const [feedback, setFeedback] = useState<FeedbackReporteState | null>(null);

  // Sincronizar personas_afectadas desde HU-38 si el usuario no ha modificado el campo manualmente
  useEffect(() => {
    if (!yaEnviado && !personasEditadasManualmente) {
      setForm((prev) => ({
        ...prev,
        personas_afectadas: infoPersonasPrevias.cantidad,
      }));
    }
  }, [infoPersonasPrevias.cantidad, yaEnviado, personasEditadasManualmente]);

  const fechaReporteCierre =
    reporteExistente?.creadoEn ||
    (typeof misionActual?.datosAdicionales?.reporteVerificacionEnviadoEn === 'string'
      ? misionActual.datosAdicionales.reporteVerificacionEnviadoEn
      : misionActual?.actualizadoEn);

  const dictamenActual =
    reporteExistente?.dictamen ||
    String(
      misionActual?.datosAdicionales?.dictamenVerificacion || 'REQUIERE_CUADRILLA'
    );

  const esNoAbordable = form.dictamen === 'NO_ABORDABLE';
  const resumenLimpio = form.resumen_tecnico.trim();
  const motivoLimpio = form.motivo_no_abordable.trim();

  const resumenValido = resumenLimpio.length >= RESUMEN_TECNICO_MIN;
  const motivoValido = !esNoAbordable || motivoLimpio.length >= MOTIVO_NO_ABORDABLE_MIN;
  const formularioValido = resumenValido && motivoValido && form.personas_afectadas >= 0;

  const ajustarPersonas = (delta: number) => {
    setPersonasEditadasManualmente(true);
    setForm((prev) => ({
      ...prev,
      personas_afectadas: Math.max(0, Math.min(5000, prev.personas_afectadas + delta)),
    }));
    setErrorValidacion(null);
  };

  const handleCambioPersonasInput = (valorRaw: string) => {
    setPersonasEditadasManualmente(true);
    if (valorRaw === '') {
      setForm((prev) => ({ ...prev, personas_afectadas: 0 }));
      return;
    }
    const parsed = Number.parseInt(valorRaw, 10);
    if (!Number.isNaN(parsed)) {
      setForm((prev) => ({
        ...prev,
        personas_afectadas: Math.max(0, Math.min(5000, parsed)),
      }));
    }
    setErrorValidacion(null);
  };

  const handlePreConfirmar = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorValidacion(null);
    setFeedback(null);

    if (!resumenValido) {
      setErrorValidacion(
        `El resumen técnico del siniestro es obligatorio y debe contener al menos ${RESUMEN_TECNICO_MIN} caracteres (actual: ${resumenLimpio.length}).`
      );
      if (typeof document !== 'undefined') {
        const el = document.getElementById(resumenId);
        if (el) {
          el.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
          el.focus?.();
        }
      }
      return;
    }

    if (esNoAbordable && !motivoValido) {
      setErrorValidacion(
        `Cuando el dictamen es No abordable, el motivo es obligatorio y debe contener al menos ${MOTIVO_NO_ABORDABLE_MIN} caracteres (actual: ${motivoLimpio.length}).`
      );
      if (typeof document !== 'undefined') {
        const el = document.getElementById(motivoId);
        if (el) {
          el.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
          el.focus?.();
        }
      }
      return;
    }

    const familiasActuales = form.familias || [];
    if (form.requiere_asistencia_social) {
      if (familiasActuales.length === 0) {
        setErrorValidacion(
          'Cuando se requiere asistencia social (posterior FIBE), debe declarar al menos una familia afectada con sus datos de contacto preliminares.'
        );
        return;
      }
      for (let i = 0; i < familiasActuales.length; i++) {
        const erroresFam = validarCoherenciaFamiliaTerreno(familiasActuales[i], true);
        const primerError = Object.values(erroresFam)[0];
        if (primerError) {
          setErrorValidacion(`Familia #${i + 1}: ${primerError}`);
          return;
        }
      }
    } else if (familiasActuales.length > 0) {
      for (let i = 0; i < familiasActuales.length; i++) {
        const erroresFam = validarCoherenciaFamiliaTerreno(familiasActuales[i], false);
        const primerError = Object.values(erroresFam)[0];
        if (primerError) {
          setErrorValidacion(`Familia #${i + 1}: ${primerError}`);
          return;
        }
      }
    }

    setModalConfirmacionAbierto(true);
  };

  const handleEjecutarEnvio = async () => {
    setModalConfirmacionAbierto(false);
    setGuardando(true);
    setErrorValidacion(null);

    try {
      const resultado = await enviarReporteVerificacionTerreno(
        misionActual.id,
        {
          ...form,
          adjuntoIds: form.adjuntoIds || [],
          adjuntos: form.adjuntos || [],
        },
        misionActual
      );

      setFeedback({
        tipo: resultado.offline ? 'offline' : 'success',
        texto: resultado.mensaje,
      });

      if (onReporteEnviado) {
        onReporteEnviado(resultado);
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Error al enviar el informe técnico de verificación.';
      setFeedback({
        tipo: 'error',
        texto: msg,
      });
    } finally {
      setGuardando(false);
    }
  };

  const contadorResumenClase =
    resumenLimpio.length === 0
      ? ''
      : resumenValido
        ? styles.counterValid
        : styles.counterInvalid;

  const contadorMotivoClase =
    motivoLimpio.length === 0
      ? ''
      : motivoValido
        ? styles.counterValid
        : styles.counterInvalid;

  return (
    <div
      className={styles.container}
      role="group"
      aria-label="Informe técnico de verificación y cierre"
    >
      <AlertaFeedbackReporte
        feedback={feedback}
        errorValidacion={errorValidacion}
      />

      {yaEnviado ? (
        <ResumenReporteTerreno
          testId="resumen-reporte-cierre"
          titulo="Informe Técnico de Verificación y Cierre"
          chip={
            <Chip
              variant={dictamenActual === 'NO_ABORDABLE' ? 'danger' : 'success'}
              size="sm"
            >
              {formatearDictamenAtencion(dictamenActual)}
            </Chip>
          }
          registradoPor={formatearAutorReporte(
            reporteExistente?.evaluador,
            fechaReporteCierre,
            'Operador de Patrulla'
          )}
        >
          {reporteExistente && (
            <>
              <CampoResumenReporte
                label="Dictamen de Atención"
                valor={formatearDictamenAtencion(reporteExistente.dictamen)}
              />

              {reporteExistente.dictamen === 'NO_ABORDABLE' &&
                reporteExistente.motivo_no_abordable && (
                  <CampoResumenReporte
                    label="Motivo de No Abordabilidad"
                    valor={reporteExistente.motivo_no_abordable}
                    esBloqueTexto
                  />
                )}

              <CampoResumenReporte
                label="Resumen Técnico del Siniestro"
                valor={reporteExistente.resumen_tecnico}
                esBloqueTexto
              />

              <CampoResumenReporte
                label="Personas Damnificadas"
                valor={reporteExistente.personas_afectadas}
              />

              <CampoResumenReporte
                label="Asistencia Social (Ficha FIBE)"
                valor={
                  reporteExistente.requiere_asistencia_social
                    ? 'Requiere levantamiento social (FIBE)'
                    : 'No requiere asistencia social'
                }
              />

              {reporteExistente.danos_estimados && (
                <CampoResumenReporte
                  label="Daños Materiales Estimados"
                  valor={reporteExistente.danos_estimados}
                  esBloqueTexto
                />
              )}

              {reporteExistente.observaciones && (
                <CampoResumenReporte
                  label="Observaciones Generales"
                  valor={reporteExistente.observaciones}
                  esBloqueTexto
                />
              )}
            </>
          )}
        </ResumenReporteTerreno>
      ) : (
        <form onSubmit={handlePreConfirmar} className={styles.form} noValidate>
          {/* 1. Dictamen de Atención */}
          <div className={styles.blockSection}>
            <h4 className={styles.blockTitle}>
              <ClipboardCheck size={16} aria-hidden="true" />
              <span>1. Dictamen de Atención</span>
            </h4>

            <div
              className={styles.dictamenGrid}
              role="radiogroup"
              aria-label="Dictamen de atención operativa"
            >
              {DICTAMENES_ATENCION.map((opcion) => {
                const seleccionado = form.dictamen === opcion;
                const esOpNoAbordable = opcion === 'NO_ABORDABLE';
                return (
                  <button
                    key={opcion}
                    type="button"
                    role="radio"
                    aria-checked={seleccionado}
                    disabled={deshabilitado || guardando}
                    onClick={() => {
                      setForm((prev) => ({
                        ...prev,
                        dictamen: opcion as DictamenAtencion,
                      }));
                      setErrorValidacion(null);
                    }}
                    className={`${styles.dictamenBtn} ${
                      seleccionado
                        ? esOpNoAbordable
                          ? styles.dictamenBtnSelectedDanger
                          : styles.dictamenBtnSelectedTeal
                        : ''
                    }`}
                  >
                    <span className={styles.dictamenBtnTitle}>
                      {esOpNoAbordable ? (
                        <AlertOctagon size={18} aria-hidden="true" />
                      ) : (
                        <Truck size={18} aria-hidden="true" />
                      )}
                      <span>{formatearDictamenAtencion(opcion)}</span>
                    </span>
                    <span className={styles.dictamenBtnDesc}>
                      {esOpNoAbordable
                        ? 'Predio privado inaccesible, faja fiscal externa o falsa alarma'
                        : 'Emergencia validada que requiere despacho de cuadrilla'}
                    </span>
                  </button>
                );
              })}
            </div>

            {esNoAbordable && (
              <div className={styles.noAbordablePanel}>
                <div className={styles.noAbordableNotice} role="note">
                  <AlertOctagon
                    size={16}
                    aria-hidden="true"
                    style={{ flexShrink: 0, marginTop: '2px' }}
                  />
                  <span>
                    Al enviar este dictamen, la misión cerrará y el incidente pasará
                    a estado No abordable, liberando la patrulla a Disponible.
                  </span>
                </div>

                <div className={styles.fieldGroup}>
                  <Textarea
                    id={motivoId}
                    label="Motivo de No Abordabilidad"
                    requiredIndicator
                    rows={3}
                    maxLength={TEXTAREA_MAX}
                    value={form.motivo_no_abordable}
                    onChange={(e) => {
                      setForm((prev) => ({
                        ...prev,
                        motivo_no_abordable: e.target.value,
                      }));
                      setErrorValidacion(null);
                    }}
                    placeholder="Detalle fundadamente por qué la emergencia no es abordable por cuadrillas municipales (mínimo 15 caracteres)"
                    disabled={deshabilitado || guardando}
                    aria-describedby={`${motivoId}-counter`}
                    className={styles.textareaField}
                  />
                  <div id={`${motivoId}-counter`} className={styles.counterRow}>
                    <span>Mínimo {MOTIVO_NO_ABORDABLE_MIN} caracteres</span>
                    <span className={contadorMotivoClase || undefined}>
                      {motivoLimpio.length} / {TEXTAREA_MAX}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. Diagnóstico Técnico y Terreno */}
          <div className={styles.blockSection}>
            <h4 className={styles.blockTitle}>
              <FileText size={16} aria-hidden="true" />
              <span>2. Diagnóstico Técnico y Terreno</span>
            </h4>

            <div className={styles.fieldGroup}>
              <Textarea
                id={resumenId}
                label="Resumen técnico del siniestro"
                requiredIndicator
                rows={4}
                maxLength={TEXTAREA_MAX}
                value={form.resumen_tecnico}
                onChange={(e) => {
                  setForm((prev) => ({
                    ...prev,
                    resumen_tecnico: e.target.value,
                  }));
                  setErrorValidacion(null);
                }}
                placeholder="Describa el diagnóstico consolidado de la emergencia observado en terreno (mínimo 10 caracteres)"
                disabled={deshabilitado || guardando}
                aria-describedby={`${resumenId}-counter`}
                className={styles.textareaField}
              />
              <div id={`${resumenId}-counter`} className={styles.counterRow}>
                <span>Mínimo {RESUMEN_TECNICO_MIN} caracteres</span>
                <span className={contadorResumenClase || undefined}>
                  {resumenLimpio.length} / {TEXTAREA_MAX}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Personas Damnificadas / Afectadas (precargado de HU-38) */}
          <div className={styles.blockSection}>
            <h4 className={styles.blockTitle}>
              <Users size={16} aria-hidden="true" />
              <span>3. Personas Damnificadas y Daños</span>
            </h4>

            <div className={styles.personasCard}>
              <label htmlFor={personasId} className={styles.fieldLabel}>
                Personas damnificadas / afectadas <span className={styles.requiredMark}>*</span>
              </label>

              <div className={styles.infoNote} role="note" data-testid="nota-personas-previas">
                <Info
                  size={16}
                  aria-hidden="true"
                  style={{ flexShrink: 0, marginTop: '2px' }}
                />
                <span>
                  Rescatado de la evaluación de prioridad previa; puede modificarlo
                  si constató un número distinto
                  {infoPersonasPrevias.evaluadorNombre
                    ? ` (evaluación previa registrada por ${infoPersonasPrevias.evaluadorNombre})`
                    : ''}
                  .
                </span>
              </div>

              <div className={styles.personasControlRow}>
                <button
                  type="button"
                  className={styles.counterBtn}
                  onClick={() => ajustarPersonas(-1)}
                  disabled={deshabilitado || guardando || form.personas_afectadas <= 0}
                  aria-label="Disminuir personas damnificadas"
                >
                  <Minus size={18} aria-hidden="true" />
                </button>

                <input
                  id={personasId}
                  type="number"
                  min={0}
                  max={5000}
                  step={1}
                  inputMode="numeric"
                  className={styles.personasNumberInput}
                  value={form.personas_afectadas}
                  disabled={deshabilitado || guardando}
                  onChange={(e) => handleCambioPersonasInput(e.target.value)}
                />

                <button
                  type="button"
                  className={styles.counterBtn}
                  onClick={() => ajustarPersonas(1)}
                  disabled={deshabilitado || guardando || form.personas_afectadas >= 5000}
                  aria-label="Aumentar personas damnificadas"
                >
                  <Plus size={18} aria-hidden="true" />
                </button>
              </div>
            </div>

            <Textarea
              id={danosId}
              label="Daños materiales estimados (opcional)"
              rows={3}
              maxLength={TEXTAREA_MAX}
              value={form.danos_estimados}
              disabled={deshabilitado || guardando}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  danos_estimados: e.target.value,
                }))
              }
              placeholder="Detalle afectación en viviendas, cercos, vehículos o infraestructura pública"
              className={styles.textareaField}
            />

            <Textarea
              id={observacionesId}
              label="Observaciones generales (opcional)"
              rows={3}
              maxLength={TEXTAREA_MAX}
              value={form.observaciones}
              disabled={deshabilitado || guardando}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  observaciones: e.target.value,
                }))
              }
              placeholder="Indique condiciones de acceso, seguridad vial o recomendaciones para la cuadrilla"
              className={styles.textareaField}
            />
          </div>

          {/* 4. Asistencia Social (Ficha FIBE) y Evidencia Multimedia */}
          <div className={styles.blockSection}>
            <h4 className={styles.blockTitle}>
              <HeartHandshake size={16} aria-hidden="true" />
              <span>4. Derivación Social y Evidencia</span>
            </h4>

            <button
              type="button"
              role="switch"
              aria-checked={form.requiere_asistencia_social}
              disabled={deshabilitado || guardando}
              onClick={() =>
                setForm((prev) => {
                  const siguienteEstado = !prev.requiere_asistencia_social;
                  const familiasActuales = prev.familias || [];
                  let familiasActualizadas = familiasActuales;
                  if (siguienteEstado && familiasActuales.length === 0) {
                    familiasActualizadas = [
                      {
                        id: `fam-${Date.now()}`,
                        referencia: '',
                        nucleoFamiliarTotal: Math.max(1, prev.personas_afectadas),
                        cantidadNinos: 0,
                        cantidadAdultosMayores: 0,
                        personasDiscapacitadas: 0,
                        personasElectrodependientes: 0,
                        mascotasAfectadas: 0,
                        nivelCompromisoVivienda: 'SIN_DANO' as const,
                        contactoNombre: '',
                        contactoTelefono: '',
                        contactoRut: '',
                      },
                    ];
                  } else if (
                    siguienteEstado &&
                    familiasActuales.length === 1 &&
                    familiasActuales[0].nucleoFamiliarTotal === 0
                  ) {
                    familiasActualizadas = [
                      {
                        ...familiasActuales[0],
                        nucleoFamiliarTotal: Math.max(1, prev.personas_afectadas),
                      },
                    ];
                  }
                  return {
                    ...prev,
                    requiere_asistencia_social: siguienteEstado,
                    familias: familiasActualizadas,
                  };
                })
              }
              className={`${styles.fibeSwitchBtn} ${
                form.requiere_asistencia_social ? styles.fibeSwitchActive : ''
              }`}
            >
              <span className={styles.fibeSwitchLabelGroup}>
                <HeartHandshake size={18} aria-hidden="true" />
                <span>Requiere Asistencia Social (Levantamiento Ficha FIBE)</span>
              </span>
              <span className={styles.switchStateTag}>
                {form.requiere_asistencia_social ? 'Sí' : 'No'}
              </span>
            </button>

            <FamiliasTerrenoSection
              titulo={
                form.requiere_asistencia_social
                  ? 'Catastro Preliminar por Familia (Contacto Obligatorio)'
                  : 'Catastro Preliminar por Familia (Opcional)'
              }
              familias={form.familias || []}
              contactoObligatorio={form.requiere_asistencia_social}
              permitirListaVacia={!form.requiere_asistencia_social}
              disabled={deshabilitado || guardando}
              onChange={(familiasActualizadas) => {
                const totalFamilias = familiasActualizadas.reduce(
                  (acc, f) => acc + f.nucleoFamiliarTotal,
                  0
                );
                setForm((prev) => ({
                  ...prev,
                  familias: familiasActualizadas,
                  ...(familiasActualizadas.length > 0
                    ? { personas_afectadas: totalFamilias }
                    : {}),
                }));
                setErrorValidacion(null);
              }}
            />

            <CargaEvidenciaCard
              misionId={misionActual.id}
              incidenteId={misionActual.incidenteId}
              reporteTerrenoId={reporteTerrenoIdActual}
              adjuntos={adjuntosEvidencia}
              soloLectura={deshabilitado || guardando}
              alAdjuntarEvidencia={(adjunto) => {
                setAdjuntosEvidencia((prev) => [
                  adjunto,
                  ...prev.filter((item) => item.id !== adjunto.id),
                ]);
                setForm((prev) => ({
                  ...prev,
                  adjuntoIds: prev.adjuntoIds?.includes(adjunto.id)
                    ? prev.adjuntoIds
                    : [...(prev.adjuntoIds ?? []), adjunto.id],
                  adjuntos: [
                    ...(prev.adjuntos ?? []).filter((item) => item.id !== adjunto.id),
                    {
                      id: adjunto.id,
                      nombreArchivo: adjunto.nombreArchivo,
                      url: adjunto.url,
                      tipoMime: adjunto.tipoMime,
                      tamanoBytes: adjunto.tamanoBytes,
                    },
                  ],
                }));
              }}
            />
          </div>

          {!formularioValido && !errorValidacion && (
            <p
              role="note"
              style={{
                margin: 0,
                fontSize: '0.8rem',
                color: 'var(--color-text-muted, #5F676E)',
                textAlign: 'center',
              }}
            >
              Para enviar el reporte falta completar:{' '}
              {!resumenValido
                ? `resumen técnico (${resumenLimpio.length}/${RESUMEN_TECNICO_MIN} caracteres mínimos)`
                : `motivo de no abordabilidad (${motivoLimpio.length}/${MOTIVO_NO_ABORDABLE_MIN} caracteres mínimos)`}
              .
            </p>
          )}

          {errorValidacion && (
            <div
              role="alert"
              style={{
                padding: '10px 12px',
                backgroundColor: 'var(--color-danger-bg, #FFEBEE)',
                border: '1px solid var(--color-danger, #D32F2F)',
                color: 'var(--color-danger, #D32F2F)',
                fontSize: '0.8125rem',
                fontWeight: 500,
              }}
            >
              {errorValidacion}
            </div>
          )}

          <Button
            type="submit"
            variant={esNoAbordable ? 'destructive' : 'primary'}
            size="lg"
            fullWidth
            loading={guardando}
            disabled={deshabilitado || guardando}
            icon={<CheckCircle size={18} />}
            className={styles.submitBtn}
          >
            {guardando ? 'Enviando reporte...' : 'Enviar Reporte y Cerrar Tarea'}
          </Button>
        </form>
      )}

      <ModalConfirmacionReporteCierre
        abierto={modalConfirmacionAbierto}
        dictamen={form.dictamen}
        motivoNoAbordable={esNoAbordable ? motivoLimpio : undefined}
        resumenTecnico={resumenLimpio}
        personasAfectadas={form.personas_afectadas}
        requiereAsistenciaSocial={form.requiere_asistencia_social}
        familias={form.familias || []}
        cargando={guardando}
        alConfirmar={handleEjecutarEnvio}
        alCancelar={() => setModalConfirmacionAbierto(false)}
      />
    </div>
  );
}

export default EvaluacionReporteCierreCard;
