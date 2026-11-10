'use client';

import React, { useState, useEffect, useId, useRef, useLayoutEffect } from 'react';
import { CheckCircle, AlertTriangle, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import {
  obtenerCatalogoTiposIncidente,
  reclasificarTipologiaEnTerreno,
  type ResultadoReclasificacionTipologia,
} from '@/services/tipologiaService';
import type { TipoIncidenteCatalogoItem, MisionLocal } from '@/types/offline';
import styles from './EvaluacionTipologiaCard.module.css';

const JUSTIFICACION_MIN = 5;
const JUSTIFICACION_MAX = 1000;
const TEXTAREA_ALTURA_MAX_PX = 240;

export interface EvaluacionTipologiaCardProps {
  incidenteId: string;
  misionActual: MisionLocal;
  onTipologiaActualizada?: (resultado: ResultadoReclasificacionTipologia) => void;
  deshabilitado?: boolean;
}

/**
 * Formulario de categorización del incidente en terreno.
 * Se renderiza sin contenedor propio para integrarse dentro de una `SeccionDesplegable`.
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
  const [feedback, setFeedback] = useState<{
    tipo: 'success' | 'offline' | 'error';
    texto: string;
  } | null>(null);

  // Carga inicial del catálogo de tipos (con fallback offline y protección de desmontaje)
  useEffect(() => {
    let isMounted = true;

    void (async () => {
      setCargandoCatalogo(true);
      try {
        const tipos = await obtenerCatalogoTiposIncidente();
        if (!isMounted) return;
        const listaTipos = Array.isArray(tipos) ? tipos : [];
        setCatalogo(listaTipos);

        if (listaTipos.length > 0) {
          const actualLower = misionActual?.tipologia?.toLowerCase().trim();
          const coincidencia = actualLower
            ? listaTipos.find(
                (t) => t?.nombre && t.nombre.toLowerCase().trim() === actualLower
              )
            : undefined;
          if (coincidencia) {
            setTipoSeleccionadoId(coincidencia.id);
          } else if (listaTipos[0]?.id) {
            setTipoSeleccionadoId(listaTipos[0].id);
          }
        }
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
  }, [misionActual?.tipologia]);

  // Ajuste automático de altura del campo de justificación (sin asa de redimensionado)
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_ALTURA_MAX_PX)}px`;
  }, [justificacion]);

  const tipoActualSeleccionado = catalogo.find((t) => t.id === tipoSeleccionadoId);
  const justificacionLimpia = justificacion.trim();
  const longitudJustificacion = justificacionLimpia.length;
  const esJustificacionValida =
    longitudJustificacion >= JUSTIFICACION_MIN && longitudJustificacion <= JUSTIFICACION_MAX;

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorValidacion(null);
    setFeedback(null);

    if (!tipoSeleccionadoId) {
      setErrorValidacion('Seleccione un tipo de incidente.');
      return;
    }

    if (!esJustificacionValida) {
      setErrorValidacion('La justificación es obligatoria y debe contener al menos 5 caracteres.');
      return;
    }

    setGuardando(true);
    try {
      const resultado = await reclasificarTipologiaEnTerreno(
        incidenteId,
        {
          tipoIncidenteId: tipoSeleccionadoId,
          justificacion: justificacionLimpia,
          misionId: misionActual.id,
        },
        misionActual
      );

      setFeedback({
        tipo: resultado.offline ? 'offline' : 'success',
        texto: resultado.mensaje,
      });
      setJustificacion('');

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
      <div className={styles.infoRow}>
        <span className={styles.infoLabel}>Tipo registrado</span>
        <span className={styles.infoValue}>
          {misionActual.tipologia || 'Sin clasificación'}
        </span>
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

      <form onSubmit={handleGuardar} className={styles.form} noValidate>
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
          options={catalogo.map((t) => ({
            value: t.id,
            label: t.nombre,
          }))}
        />

        <div className={styles.fieldGroup}>
          <Textarea
            ref={textareaRef}
            id={textareaId}
            label="Justificación"
            requiredIndicator
            rows={4}
            maxLength={JUSTIFICACION_MAX}
            value={justificacion}
            onChange={(e) => {
              setJustificacion(e.target.value);
              setErrorValidacion(null);
            }}
            placeholder="Describa lo constatado en terreno"
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
      </form>
    </div>
  );
}

export default EvaluacionTipologiaCard;
