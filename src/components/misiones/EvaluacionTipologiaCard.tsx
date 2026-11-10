'use client';

import React, { useState, useEffect, useCallback, useId } from 'react';
import { Tag, CheckCircle, AlertTriangle, WifiOff, RefreshCw } from 'lucide-react';
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

export interface EvaluacionTipologiaCardProps {
  incidenteId: string;
  misionActual: MisionLocal;
  onTipologiaActualizada?: (resultado: ResultadoReclasificacionTipologia) => void;
  deshabilitado?: boolean;
}

export function EvaluacionTipologiaCard({
  incidenteId,
  misionActual,
  onTipologiaActualizada,
  deshabilitado = false,
}: EvaluacionTipologiaCardProps) {
  const selectId = useId();
  const textareaId = useId();

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

  const tipoActualSeleccionado = catalogo.find((t) => t.id === tipoSeleccionadoId);
  const justificacionLimpia = justificacion.trim();
  const longitudJustificacion = justificacionLimpia.length;
  const esJustificacionValida = longitudJustificacion >= 5 && longitudJustificacion <= 1000;

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorValidacion(null);
    setFeedback(null);

    if (!tipoSeleccionadoId) {
      setErrorValidacion('Debe seleccionar un tipo de incidente del catálogo oficial.');
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

  return (
    <section
      className={styles.container}
      aria-label="Evaluación y categorización de tipología en terreno"
    >
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <Tag size={18} color="var(--color-primary-teal)" aria-hidden="true" />
          <h3 className={styles.title}>Categorización en Terreno</h3>
        </div>
        <span className={styles.badge}>H37</span>
      </div>

      <div className={styles.tipologiaActualBox}>
        <span className={styles.tipologiaActualLabel}>Tipología constatada</span>
        <span className={styles.tipologiaActualValor}>
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
            <CheckCircle size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
          )}
          {feedback.tipo === 'offline' && (
            <WifiOff size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
          )}
          {feedback.tipo === 'error' && (
            <AlertTriangle size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
          )}
          <span>{feedback.texto}</span>
        </div>
      )}

      {errorValidacion && (
        <div className={`${styles.alertBox} ${styles.alertError}`} role="alert">
          <AlertTriangle size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span>{errorValidacion}</span>
        </div>
      )}

      <form onSubmit={handleGuardar} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Select
          id={selectId}
          label="Tipo de Incidente (Catálogo Oficial)"
          requiredIndicator
          value={tipoSeleccionadoId}
          onChange={(e) => {
            setTipoSeleccionadoId(e.target.value);
            setErrorValidacion(null);
          }}
          disabled={deshabilitado || guardando || cargandoCatalogo}
          options={catalogo.map((t) => ({
            value: t.id,
            label: t.nombre,
          }))}
        />

        {tipoActualSeleccionado?.descripcion && (
          <div className={styles.tipoDescripcionBox}>
            <strong>Alcance técnico:</strong> {tipoActualSeleccionado.descripcion}
          </div>
        )}

        <div>
          <Textarea
            id={textareaId}
            label="Justificación técnica de la evaluación"
            requiredIndicator
            rows={3}
            value={justificacion}
            onChange={(e) => {
              setJustificacion(e.target.value);
              setErrorValidacion(null);
            }}
            placeholder="Fundamente las causas constatadas en terreno para validar o corregir la tipología..."
            disabled={deshabilitado || guardando}
            aria-describedby={`${textareaId}-counter`}
          />
          <div id={`${textareaId}-counter`} className={styles.counterRow}>
            <span>Mínimo 5 caracteres</span>
            <span
              className={
                longitudJustificacion === 0
                  ? undefined
                  : esJustificacionValida
                    ? styles.counterValid
                    : styles.counterInvalid
              }
            >
              {longitudJustificacion} / 1000
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
          icon={guardando ? <RefreshCw size={18} /> : <CheckCircle size={18} />}
          className={styles.submitBtn}
        >
          {guardando ? 'Guardando...' : 'Confirmar Tipología'}
        </Button>
      </form>
    </section>
  );
}

export default EvaluacionTipologiaCard;
