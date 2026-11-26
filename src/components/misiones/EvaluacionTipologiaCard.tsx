'use client';

import React, { useState, useEffect, useId, useRef, useLayoutEffect } from 'react';
import { CheckCircle, CheckCircle2, Tag } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { ModalConfirmacionTipologia } from './ModalConfirmacionTipologia';
import {
  AlertaFeedbackReporte,
  BloqueFormularioReporte,
  CampoResumenReporte,
  ResumenReporteTerreno,
  formatearAutorReporte,
  type FeedbackReporteState,
} from './ReporteTerrenoBase';
import {
  obtenerCatalogoTiposIncidente,
  reclasificarTipologiaEnTerreno,
  type ResultadoReclasificacionTipologia,
} from '@/services/tipologiaService';
import type {
  EvaluadorReporteTerreno,
  TipoIncidenteCatalogoItem,
  MisionLocal,
} from '@/types/offline';
import styles from './EvaluacionTipologiaCard.module.css';

const JUSTIFICACION_MIN = 5;
const JUSTIFICACION_MAX = 1000;
const TEXTAREA_ALTURA_MAX_PX = 240;

export interface EvaluacionTipologiaCardProps {
  incidenteId: string;
  misionActual: MisionLocal;
  usuarioActualId?: string;
  onTipologiaActualizada?: (resultado: ResultadoReclasificacionTipologia) => void;
  deshabilitado?: boolean;
}

/**
 * Formulario de categorización del incidente en terreno.
 * Soporta ratificación sin justificación obligatoria, reclasificación fundada,
 * modal accesible de confirmación previa y vista resumen al completarse.
 */
