'use client';

import React, { useState, useEffect, useId, useMemo } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  WifiOff,
  CheckCircle2,
  ClipboardCheck,
  Edit3,
  Plus,
  Minus,
  Users,
  Baby,
  UserCheck,
  Accessibility,
  Zap,
  HeartHandshake,
  Home,
  ShieldAlert,
  History,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Textarea } from '@/components/ui/Textarea';
import { obtenerVarianteChipPrioridad } from '@/lib/utils/chipVariants';
import { ModalConfirmacionPrioridad } from './ModalConfirmacionPrioridad';
import {
  VALORES_INICIALES_EVALUACION_PRIORIDAD,
  PRIORIDADES_CANONICAS,
  NIVELES_COMPROMISO_VIVIENDA,
  calcularPrioridadSugerida,
} from '@/lib/validations/prioridad';
import {
  asignarPrioridadEnTerreno,
  obtenerUltimoReportePrioridad,
  solicitarCalculoPrioridad,
  type ResultadoAsignacionPrioridad,
} from '@/services/prioridadService';
import { formatearPrioridad } from '@/lib/utils/formatters';
import { ETIQUETAS_COMPROMISO_VIVIENDA } from '@/lib/utils/labels';
import type {
  EvaluacionTerrenoPrioridadForm,
  MisionLocal,
  NivelCompromisoVivienda,
  PrioridadIncidente,
} from '@/types/offline';
import styles from './EvaluacionPrioridadCard.module.css';

const JUSTIFICACION_MIN = 5;
const JUSTIFICACION_MAX = 1000;
const DETALLES_MAX = 1000;

export interface EvaluacionPrioridadCardProps {
  incidenteId: string;
  misionActual: MisionLocal;
  onPrioridadActualizada?: (resultado: ResultadoAsignacionPrioridad) => void;
  deshabilitado?: boolean;
}

interface ContadorConfig {
  campo: keyof Pick<
    EvaluacionTerrenoPrioridadForm,
    | 'nucleoFamiliarTotal'
    | 'cantidadNinos'
    | 'cantidadAdultosMayores'
    | 'personasDiscapacitadas'
    | 'personasElectrodependientes'
    | 'mascotasAfectadas'
    | 'viviendasAfectadas'
  >;
  etiqueta: string;
  icono: React.ReactNode;
}

const CONTADORES_AFECTACION: ContadorConfig[] = [
  {
    campo: 'nucleoFamiliarTotal',
    etiqueta: 'Tamaño núcleo familiar',
    icono: <Users size={16} aria-hidden="true" />,
  },
  {
    campo: 'cantidadNinos',
    etiqueta: 'Cantidad de niños',
    icono: <Baby size={16} aria-hidden="true" />,
  },
  {
    campo: 'cantidadAdultosMayores',
    etiqueta: 'Adultos mayores',
    icono: <UserCheck size={16} aria-hidden="true" />,
  },
  {
    campo: 'personasDiscapacitadas',
    etiqueta: 'Personas con discapacidad',
    icono: <Accessibility size={16} aria-hidden="true" />,
  },
  {
    campo: 'personasElectrodependientes',
    etiqueta: 'Personas electrodependientes',
    icono: <Zap size={16} aria-hidden="true" />,
  },
  {
    campo: 'mascotasAfectadas',
    etiqueta: 'Mascotas afectadas',
    icono: <HeartHandshake size={16} aria-hidden="true" />,
  },
  {
    campo: 'viviendasAfectadas',
    etiqueta: 'Viviendas afectadas',
    icono: <Home size={16} aria-hidden="true" />,
  },
];

interface SwitchPeligroConfig {
  campo: keyof Pick<
    EvaluacionTerrenoPrioridadForm,
    | 'riesgoElectrico'
    | 'riesgoEstructural'
    | 'riesgoQuimicoSanitario'
    | 'aislamientoVial'
    | 'requiereEvacuacion'
    | 'requiereAsistenciaSocial'
  >;
  etiqueta: string;
  esCritico?: boolean;
}

