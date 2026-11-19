'use client';

import React, { useState, useEffect, useId, useMemo } from 'react';
import {
  CheckCircle,
  ClipboardCheck,
  Clock,
  Package,
  Plus,
  Trash2,
  AlertTriangle,
  HeartHandshake,
  Truck,
  FileText,
  Camera,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import {
  AlertaFeedbackReporte,
  BloqueFormularioReporte,
  CampoResumenReporte,
  ContadorCaracteresReporte,
  NotaInformativaReporte,
  ResumenReporteTerreno,
  StepperNumericoReporte,
  SwitchReporteTerreno,
  formatearAutorReporte,
  type FeedbackReporteState,
} from './ReporteTerrenoBase';
import { ModalConfirmacionCierreCuadrilla } from './ModalConfirmacionCierreCuadrilla';
import {
  ESTADOS_TERRENO_CUADRILLA,
  HORAS_HOMBRE_MAX,
  RESUMEN_FAENAS_MIN,
  TEXTAREA_MAX,
  VALORES_INICIALES_CIERRE_CUADRILLA,
} from '@/lib/validations/cierreCuadrilla';
import {
  cerrarMisionCuadrilla,
  obtenerRecursosDisponiblesCuadrilla,
  obtenerReporteCierreCuadrillaMision,
  type ResultadoCierreCuadrilla,
} from '@/services/cierreCuadrillaService';
import { extraerAdjuntosDeMision } from '@/services/offlineQueue';
import { formatearEstadoTerreno } from '@/lib/utils/formatters';
import { obtenerVarianteChipEstadoTerreno } from '@/lib/utils/chipVariants';
import type {
  AdjuntoLocal,
  CierreMisionCuadrillaForm,
  EstadoTerrenoCierreCuadrilla,
  MaterialConsumidoFormItem,
  MisionLocal,
  RecursoCatalogoConsumible,
} from '@/types/offline';
import styles from './CierreMisionCuadrillaCard.module.css';

const DESCRIPCIONES_ESTADO_TERRENO: Record<EstadoTerrenoCierreCuadrilla, string> = {
  FINALIZADO: 'Trabajos concluidos al 100% y vía o sector habilitado',
  CONTROLADO: 'Riesgo contenido y emergencia mitigada bajo control',
  ESTABLE: 'Situación estabilizada sin peligro inmediato de agravamiento',
  REQUIERE_SEGUIMIENTO: 'Faena ejecutada; requiere monitoreo o segunda intervención',
  CRITICO: 'Persiste condición crítica que exige escalamiento técnico mayor',
  INACCESIBLE: 'Imposibilidad física de acceso o bloqueo total de la zona',
};

const PRESETS_HORAS_HOMBRE = [
  { valor: 1, etiqueta: '1 h' },
  { valor: 2, etiqueta: '2 h' },
  { valor: 4, etiqueta: '4 h' },
  { valor: 8, etiqueta: '8 h' },
];

export interface CierreMisionCuadrillaCardProps {
  misionActual: MisionLocal;
  adjuntosMision?: AdjuntoLocal[];
  usuarioActualId?: string;
  deshabilitado?: boolean;
  onCierreEnviado?: (resultado: ResultadoCierreCuadrilla) => void;
  onIrAEvidencia?: () => void;
}

export function CierreMisionCuadrillaCard({
  misionActual,
  adjuntosMision,
  deshabilitado = false,
  onCierreEnviado,
  onIrAEvidencia,
}: CierreMisionCuadrillaCardProps) {
  const resumenId = useId();
  const horasId = useId();
  const danosId = useId();
  const observacionesId = useId();

  const reporteExistente = useMemo(
    () => obtenerReporteCierreCuadrillaMision(misionActual),
    [misionActual]
  );

  const estadoMisionNorm = (misionActual.estado || '').toUpperCase();
  const yaEnviado =
    Boolean(reporteExistente) ||
    Boolean(misionActual?.datosAdicionales?.reporteCuadrillaEnviado) ||
    estadoMisionNorm === 'COMPLETADA' ||
    estadoMisionNorm === 'FINALIZADA';

  const [form, setForm] = useState<CierreMisionCuadrillaForm>(() => ({
    ...VALORES_INICIALES_CIERRE_CUADRILLA,
  }));

  const [recursosCatalogo, setRecursosCatalogo] = useState<
    RecursoCatalogoConsumible[]
  >([]);
  const [guardando, setGuardando] = useState<boolean>(false);
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackReporteState | null>(null);
  const [modalConfirmacionAbierto, setModalConfirmacionAbierto] =
    useState<boolean>(false);

  useEffect(() => {
    let cancelado = false;
    obtenerRecursosDisponiblesCuadrilla(misionActual)
      .then((lista) => {
        if (!cancelado) {
          setRecursosCatalogo(lista);
        }
      })
      .catch(() => {
        if (!cancelado) {
          setRecursosCatalogo([]);
        }
      });
    return () => {
      cancelado = true;
    };
  }, [misionActual]);

  const recursosConsumibles = useMemo(
    () => recursosCatalogo.filter((r) => !r.esIndividual),
    [recursosCatalogo]
  );

  const equiposRetornablesAsignados = useMemo(
    () => recursosCatalogo.filter((r) => r.esIndividual && r.asignadoACuadrilla),
    [recursosCatalogo]
  );

  const listaAdjuntos = useMemo(
    () => adjuntosMision ?? extraerAdjuntosDeMision(misionActual),
    [adjuntosMision, misionActual]
  );

  const adjuntosSincronizados = useMemo(
    () =>
      listaAdjuntos.filter(
        (a) => !a.sincronizacionPendiente && !a.id.startsWith('local-')
      ),
    [listaAdjuntos]
  );

  const adjuntosPendientes = useMemo(
    () =>
      listaAdjuntos.filter(
        (a) => Boolean(a.sincronizacionPendiente) || a.id.startsWith('local-')
      ),
    [listaAdjuntos]
  );

  const resumenLimpio = form.resumen_faenas.trim();
  const resumenValido = resumenLimpio.length >= RESUMEN_FAENAS_MIN;
  const horasValidas =
    Number.isFinite(form.horas_hombre) &&
    form.horas_hombre > 0 &&
    form.horas_hombre <= HORAS_HOMBRE_MAX;

  const fechaReporteCierre =
    reporteExistente?.creadoEn ||
    (typeof misionActual?.datosAdicionales?.reporteCuadrillaEnviadoEn === 'string'
      ? misionActual.datosAdicionales.reporteCuadrillaEnviadoEn
      : typeof misionActual?.datosAdicionales?.fechaCierre === 'string'
        ? misionActual.datosAdicionales.fechaCierre
        : misionActual?.actualizadoEn);

  const estadoTerrenoActual =
    reporteExistente?.estado_terreno || form.estado_terreno || 'FINALIZADO';

  const handleAgregarFilaMaterial = () => {
    setErrorValidacion(null);
    const usados = new Set(form.materiales_consumidos.map((m) => m.recurso_id));
    const disponible = recursosConsumibles.find((r) => !usados.has(r.id));

    setForm((prev) => ({
      ...prev,
      materiales_consumidos: [
        ...prev.materiales_consumidos,
        {
          recurso_id: disponible?.id || '',
          nombre: disponible?.nombre,
          cantidad: 1,
          unidad: disponible?.unidad || '',
          observacion: '',
        },
      ],
    }));
  };

  const handleEliminarFilaMaterial = (index: number) => {
    setErrorValidacion(null);
    setForm((prev) => ({
      ...prev,
      materiales_consumidos: prev.materiales_consumidos.filter(
        (_, i) => i !== index
      ),
    }));
  };

  const handleCambiarRecursoMaterial = (index: number, recursoId: string) => {
    setErrorValidacion(null);
    const recurso = recursosConsumibles.find((r) => r.id === recursoId);
    setForm((prev) => ({
      ...prev,
      materiales_consumidos: prev.materiales_consumidos.map((item, i) =>
        i === index
          ? {
              ...item,
              recurso_id: recursoId,
              nombre: recurso?.nombre,
              unidad: recurso?.unidad || item.unidad || '',
            }
          : item
      ),
    }));
  };

  const handleCambiarCampoMaterial = (
    index: number,
    cambios: Partial<MaterialConsumidoFormItem>
  ) => {
    setErrorValidacion(null);
    setForm((prev) => ({
      ...prev,
      materiales_consumidos: prev.materiales_consumidos.map((item, i) =>
        i === index ? { ...item, ...cambios } : item
      ),
    }));
  };

  const enfocarElemento = (elementId: string) => {
    if (typeof document === 'undefined') return;
    const el = document.getElementById(elementId);
    if (el) {
      el.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      el.focus?.();
    }
  };

  const handlePreConfirmar = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorValidacion(null);
    setFeedback(null);

    if (!resumenValido) {
      setErrorValidacion(
        `El resumen de faenas ejecutadas es obligatorio y debe contener al menos ${RESUMEN_FAENAS_MIN} caracteres (actual: ${resumenLimpio.length}).`
      );
      enfocarElemento(resumenId);
      return;
    }

    if (!horasValidas) {
      setErrorValidacion(
        `Las horas hombre invertidas deben ser mayores a 0 y no superar las ${HORAS_HOMBRE_MAX} horas.`
      );
      enfocarElemento(horasId);
      return;
    }

    const recursosVistos = new Set<string>();
    for (let i = 0; i < form.materiales_consumidos.length; i++) {
      const mat = form.materiales_consumidos[i];
      if (!mat.recurso_id) {
        setErrorValidacion(
          `Seleccione un material válido en la fila #${i + 1} de insumos consumidos o elimínela.`
        );
        return;
      }
      if (!Number.isFinite(mat.cantidad) || mat.cantidad <= 0) {
        setErrorValidacion(
          `La cantidad consumida en la fila #${i + 1} debe ser mayor a 0.`
        );
        return;
      }
      if (recursosVistos.has(mat.recurso_id)) {
        setErrorValidacion(
          `El material "${mat.nombre || mat.recurso_id}" está duplicado. Consolide la cantidad en una sola fila.`
        );
        return;
      }
      recursosVistos.add(mat.recurso_id);
    }

    setModalConfirmacionAbierto(true);
  };

  const handleEjecutarCierre = async () => {
    setModalConfirmacionAbierto(false);
    setGuardando(true);
    setErrorValidacion(null);

    try {
      const adjuntoIdsSincronizados = adjuntosSincronizados.map((a) => a.id);
      const adjuntosMetadata = adjuntosSincronizados.map((a) => ({
        id: a.id,
        nombreArchivo: a.nombreArchivo,
        url: a.url,
        tipoMime: a.tipoMime,
        tamanoBytes: a.tamanoBytes,
      }));
      const pendientesLocalIds = adjuntosPendientes.map((a) => a.id);

      const resultado = await cerrarMisionCuadrilla(
        misionActual.id,
        {
          ...form,
          adjunto_ids: adjuntoIdsSincronizados,
          adjuntos: adjuntosMetadata,
        },
        misionActual,
        pendientesLocalIds
      );

      setFeedback({
        tipo: resultado.offline ? 'offline' : 'success',
        texto: resultado.mensaje,
      });

      if (onCierreEnviado) {
        onCierreEnviado(resultado);
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Error al enviar el informe técnico final de cuadrilla.';
      setFeedback({
        tipo: 'error',
        texto: msg,
      });
    } finally {
      setGuardando(false);
    }
  };

  const estadoRequiereAlerta =
    form.estado_terreno === 'REQUIERE_SEGUIMIENTO' ||
    form.estado_terreno === 'CRITICO' ||
    form.estado_terreno === 'INACCESIBLE';

  return (
    <div
      className={styles.container}
      role="group"
      aria-label="Informe técnico final de cuadrilla y cierre de misión"
    >
      <AlertaFeedbackReporte
        feedback={feedback}
        errorValidacion={errorValidacion}
      />

      {yaEnviado ? (
        <ResumenReporteTerreno
          testId="resumen-cierre-cuadrilla"
          titulo="Informe Técnico Final de Cuadrilla (Cierre de Misión)"
          chip={
            <Chip
              variant={obtenerVarianteChipEstadoTerreno(estadoTerrenoActual)}
              size="sm"
            >
              {formatearEstadoTerreno(estadoTerrenoActual)}
            </Chip>
          }
          registradoPor={formatearAutorReporte(
            reporteExistente?.evaluador,
            fechaReporteCierre,
            'Delegado de Cuadrilla'
          )}
        >
          {reporteExistente && (
            <>
              <CampoResumenReporte
                label="Resumen de Faenas Ejecutadas"
                valor={reporteExistente.resumen_faenas}
                esBloqueTexto
              />

              <CampoResumenReporte
                label="Horas Hombre Invertidas"
                valor={`${reporteExistente.horas_hombre} h`}
              />

              <CampoResumenReporte
                label="Estado Final del Terreno"
                valor={formatearEstadoTerreno(reporteExistente.estado_terreno)}
              />

              <CampoResumenReporte
                label="Materiales e Insumos Consumidos"
                valor={
                  reporteExistente.materiales_consumidos &&
                  reporteExistente.materiales_consumidos.length > 0 ? (
                    <ul className={styles.materialResumenList}>
                      {reporteExistente.materiales_consumidos.map((mat, idx) => (
                        <li key={`${mat.recurso_id}-${idx}`}>
                          <strong>{mat.nombre || mat.recurso_id}:</strong>{' '}
                          {mat.cantidad}
                          {mat.unidad ? ` ${mat.unidad}` : ''}
                          {mat.observacion ? ` (${mat.observacion})` : ''}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    'Sin materiales consumidos registrados'
                  )
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

              <CampoResumenReporte
                label="Apoyo Adicional / Seguimiento"
                valor={
                  reporteExistente.requiere_apoyo_adicional
                    ? 'Requiere apoyo adicional o seguimiento operativo'
                    : 'No requiere apoyo adicional'
                }
              />

              <CampoResumenReporte
                label="Asistencia Social (Ficha FIBE)"
                valor={
                  reporteExistente.requiere_asistencia_social
                    ? 'Requiere levantamiento social (FIBE)'
                    : 'No requiere asistencia social'
                }
              />
            </>
          )}
        </ResumenReporteTerreno>
      ) : (
        <form onSubmit={handlePreConfirmar} className={styles.form} noValidate>
          {/* 1. Resumen de Faenas Ejecutadas */}
          <BloqueFormularioReporte
            icono={<ClipboardCheck size={16} aria-hidden="true" />}
            titulo="1. Resumen de Faenas Ejecutadas"
          >
            <div className={styles.fieldGroup}>
              <Textarea
                id={resumenId}
                label="Detalle Técnico de Trabajos Realizados"
                requiredIndicator
                rows={4}
                maxLength={TEXTAREA_MAX}
                value={form.resumen_faenas}
                onChange={(e) => {
                  setForm((prev) => ({
                    ...prev,
                    resumen_faenas: e.target.value,
                  }));
                  setErrorValidacion(null);
                }}
                placeholder="Describa las labores técnicas ejecutadas por la cuadrilla (ej. despeje de calzada, succión con motobomba, contención con sacos de arena)"
                disabled={deshabilitado || guardando}
                aria-describedby={`${resumenId}-counter`}
                className={styles.textareaField}
              />
              <ContadorCaracteresReporte
                id={`${resumenId}-counter`}
                actual={resumenLimpio.length}
                minimo={RESUMEN_FAENAS_MIN}
                maximo={TEXTAREA_MAX}
              />
            </div>
          </BloqueFormularioReporte>

          {/* 2. Horas Hombre y Estado Final del Terreno */}
          <BloqueFormularioReporte
            icono={<Clock size={16} aria-hidden="true" />}
            titulo="2. Horas Hombre y Estado del Terreno"
          >
            <div className={styles.horasCard}>
              <label htmlFor={horasId} className={styles.fieldLabel}>
                Horas Hombre Invertidas{' '}
                <span className={styles.requiredMark}>*</span>
              </label>
              <span className={styles.fieldHint}>
                Esfuerzo total invertido por la dotación (integrantes × horas de
                faena).
              </span>
              <StepperNumericoReporte
                id={horasId}
                valor={form.horas_hombre}
                min={0.5}
                max={HORAS_HOMBRE_MAX}
                step={0.5}
                presets={PRESETS_HORAS_HOMBRE}
                disabled={deshabilitado || guardando}
                ariaLabelInput="Horas hombre invertidas"
                ariaLabelDecrementar="Disminuir horas hombre"
                ariaLabelIncrementar="Aumentar horas hombre"
                onChange={(nuevoValor) => {
                  setForm((prev) => ({ ...prev, horas_hombre: nuevoValor }));
                  setErrorValidacion(null);
                }}
              />
            </div>

            <div className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>
                Estado Final del Terreno{' '}
                <span className={styles.requiredMark}>*</span>
              </span>
              <div
                className={styles.estadoGrid}
                role="radiogroup"
                aria-label="Estado final del terreno"
              >
                {ESTADOS_TERRENO_CUADRILLA.map((opcion) => {
                  const seleccionado = form.estado_terreno === opcion;
                  const esPeligro =
                    opcion === 'CRITICO' || opcion === 'INACCESIBLE';
                  const esAdvertencia = opcion === 'REQUIERE_SEGUIMIENTO';

                  let claseSeleccion = styles.estadoBtnSelectedTeal;
                  if (esPeligro) {
                    claseSeleccion = styles.estadoBtnSelectedDanger;
                  } else if (esAdvertencia) {
                    claseSeleccion = styles.estadoBtnSelectedWarning;
                  }

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
                          estado_terreno: opcion,
                        }));
                        setErrorValidacion(null);
                      }}
                      className={`${styles.estadoBtn} ${
                        seleccionado ? claseSeleccion : ''
                      }`}
                    >
                      <span className={styles.estadoBtnTitle}>
                        <span>{formatearEstadoTerreno(opcion)}</span>
                      </span>
                      <span className={styles.estadoBtnDesc}>
                        {DESCRIPCIONES_ESTADO_TERRENO[opcion]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {estadoRequiereAlerta && (
              <NotaInformativaReporte>
                Ha seleccionado un estado que requiere atención posterior. Detalle
                las acciones pendientes en Observaciones y active el interruptor de
                Apoyo Adicional si corresponde.
              </NotaInformativaReporte>
            )}
          </BloqueFormularioReporte>

          {/* 3. Materiales e Insumos Consumidos (Opcional) */}
          <BloqueFormularioReporte
            icono={<Package size={16} aria-hidden="true" />}
            titulo="3. Materiales e Insumos Consumidos (Opcional)"
          >
            {equiposRetornablesAsignados.length > 0 && (
              <NotaInformativaReporte>
                Los vehículos y equipos individuales asignados a la cuadrilla (
                {equiposRetornablesAsignados.map((e) => e.nombre).join(', ')}) son
                retornables y se liberan automáticamente al finalizar la misión;
                registre aquí únicamente insumos consumibles (ej. sacos de arena).
              </NotaInformativaReporte>
            )}

            {form.materiales_consumidos.length > 0 && (
              <div className={styles.materialRowsList}>
                {form.materiales_consumidos.map((fila, idx) => {
                  const recursoSeleccionado = recursosConsumibles.find(
                    (r) => r.id === fila.recurso_id
                  );
                  const maxStockReferencia =
                    recursoSeleccionado?.cantidadAsignada ??
                    recursoSeleccionado?.cantidadDisponible ??
                    0;
                  const excedeStockReferencia =
                    maxStockReferencia > 0 && fila.cantidad > maxStockReferencia;

                  const opcionesSelect = recursosConsumibles.map((rec) => {
                    const usadoEnOtraFila = form.materiales_consumidos.some(
                      (m, mIdx) => mIdx !== idx && m.recurso_id === rec.id
                    );
                    const sufijoStock = rec.asignadoACuadrilla
                      ? ` (Asignado: ${rec.cantidadAsignada ?? rec.cantidadDisponible})`
                      : ` (Disponible: ${rec.cantidadDisponible})`;
                    return {
                      value: rec.id,
                      label: `${rec.nombre}${sufijoStock}`,
                      disabled: usadoEnOtraFila,
                    };
                  });

                  return (
                    <div
                      key={`material-row-${idx}`}
                      className={styles.materialRowCard}
                      data-testid={`fila-material-${idx}`}
                    >
                      <div className={styles.materialRowHeader}>
                        <span className={styles.materialRowTitle}>
                          Insumo #{idx + 1}
                        </span>
                        <button
                          type="button"
                          className={styles.removeMaterialBtn}
                          aria-label={`Eliminar insumo #${idx + 1}`}
                          disabled={deshabilitado || guardando}
                          onClick={() => handleEliminarFilaMaterial(idx)}
                        >
                          <Trash2 size={18} aria-hidden="true" />
                        </button>
                      </div>

                      <Select
                        label={`Material o Insumo #${idx + 1}`}
                        placeholder="Seleccione material consumido..."
                        options={opcionesSelect}
                        value={fila.recurso_id}
                        disabled={deshabilitado || guardando}
                        onChange={(e) =>
                          handleCambiarRecursoMaterial(idx, e.target.value)
                        }
                      />

                      <div className={styles.fieldGroup}>
                        <span className={styles.fieldLabel}>
                          Cantidad Consumida
                        </span>
                        <StepperNumericoReporte
                          valor={fila.cantidad}
                          min={0.5}
                          max={10000}
                          step={1}
                          disabled={deshabilitado || guardando}
                          ariaLabelInput={`Cantidad consumida insumo #${idx + 1}`}
                          ariaLabelDecrementar={`Disminuir cantidad insumo #${idx + 1}`}
                          ariaLabelIncrementar={`Aumentar cantidad insumo #${idx + 1}`}
                          onChange={(nuevaCantidad) =>
                            handleCambiarCampoMaterial(idx, {
                              cantidad: nuevaCantidad,
                            })
                          }
                        />
                      </div>

                      {excedeStockReferencia && (
                        <div className={styles.stockWarning} role="status">
                          <AlertTriangle
                            size={15}
                            aria-hidden="true"
                            style={{ flexShrink: 0, marginTop: '1px' }}
                          />
                          <span>
                            La cantidad ingresada ({fila.cantidad}) supera el saldo
                            de referencia registrado ({maxStockReferencia}).
                          </span>
                        </div>
                      )}

                      <div className={styles.materialSecondaryGrid}>
                        <Input
                          label="Unidad (opcional)"
                          placeholder="Ej: unidades, m, kg"
                          maxLength={50}
                          value={fila.unidad || ''}
                          disabled={deshabilitado || guardando}
                          onChange={(e) =>
                            handleCambiarCampoMaterial(idx, {
                              unidad: e.target.value,
                            })
                          }
                        />
                        <Input
                          label="Observación del insumo (opcional)"
                          placeholder="Ej: Dique de contención acceso norte"
                          maxLength={300}
                          value={fila.observacion || ''}
                          disabled={deshabilitado || guardando}
                          onChange={(e) =>
                            handleCambiarCampoMaterial(idx, {
                              observacion: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="md"
              icon={<Plus size={18} />}
              disabled={
                deshabilitado ||
                guardando ||
                recursosConsumibles.length === 0 ||
                form.materiales_consumidos.length >= recursosConsumibles.length
              }
              onClick={handleAgregarFilaMaterial}
            >
              Agregar material consumido
            </Button>
          </BloqueFormularioReporte>

          {/* 4. Observaciones, Daños y Escalamientos */}
          <BloqueFormularioReporte
            icono={<FileText size={16} aria-hidden="true" />}
            titulo="4. Observaciones, Daños y Escalamientos"
          >
            <div className={styles.fieldGroup}>
              <Textarea
                id={danosId}
                label="Daños Materiales Estimados (Opcional)"
                rows={2}
                maxLength={TEXTAREA_MAX}
                value={form.danos_estimados}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    danos_estimados: e.target.value,
                  }))
                }
                placeholder="Ej: Anegamiento menor en acceso peatonal sin daño estructural"
                disabled={deshabilitado || guardando}
                className={styles.textareaField}
              />
            </div>

            <div className={styles.fieldGroup}>
              <Textarea
                id={observacionesId}
                label="Observaciones Generales (Opcional)"
                rows={2}
                maxLength={TEXTAREA_MAX}
                value={form.observaciones}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    observaciones: e.target.value,
                  }))
                }
                placeholder=" Recomendaciones preventivas o coordinación con vecinos"
                disabled={deshabilitado || guardando}
                className={styles.textareaField}
              />
            </div>

            <SwitchReporteTerreno
              activo={form.requiere_apoyo_adicional}
              disabled={deshabilitado || guardando}
              icono={<Truck size={18} aria-hidden="true" />}
              etiqueta="Requiere apoyo adicional o seguimiento operativo"
              textoActivo="Solicitado"
              textoInactivo="No requerido"
              onChange={(activo) =>
                setForm((prev) => ({
                  ...prev,
                  requiere_apoyo_adicional: activo,
                }))
              }
            />

            <SwitchReporteTerreno
              activo={form.requiere_asistencia_social}
              disabled={deshabilitado || guardando}
              icono={<HeartHandshake size={18} aria-hidden="true" />}
              etiqueta="Requiere Asistencia Social (Levantamiento Ficha FIBE)"
              textoActivo="Solicitada"
              textoInactivo="No requerida"
              onChange={(activo) =>
                setForm((prev) => ({
                  ...prev,
                  requiere_asistencia_social: activo,
                }))
              }
            />
          </BloqueFormularioReporte>

          {/* 5. Evidencia Multimedia Vinculada (H43) */}
          <BloqueFormularioReporte
            icono={<Camera size={16} aria-hidden="true" />}
            titulo="5. Evidencia Multimedia Vinculada"
          >
            <div className={styles.evidenciaSummaryBox}>
              <div className={styles.evidenciaSummaryRow}>
                <span>
                  {listaAdjuntos.length === 0
                    ? 'No se han cargado fotografías ni videos en esta misión.'
                    : `${listaAdjuntos.length} evidencia(s) adjunta(s) (${adjuntosSincronizados.length} sincronizada(s)${
                        adjuntosPendientes.length > 0
                          ? `, ${adjuntosPendientes.length} en cola offline`
                          : ''
                      }).`}
                </span>
                {onIrAEvidencia && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onIrAEvidencia}
                  >
                    Ir a Evidencia Multimedia
                  </Button>
                )}
              </div>
              <span className={styles.fieldHint}>
                Las fotografías, videos y documentos PDF cargados en la tarjeta de
                Evidencia Multimedia se vincularán automáticamente a este informe
                técnico final.
              </span>
            </div>
          </BloqueFormularioReporte>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={guardando}
            disabled={deshabilitado || guardando}
            icon={<CheckCircle size={18} />}
            className={styles.submitBtn}
          >
            Finalizar Misión e Informe Técnico
          </Button>
        </form>
      )}

      <ModalConfirmacionCierreCuadrilla
        abierto={modalConfirmacionAbierto}
        resumenFaenas={resumenLimpio}
        horasHombre={form.horas_hombre}
        estadoTerreno={form.estado_terreno}
        materialesConsumidos={form.materiales_consumidos}
        requiereApoyoAdicional={form.requiere_apoyo_adicional}
        requiereAsistenciaSocial={form.requiere_asistencia_social}
        totalAdjuntosSincronizados={adjuntosSincronizados.length}
        totalAdjuntosPendientes={adjuntosPendientes.length}
        cargando={guardando}
        alConfirmar={() => void handleEjecutarCierre()}
        alCancelar={() => setModalConfirmacionAbierto(false)}
      />
    </div>
  );
}

export default CierreMisionCuadrillaCard;