export function EvaluacionTipologiaCard({
  incidenteId,
  misionActual,
  onTipologiaActualizada,
  deshabilitado = false,
}: EvaluacionTipologiaCardProps) {
  const selectId = useId();
  const textareaId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [catalogo, setCatalogo] = useState<TipoIncidenteCatalogoItem[]>([]);
  const [cargandoCatalogo, setCargandoCatalogo] = useState<boolean>(true);
  const [tipoSeleccionadoId, setTipoSeleccionadoId] = useState<string>('');
  const [justificacion, setJustificacion] = useState<string>('');
  const [guardando, setGuardando] = useState<boolean>(false);
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);
  const [modalConfirmacionAbierto, setModalConfirmacionAbierto] = useState<boolean>(false);
  const [modoEdicion, setModoEdicion] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<FeedbackReporteState | null>(null);

  const tipologiaOriginal = (misionActual?.tipologia || '').trim();
  const yaEvaluada = Boolean(misionActual?.datosAdicionales?.tipologiaEvaluada);
  const mostrarResumen = yaEvaluada && !modoEdicion;

  const evaluadorRaw = misionActual?.datosAdicionales?.evaluadorTipologia;
  const evaluadorTipologia: EvaluadorReporteTerreno | undefined =
    evaluadorRaw &&
    typeof evaluadorRaw === 'object' &&
    typeof (evaluadorRaw as EvaluadorReporteTerreno).nombre === 'string' &&
    (evaluadorRaw as EvaluadorReporteTerreno).nombre.trim().length > 0
      ? (evaluadorRaw as EvaluadorReporteTerreno)
      : undefined;

  const fechaEvaluacionTipologia =
    typeof misionActual?.datosAdicionales?.fechaEvaluacionTipologia === 'string'
      ? misionActual.datosAdicionales.fechaEvaluacionTipologia
      : undefined;

  const esReclasificacionResumen = Boolean(
    misionActual?.datosAdicionales?.esReclasificacion
  );
  const registradoPorResumen = formatearAutorReporte(
    evaluadorTipologia,
    fechaEvaluacionTipologia
  );

  const tipologiaOriginalRef = useRef(tipologiaOriginal);
  const prevTipologiaSincronizadaRef = useRef<string | null>(null);

  useEffect(() => {
    tipologiaOriginalRef.current = tipologiaOriginal;
  }, [tipologiaOriginal]);

  // Carga inicial única del catálogo de tipos al montar (con fallback offline y protección de desmontaje)
  useEffect(() => {
    let isMounted = true;

    void (async () => {
      setCargandoCatalogo(true);
      try {
        const tipos = await obtenerCatalogoTiposIncidente();
        if (!isMounted) return;
        const listaTipos = Array.isArray(tipos) ? tipos : [];
        const actual = tipologiaOriginalRef.current;
        const actualLower = actual.toLowerCase();
        const coincidencia = actualLower
          ? listaTipos.find(
              (t) => t?.nombre && t.nombre.toLowerCase().trim() === actualLower
            )
          : undefined;
        prevTipologiaSincronizadaRef.current = actual;
        setCatalogo(listaTipos);
        setTipoSeleccionadoId(coincidencia ? coincidencia.id : '');
      } catch {
        // En caso de error, el servicio provee fallback
      } finally {
        if (isMounted) {
          setCargandoCatalogo(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // Sincronizar la selección solo si la prop tipologiaOriginal cambia posteriormente
  useEffect(() => {
    if (catalogo.length === 0) return;
    if (prevTipologiaSincronizadaRef.current === tipologiaOriginal) return;
    prevTipologiaSincronizadaRef.current = tipologiaOriginal;
    const actualLower = tipologiaOriginal.toLowerCase();
    const coincidencia = actualLower
      ? catalogo.find(
          (t) => t?.nombre && t.nombre.toLowerCase().trim() === actualLower
        )
      : undefined;
    setTipoSeleccionadoId(coincidencia ? coincidencia.id : '');
  }, [catalogo, tipologiaOriginal]);

  // Ajuste automático de altura del campo de justificación
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_ALTURA_MAX_PX)}px`;
  }, [justificacion]);

  const tipoActualSeleccionado = catalogo.find((t) => t.id === tipoSeleccionadoId);
  const nombreSeleccionado = tipoActualSeleccionado?.nombre || '';
  const esCambio = Boolean(
    nombreSeleccionado &&
      tipologiaOriginal &&
      nombreSeleccionado.toLowerCase().trim() !== tipologiaOriginal.toLowerCase().trim()
  );

  const justificacionLimpia = justificacion.trim();
  const longitudJustificacion = justificacionLimpia.length;
  const esJustificacionValida =
    !esCambio ||
    (longitudJustificacion >= JUSTIFICACION_MIN && longitudJustificacion <= JUSTIFICACION_MAX);

  const handlePreConfirmar = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorValidacion(null);
    setFeedback(null);

    if (!tipoSeleccionadoId) {
      setErrorValidacion('Seleccione un tipo de incidente.');
      return;
    }

    if (esCambio && !esJustificacionValida) {
      setErrorValidacion(
        'La justificación es obligatoria y debe contener al menos 5 caracteres al cambiar la tipología.'
      );
      return;
    }

    // Abrir modal de confirmación antes del envío
    setModalConfirmacionAbierto(true);
  };

  const handleEjecutarGuardado = async () => {
    setModalConfirmacionAbierto(false);
    setGuardando(true);
    setErrorValidacion(null);

    try {
      const resultado = await reclasificarTipologiaEnTerreno(
        incidenteId,
        {
          tipoIncidenteId: tipoSeleccionadoId,
          justificacion: esCambio ? justificacionLimpia : '',
          misionId: misionActual.id,
          esCambio,
        },
        misionActual
      );

      setFeedback({
        tipo: resultado.offline ? 'offline' : 'success',
        texto: resultado.mensaje,
      });
      setJustificacion('');
      setModoEdicion(false);

      if (onTipologiaActualizada) {
        onTipologiaActualizada(resultado);
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Error al actualizar la tipología del incidente.';
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
    <div className={styles.container} role="group" aria-label="Categorización del incidente">
      {!mostrarResumen && (
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Tipo registrado</span>
          <span className={styles.infoValue}>
            {misionActual.tipologia || 'Sin clasificación'}
          </span>
        </div>
      )}

      <AlertaFeedbackReporte
        feedback={feedback}
        errorValidacion={errorValidacion}
      />

      {/* Vista de Resumen cuando ya fue evaluada y no está en modo edición */}
      {mostrarResumen ? (
        <ResumenReporteTerreno
          testId="resumen-tipologia"
          titulo="Resumen de Evaluación en Terreno"
          chip={
            <Chip
              variant={esReclasificacionResumen ? 'teal' : 'info'}
              size="sm"
            >
              {esReclasificacionResumen ? 'Reclasificada' : 'Ratificada'}
            </Chip>
          }
          registradoPor={registradoPorResumen}
          textoModificar="Modificar categorización"
          deshabilitado={deshabilitado}
          onModificar={() => {
            if (
              misionActual.datosAdicionales?.esReclasificacion &&
              typeof misionActual.datosAdicionales?.justificacionTipologia === 'string'
            ) {
              setJustificacion(misionActual.datosAdicionales.justificacionTipologia);
            }
            setModoEdicion(true);
          }}
        >
          <CampoResumenReporte
            label="Tipología Constatada"
            valor={misionActual.tipologia || 'Sin clasificar'}
          />

          <CampoResumenReporte
            label="Dictamen Operativo"
            valor={
              esReclasificacionResumen
                ? 'Reclasificación en terreno'
                : 'Ratificación presencial (sin variaciones)'
            }
          />

          {Boolean(misionActual.datosAdicionales?.justificacionTipologia) && (
            <CampoResumenReporte
              label="Justificación Técnica"
              valor={String(misionActual.datosAdicionales?.justificacionTipologia)}
              esBloqueTexto
            />
          )}
        </ResumenReporteTerreno>
      ) : (
        /* Formulario de Evaluación / Modificación */
        <form onSubmit={handlePreConfirmar} className={styles.form} noValidate>
          <BloqueFormularioReporte
            icono={<Tag size={16} aria-hidden="true" />}
            titulo="1. Clasificación en Terreno"
          >
            <Select
              id={selectId}
              label="Tipo de incidente"
              requiredIndicator
              value={tipoSeleccionadoId}
              onChange={(e) => {
                setTipoSeleccionadoId(e.target.value);
                setErrorValidacion(null);
              }}
              disabled={deshabilitado || guardando || cargandoCatalogo}
              helperText={tipoActualSeleccionado?.descripcion || undefined}
              options={[
                ...(!tipoSeleccionadoId
                  ? [{ value: '', label: 'Seleccione un tipo de incidente...' }]
                  : []),
                ...catalogo.map((t) => ({
                  value: t.id,
                  label: t.nombre,
                })),
              ]}
            />

            {!tipoSeleccionadoId ? null : !esCambio ? (
              <div className={styles.ratificacionNotice} role="note">
                <CheckCircle2 size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
                <span>
                  Tipología original constatada. No se requiere justificación adicional para ratificar.
                </span>
              </div>
            ) : (
              <div className={styles.fieldGroup}>
                <Textarea
                  ref={textareaRef}
                  id={textareaId}
                  label="Justificación del cambio"
                  requiredIndicator
                  rows={4}
                  maxLength={JUSTIFICACION_MAX}
                  value={justificacion}
                  onChange={(e) => {
                    setJustificacion(e.target.value);
                    setErrorValidacion(null);
                  }}
                  placeholder="Describa los antecedentes constatados en terreno que fundamentan la nueva tipología"
                  disabled={deshabilitado || guardando}
                  aria-describedby={`${textareaId}-counter`}
                  className={styles.justificacion}
                />
                <div id={`${textareaId}-counter`} className={styles.counterRow}>
                  <span>Mínimo {JUSTIFICACION_MIN} caracteres</span>
                  <span className={contadorClase || undefined}>
                    {longitudJustificacion} / {JUSTIFICACION_MAX}
                  </span>
                </div>
              </div>
            )}
          </BloqueFormularioReporte>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={guardando}
              disabled={deshabilitado || cargandoCatalogo || !tipoSeleccionadoId}
              icon={<CheckCircle size={18} />}
              className={styles.submitBtn}
            >
              {guardando ? 'Guardando...' : 'Confirmar tipología'}
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

      {/* Modal accesible de confirmación previa */}
      <ModalConfirmacionTipologia
        abierto={modalConfirmacionAbierto}
        tipologiaOriginal={tipologiaOriginal}
        tipologiaNueva={nombreSeleccionado}
        esReclasificacion={esCambio}
        justificacion={justificacionLimpia}
        cargando={guardando}
        alConfirmar={handleEjecutarGuardado}
        alCancelar={() => setModalConfirmacionAbierto(false)}
      />
    </div>
  );
}

export default EvaluacionTipologiaCard;