const SWITCHES_PELIGRO: SwitchPeligroConfig[] = [
  {
    campo: 'riesgoElectrico',
    etiqueta: 'Riesgo eléctrico activo',
    esCritico: true,
  },
  {
    campo: 'riesgoEstructural',
    etiqueta: 'Riesgo estructural / derrumbe',
    esCritico: true,
  },
  {
    campo: 'riesgoQuimicoSanitario',
    etiqueta: 'Riesgo químico o sanitario',
    esCritico: true,
  },
  {
    campo: 'requiereEvacuacion',
    etiqueta: 'Requiere evacuación inmediata',
    esCritico: true,
  },
  {
    campo: 'aislamientoVial',
    etiqueta: 'Aislamiento vial / corte de ruta',
  },
  {
    campo: 'requiereAsistenciaSocial',
    etiqueta: 'Requiere asistencia social (FIBE)',
  },
];

function obtenerClaseBotonPrioridadSeleccionada(
  prioridad: PrioridadIncidente
): string {
  switch (prioridad) {
    case 'CRITICA':
      return styles.priorityOptionSelectedCritica;
    case 'ALTA':
      return styles.priorityOptionSelectedAlta;
    case 'MEDIA':
      return styles.priorityOptionSelectedMedia;
    default:
      return styles.priorityOptionSelectedBaja;
  }
}

export function EvaluacionPrioridadCard({
  incidenteId,
  misionActual,
  onPrioridadActualizada,
  deshabilitado = false,
}: EvaluacionPrioridadCardProps) {
  const justificacionId = useId();
  const detallesId = useId();

  const ultimoReporte = useMemo(
    () => obtenerUltimoReportePrioridad(misionActual),
    [misionActual]
  );

  const yaEvaluada =
    Boolean(misionActual?.datosAdicionales?.prioridadEvaluada) ||
    Boolean(ultimoReporte);

  const [modoEdicion, setModoEdicion] = useState<boolean>(false);
  const [evaluacion, setEvaluacion] = useState<EvaluacionTerrenoPrioridadForm>(
    () =>
      ultimoReporte?.evaluacion
        ? { ...ultimoReporte.evaluacion }
        : { ...VALORES_INICIALES_EVALUACION_PRIORIDAD }
  );

  // Calcula la prioridad sugerida de manera reactiva e inmediata en cliente
  const calculoLocal = useMemo(
    () => calcularPrioridadSugerida(evaluacion),
    [evaluacion]
  );

  const [prioridadSugeridaRemota, setPrioridadSugeridaRemota] =
    useState<PrioridadIncidente | null>(null);
  const [factoresRemotos, setFactoresRemotos] = useState<string[] | null>(null);

  const prioridadSugerida: PrioridadIncidente =
    prioridadSugeridaRemota || calculoLocal.prioridadSugerida;
  const factoresGatillantes: string[] =
    factoresRemotos && factoresRemotos.length > 0
      ? factoresRemotos
      : calculoLocal.factoresGatillantes;

  // Controla si el patrullero eligió manualmente una prioridad distinta de la sugerida
  const [prioridadManual, setPrioridadManual] =
    useState<PrioridadIncidente | null>(() => {
      if (
        ultimoReporte &&
        ultimoReporte.prioridadAsignada !== ultimoReporte.prioridadSugerida
      ) {
        return ultimoReporte.prioridadAsignada;
      }
      return null;
    });

  const prioridadSeleccionada: PrioridadIncidente =
    prioridadManual ?? prioridadSugerida;

  const [justificacionPrioridad, setJustificacionPrioridad] = useState<string>(
    () =>
      ultimoReporte &&
      ultimoReporte.prioridadAsignada !== ultimoReporte.prioridadSugerida
        ? ultimoReporte.justificacionPrioridad
        : ''
  );

  const [guardando, setGuardando] = useState<boolean>(false);
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);
  const [modalConfirmacionAbierto, setModalConfirmacionAbierto] =
    useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    tipo: 'success' | 'offline' | 'error';
    texto: string;
  } | null>(null);

  // Sincronizar formulario si llega un último reporte nuevo desde misionActual
  useEffect(() => {
    if (ultimoReporte && !modoEdicion) {
      setEvaluacion({ ...ultimoReporte.evaluacion });
      if (ultimoReporte.prioridadAsignada !== ultimoReporte.prioridadSugerida) {
        setPrioridadManual(ultimoReporte.prioridadAsignada);
        setJustificacionPrioridad(ultimoReporte.justificacionPrioridad || '');
      } else {
        setPrioridadManual(null);
        setJustificacionPrioridad('');
      }
    }
  }, [ultimoReporte, modoEdicion]);

  // Consulta no bloqueante al endpoint de cálculo si está disponible
  useEffect(() => {
    let cancelado = false;
    setPrioridadSugeridaRemota(null);
    setFactoresRemotos(null);

    void (async () => {
      try {
        const res = await solicitarCalculoPrioridad(incidenteId, evaluacion);
        if (!cancelado) {
          setPrioridadSugeridaRemota(res.prioridadSugerida);
          setFactoresRemotos(res.factoresGatillantes);
        }
      } catch {
        // Fallback local ya está activo en calculoLocal
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [incidenteId, evaluacion]);

  const mostrarResumen = yaEvaluada && !modoEdicion;
  const siguienteVersionReporte = (ultimoReporte?.versionReporte || 0) + 1;

  const esDiscrepancia = prioridadSeleccionada !== prioridadSugerida;
  const justificacionLimpia = justificacionPrioridad.trim();
  const longitudJustificacion = justificacionLimpia.length;
  const esJustificacionValida =
    !esDiscrepancia ||
    (longitudJustificacion >= JUSTIFICACION_MIN &&
      longitudJustificacion <= JUSTIFICACION_MAX);

  const ajustarContador = (
    campo: ContadorConfig['campo'],
    delta: number
  ) => {
    setEvaluacion((prev) => {
      const actual = prev[campo] || 0;
      const nuevo = Math.max(0, Math.min(999, actual + delta));
      return {
        ...prev,
        [campo]: nuevo,
      };
    });
    setErrorValidacion(null);
  };

  const alternarSwitch = (campo: SwitchPeligroConfig['campo']) => {
    setEvaluacion((prev) => ({
      ...prev,
      [campo]: !prev[campo],
    }));
    setErrorValidacion(null);
  };

  const handleSeleccionarPrioridad = (nivel: PrioridadIncidente) => {
    if (nivel === prioridadSugerida) {
      setPrioridadManual(null);
    } else {
      setPrioridadManual(nivel);
    }
    setErrorValidacion(null);
  };

  const peligrosActivosCount = useMemo(
    () =>
      SWITCHES_PELIGRO.reduce(
        (acc, item) => acc + (evaluacion[item.campo] ? 1 : 0),
        0
      ),
    [evaluacion]
  );

  const handlePreConfirmar = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorValidacion(null);
    setFeedback(null);

    if (esDiscrepancia && !esJustificacionValida) {
      setErrorValidacion(
        'La justificación técnica es obligatoria y debe contener al menos 5 caracteres al modificar la prioridad sugerida.'
      );
      return;
    }

    setModalConfirmacionAbierto(true);
  };

  const handleEjecutarGuardado = async () => {
    setModalConfirmacionAbierto(false);
    setGuardando(true);
    setErrorValidacion(null);

    try {
      const resultado = await asignarPrioridadEnTerreno(
        incidenteId,
        {
          ...evaluacion,
          prioridad: prioridadSeleccionada,
          prioridadSugerida,
          justificacionPrioridad: esDiscrepancia ? justificacionLimpia : '',
          factoresGatillantes,
          misionId: misionActual.id,
          versionReporte: siguienteVersionReporte,
        },
        misionActual
      );

      setFeedback({
        tipo: resultado.offline ? 'offline' : 'success',
        texto: resultado.mensaje,
      });
      setModoEdicion(false);

      if (onPrioridadActualizada) {
        onPrioridadActualizada(resultado);
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Error al enviar el reporte de prioridad del incidente.';
      setFeedback({
        tipo: 'error',
        texto: msg,
      });
    } finally {
      setGuardando(false);
    }
  };

  const contadorClase =
    longitudJustificacion === 0
      ? ''
      : esJustificacionValida
        ? styles.counterValid
        : styles.counterInvalid;

  return (
    <div
      className={styles.container}
      role="group"
      aria-label="Evaluación en terreno y prioridad"
    >
      <div className={styles.infoRow}>
        <div className={styles.infoCol}>
          <span className={styles.infoLabel}>Prioridad vigente del incidente</span>
          <span className={styles.infoValue}>
            {formatearPrioridad(misionActual.prioridad)}
          </span>
        </div>
        {ultimoReporte && (
          <Chip variant="teal" size="sm">
            Reporte #{ultimoReporte.versionReporte}
          </Chip>
        )}
      </div>

      {feedback && (
        <div
          className={`${styles.alertBox} ${
            feedback.tipo === 'success'
              ? styles.alertSuccess
              : feedback.tipo === 'offline'
                ? styles.alertOffline
                : styles.alertError
          }`}
          role="status"
        >
          {feedback.tipo === 'success' && (
            <CheckCircle size={18} aria-hidden="true" className={styles.alertIcon} />
          )}
          {feedback.tipo === 'offline' && (
            <WifiOff size={18} aria-hidden="true" className={styles.alertIcon} />
          )}
          {feedback.tipo === 'error' && (
            <AlertTriangle size={18} aria-hidden="true" className={styles.alertIcon} />
          )}
          <span>{feedback.texto}</span>
        </div>
      )}

      {errorValidacion && (
        <div className={`${styles.alertBox} ${styles.alertError}`} role="alert">
          <AlertTriangle size={18} aria-hidden="true" className={styles.alertIcon} />
          <span>{errorValidacion}</span>
        </div>
      )}

      {/* Vista Resumen cuando ya existe una evaluación y no está en modo edición */}
      {mostrarResumen && ultimoReporte ? (
        <div className={styles.resumenCard} data-testid="resumen-prioridad">
          <div className={styles.resumenHeader}>
            <span className={styles.resumenTitulo}>
              <ClipboardCheck size={16} aria-hidden="true" />
              <span>Resumen de Evaluación y Prioridad</span>
            </span>
            <Chip variant="teal" size="sm">
              Reporte #{ultimoReporte.versionReporte}
            </Chip>
          </div>

          <div className={styles.resumenGrid}>
            <div className={styles.resumenItem}>
              <span className={styles.resumenLabel}>Prioridad Sugerida por Sistema</span>
              <span className={styles.resumenValor}>
                {formatearPrioridad(ultimoReporte.prioridadSugerida)}
              </span>
            </div>

            <div className={styles.resumenItem}>
              <span className={styles.resumenLabel}>Prioridad Asignada en Terreno</span>
              <span className={styles.resumenValor}>
                {formatearPrioridad(ultimoReporte.prioridadAsignada)}
              </span>
            </div>

            <div className={styles.resumenItem}>
              <span className={styles.resumenLabel}>Catastro de Afectación</span>
              <span className={styles.resumenValor}>
                {ultimoReporte.evaluacion.nucleoFamiliarTotal} personas (
                {ultimoReporte.evaluacion.cantidadNinos} niños,{' '}
                {ultimoReporte.evaluacion.cantidadAdultosMayores} adultos mayores,{' '}
                {ultimoReporte.evaluacion.personasDiscapacitadas} con discapacidad,{' '}
                {ultimoReporte.evaluacion.personasElectrodependientes}{' '}
                electrodependientes) · {ultimoReporte.evaluacion.viviendasAfectadas}{' '}
                viviendas (
                {
                  ETIQUETAS_COMPROMISO_VIVIENDA[
                    ultimoReporte.evaluacion.nivelCompromisoVivienda
                  ]
                }
                )
              </span>
            </div>

            {ultimoReporte.justificacionPrioridad && (
              <div className={styles.resumenItem}>
                <span className={styles.resumenLabel}>Justificación de Prioridad</span>
                <div className={styles.resumenJustificacion}>
                  {ultimoReporte.justificacionPrioridad}
                </div>
              </div>
            )}

            {ultimoReporte.evaluacion.detallesAdicionales && (
              <div className={styles.resumenItem}>
                <span className={styles.resumenLabel}>Detalles Adicionales</span>
                <div className={styles.resumenJustificacion}>
                  {ultimoReporte.evaluacion.detallesAdicionales}
                </div>
              </div>
            )}
          </div>

          {!deshabilitado && (
            <Button
              type="button"
              variant="outline"
              size="md"
              icon={<Edit3 size={16} />}
              onClick={() => {
                setEvaluacion({ ...ultimoReporte.evaluacion });
                if (
                  ultimoReporte.prioridadAsignada !==
                  ultimoReporte.prioridadSugerida
                ) {
                  setPrioridadManual(ultimoReporte.prioridadAsignada);
                  setJustificacionPrioridad(
                    ultimoReporte.justificacionPrioridad || ''
                  );
                } else {
                  setPrioridadManual(null);
                  setJustificacionPrioridad('');
                }
                setModoEdicion(true);
              }}
              className={styles.btnModificar}
            >
              Modificar y reenviar reporte
            </Button>
          )}
        </div>
      ) : (
        <form onSubmit={handlePreConfirmar} className={styles.form} noValidate>
          {siguienteVersionReporte > 1 && (
            <div className={styles.versionNotice} role="note">
              <History size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
              <span>
                Enviando actualización (Reporte #{siguienteVersionReporte}) — Los
                cambios quedarán registrados como un reporte distinto en el Centro
                de Mando y actualizarán la prioridad del incidente.
              </span>
            </div>
          )}

          {/* Bloque 1: Contadores numéricos táctiles de grupo familiar y vivienda */}
          <div className={styles.blockSection}>
            <h4 className={styles.blockTitle}>
              <Users size={16} aria-hidden="true" />
              <span>1. Grupo Familiar y Viviendas Afectadas</span>
            </h4>

            <div className={styles.countersGrid}>
              {CONTADORES_AFECTACION.map((item) => {
                const valorActual = evaluacion[item.campo];
                return (
                  <div key={item.campo} className={styles.counterCard}>
                    <div className={styles.counterLabelGroup}>
                      <span className={styles.counterIcon}>{item.icono}</span>
                      <span className={styles.counterLabel}>{item.etiqueta}</span>
                    </div>
                    <div className={styles.counterControls}>
                      <button
                        type="button"
                        className={styles.counterBtn}
                        onClick={() => ajustarContador(item.campo, -1)}
                        disabled={deshabilitado || guardando || valorActual <= 0}
                        aria-label={`Disminuir ${item.etiqueta}`}
                      >
                        <Minus size={18} aria-hidden="true" />
                      </button>
                      <span
                        className={styles.counterValue}
                        data-testid={`valor-${item.campo}`}
                      >
                        {valorActual}
                      </span>
                      <button
                        type="button"
                        className={styles.counterBtn}
                        onClick={() => ajustarContador(item.campo, 1)}
                        disabled={deshabilitado || guardando}
                        aria-label={`Aumentar ${item.etiqueta}`}
                      >
                        <Plus size={18} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={styles.fieldGroup}>
              <span className={styles.infoLabel}>
                Nivel de compromiso de vivienda
              </span>
              <div
                className={styles.prioritySelectorGrid}
                role="radiogroup"
                aria-label="Nivel de compromiso de vivienda"
              >
                {NIVELES_COMPROMISO_VIVIENDA.map((nivel) => {
                  const activo = evaluacion.nivelCompromisoVivienda === nivel;
                  return (
                    <button
                      key={nivel}
                      type="button"
                      role="radio"
                      aria-checked={activo}
                      disabled={deshabilitado || guardando}
                      onClick={() => {
                        setEvaluacion((prev) => ({
                          ...prev,
                          nivelCompromisoVivienda:
                            nivel as NivelCompromisoVivienda,
                        }));
                        setErrorValidacion(null);
                      }}
                      className={`${styles.priorityOptionBtn} ${
                        activo
                          ? nivel === 'GRAVE_INHABITABLE'
                            ? styles.priorityOptionSelectedCritica
                            : nivel === 'MODERADO'
                              ? styles.priorityOptionSelectedAlta
                              : styles.priorityOptionSelectedMedia
                          : ''
                      }`}
                    >
                      <span>{ETIQUETAS_COMPROMISO_VIVIENDA[nivel]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bloque 2: Switches táctiles de peligro activo y requerimientos */}
          <div className={styles.blockSection}>
            <h4 className={styles.blockTitle}>
              <AlertTriangle size={16} aria-hidden="true" />
              <span>2. Peligros Activos y Requerimientos en Terreno</span>
            </h4>

            <div className={styles.switchesGrid}>
              {SWITCHES_PELIGRO.map((sw) => {
                const activo = Boolean(evaluacion[sw.campo]);
                const claseActiva = sw.esCritico
                  ? styles.switchBtnDangerActive
                  : styles.switchBtnActive;
                return (
                  <button
                    key={sw.campo}
                    type="button"
                    role="switch"
                    aria-checked={activo}
                    onClick={() => alternarSwitch(sw.campo)}
                    disabled={deshabilitado || guardando}
                    className={`${styles.switchBtn} ${activo ? claseActiva : ''}`}
                  >
                    <span>{sw.etiqueta}</span>
                    <span className={styles.switchStateTag}>
                      {activo ? 'Sí' : 'No'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bloque 3: Visualización destacada de Prioridad Sugerida y Factores Gatillantes */}
          <div
            className={styles.sugeridaBox}
            data-testid="panel-prioridad-sugerida"
          >
            <div className={styles.sugeridaHeader}>
              <span className={styles.sugeridaTitle}>
                Prioridad Sugerida por el Sistema
              </span>
              <Chip
                variant={obtenerVarianteChipPrioridad(prioridadSugerida)}
                size="md"
                icon={<ShieldAlert size={14} />}
                data-testid="badge-prioridad-sugerida"
              >
                {formatearPrioridad(prioridadSugerida)}
              </Chip>
            </div>

            <ul className={styles.factoresList} aria-label="Factores gatillantes">
              {factoresGatillantes.map((factor) => (
                <li key={factor}>{factor}</li>
              ))}
            </ul>
          </div>

          {/* Bloque 4: Selector táctil con los 4 niveles canónicos de prioridad */}
          <div className={styles.blockSection}>
            <h4 className={styles.blockTitle}>
              <ShieldAlert size={16} aria-hidden="true" />
              <span>3. Selección de Prioridad del Incidente</span>
            </h4>

            <div
              className={styles.prioritySelectorGrid}
              role="radiogroup"
              aria-label="Nivel de prioridad del incidente"
            >
              {PRIORIDADES_CANONICAS.map((nivel) => {
                const seleccionado = prioridadSeleccionada === nivel;
                const esSugerida = prioridadSugerida === nivel;
                return (
                  <button
                    key={nivel}
                    type="button"
                    role="radio"
                    aria-checked={seleccionado}
                    onClick={() => handleSeleccionarPrioridad(nivel)}
                    disabled={deshabilitado || guardando}
                    className={`${styles.priorityOptionBtn} ${
                      seleccionado
                        ? obtenerClaseBotonPrioridadSeleccionada(nivel)
                        : ''
                    }`}
                  >
                    <span>{formatearPrioridad(nivel)}</span>
                    {esSugerida && (
                      <span className={styles.prioritySuggestedTag}>
                        Sugerida
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Bloque 5: Campo condicional obligatorio de justificación ante discrepancia */}
            {!esDiscrepancia ? (
              <div className={styles.ratificacionNotice} role="note">
                <CheckCircle2
                  size={16}
                  aria-hidden="true"
                  style={{ flexShrink: 0 }}
                />
                <span>
                  La prioridad seleccionada coincide con la prioridad sugerida por el
                  sistema. No se requiere justificación adicional.
                </span>
              </div>
            ) : (
              <div className={styles.fieldGroup}>
                <Textarea
                  id={justificacionId}
                  label="Justificación técnica del cambio de prioridad"
                  requiredIndicator
                  rows={3}
                  maxLength={JUSTIFICACION_MAX}
                  value={justificacionPrioridad}
                  onChange={(e) => {
                    setJustificacionPrioridad(e.target.value);
                    setErrorValidacion(null);
                  }}
                  placeholder="Explique los criterios técnicos constatados en terreno para asignar una prioridad distinta a la sugerida (mínimo 5 caracteres)"
                  disabled={deshabilitado || guardando}
                  aria-describedby={`${justificacionId}-counter`}
                  className={styles.textareaField}
                />
                <div
                  id={`${justificacionId}-counter`}
                  className={styles.counterRow}
                >
                  <span>Mínimo {JUSTIFICACION_MIN} caracteres</span>
                  <span className={contadorClase || undefined}>
                    {longitudJustificacion} / {JUSTIFICACION_MAX}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Bloque 6: Detalles adicionales para el Centro de Mando */}
          <div className={styles.fieldGroup}>
            <Textarea
              id={detallesId}
              label="Detalles adicionales del reporte (opcional)"
              rows={3}
              maxLength={DETALLES_MAX}
              value={evaluacion.detallesAdicionales}
              onChange={(e) =>
                setEvaluacion((prev) => ({
                  ...prev,
                  detallesAdicionales: e.target.value,
                }))
              }
              placeholder="Ingrese observaciones operativas adicionales, referencias de acceso o requerimientos específicos para el Centro de Mando"
              disabled={deshabilitado || guardando}
              className={styles.textareaField}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={guardando}
              disabled={deshabilitado || (esDiscrepancia && !esJustificacionValida)}
              icon={<CheckCircle size={18} />}
              className={styles.submitBtn}
            >
              {guardando
                ? 'Enviando reporte...'
                : siguienteVersionReporte > 1
                  ? `Enviar actualización (Reporte #${siguienteVersionReporte})`
                  : 'Confirmar prioridad y enviar reporte'}
            </Button>

            {modoEdicion && yaEvaluada && (
              <Button
                type="button"
                variant="outline"
                size="md"
                fullWidth
                disabled={guardando}
                onClick={() => {
                  setModoEdicion(false);
                  setErrorValidacion(null);
                }}
              >
                Cancelar modificación
              </Button>
            )}
          </div>
        </form>
      )}

      <ModalConfirmacionPrioridad
        abierto={modalConfirmacionAbierto}
        versionReporte={siguienteVersionReporte}
        prioridadSugerida={prioridadSugerida}
        prioridadSeleccionada={prioridadSeleccionada}
        esModificacionPrioridad={esDiscrepancia}
        justificacionPrioridad={justificacionLimpia}
        nucleoFamiliarTotal={evaluacion.nucleoFamiliarTotal}
        viviendasAfectadas={evaluacion.viviendasAfectadas}
        peligrosActivosCount={peligrosActivosCount}
        cargando={guardando}
        alConfirmar={handleEjecutarGuardado}
        alCancelar={() => setModalConfirmacionAbierto(false)}
      />
    </div>
  );
}

export default EvaluacionPrioridadCard;
