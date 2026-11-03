'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, XCircle, MapPin, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import styles from './RechazoMisionModal.module.css';

export interface CoordenadasGPS {
  lat: number;
  lng: number;
}

export interface RechazoMisionModalProps {
  abierto: boolean;
  codigoMision: string;
  alConfirmar: (justificacion: string, coordenadas?: CoordenadasGPS) => Promise<void>;
  alCancelar: () => void;
}

export function RechazoMisionModal({
  abierto,
  codigoMision,
  alConfirmar,
  alCancelar,
}: RechazoMisionModalProps) {
  const [justificacion, setJustificacion] = useState<string>('');
  const [errorApi, setErrorApi] = useState<string | null>(null);
  const [cargando, setCargando] = useState<boolean>(false);
  const [coordenadas, setCoordenadas] = useState<CoordenadasGPS | undefined>(undefined);
  const [obteniendoGps, setObteniendoGps] = useState<boolean>(false);
  const [tocado, setTocado] = useState<boolean>(false);

  // Obtener geolocalización GPS en terreno de forma transparente al abrir el modal
  useEffect(() => {
    if (!abierto) {
      setJustificacion('');
      setErrorApi(null);
      setCargando(false);
      setTocado(false);
      setCoordenadas(undefined);
      return;
    }

    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      setObteniendoGps(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoordenadas({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setObteniendoGps(false);
        },
        () => {
          // Si el GPS falla o el usuario no da permiso, se continúa sin coordenadas
          setObteniendoGps(false);
        },
        { timeout: 5000, enableHighAccuracy: true }
      );
    }
  }, [abierto]);

  // Manejador para cerrar con Escape
  useEffect(() => {
    if (!abierto) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !cargando) {
        alCancelar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [abierto, cargando, alCancelar]);

  const longitudTrim = justificacion.trim().length;
  const esValido = longitudTrim >= 5;
  const mostrarErrorLongitud = tocado && !esValido;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setTocado(true);

      if (!esValido || cargando) {
        return;
      }

      setCargando(true);
      setErrorApi(null);

      try {
        await alConfirmar(justificacion.trim(), coordenadas);
      } catch (err) {
        const mensaje =
          err instanceof Error
            ? err.message
            : 'Error inesperado al registrar el rechazo de la misión.';
        setErrorApi(mensaje);
      } finally {
        setCargando(false);
      }
    },
    [esValido, cargando, justificacion, coordenadas, alConfirmar]
  );

  if (!abierto) return null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rechazo-modal-title"
      aria-describedby="rechazo-modal-desc"
    >
      <div className={styles.modal}>
        {/* Encabezado */}
        <div className={styles.titleArea}>
          <div className={styles.iconWrapper} aria-hidden="true">
            <AlertTriangle size={20} />
          </div>
          <div className={styles.titleContent}>
            <h2 id="rechazo-modal-title" className={styles.title}>
              Rechazar Misión de Verificación
            </h2>
            <p className={styles.subtitle}>{codigoMision}</p>
          </div>
        </div>

        {/* Descripción normativa */}
        <p id="rechazo-modal-desc" className={styles.description}>
          Conforme a la <strong>Regla Operativa §3.3</strong>, el rechazo de una misión
          exige una justificación técnica obligatoria (desperfecto de vehículo, corte de
          ruta, emergencia crítica) para liberar la patrulla y permitir la reasignación
          inmediata en el Centro de Mando.
        </p>

        {/* Mensaje de error retornado por la API */}
        {errorApi && (
          <div className={styles.apiErrorBox} role="alert">
            <AlertCircle size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
            <span>{errorApi}</span>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className={styles.formGroup} noValidate>
          <div className={styles.labelRow}>
            <label htmlFor="justificacion-rechazo-input" className={styles.label}>
              Motivo del Rechazo <span className={styles.required}>*</span>
            </label>
            <span
              className={`${styles.counter} ${
                esValido ? styles.counterValid : longitudTrim > 0 ? styles.counterInvalid : ''
              }`}
              aria-live="polite"
            >
              {longitudTrim} / 5 caracteres mín.
            </span>
          </div>

          <textarea
            id="justificacion-rechazo-input"
            value={justificacion}
            onChange={(e) => {
              setJustificacion(e.target.value);
              if (errorApi) setErrorApi(null);
            }}
            onBlur={() => setTocado(true)}
            placeholder="Describa el motivo técnico por el cual no es posible concurrir al incidente..."
            className={`${styles.textarea} ${mostrarErrorLongitud ? styles.textareaError : ''}`}
            rows={4}
            disabled={cargando}
            aria-required="true"
            aria-invalid={mostrarErrorLongitud ? 'true' : undefined}
            aria-describedby={mostrarErrorLongitud ? 'rechazo-error-msg' : undefined}
          />

          {mostrarErrorLongitud && (
            <div id="rechazo-error-msg" className={styles.feedbackRow} role="alert">
              <AlertCircle size={14} aria-hidden="true" />
              <span>La justificación debe contener al menos 5 caracteres.</span>
            </div>
          )}

          {/* Indicador de geolocalización */}
          <div className={styles.gpsIndicator}>
            <MapPin size={13} aria-hidden="true" />
            <span>
              {obteniendoGps
                ? 'Obteniendo coordenadas GPS de terreno...'
                : coordenadas
                ? `GPS registrado (${coordenadas.lat.toFixed(4)}, ${coordenadas.lng.toFixed(4)})`
                : 'Ubicación GPS no disponible (se registrará sin coordenadas)'}
            </span>
          </div>

          {/* Acciones */}
          <div className={styles.actionRow}>
            <Button
              variant="outline"
              size="md"
              onClick={alCancelar}
              disabled={cargando}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="md"
              disabled={!esValido || cargando}
              loading={cargando}
              icon={<XCircle size={18} />}
            >
              Confirmar Rechazo
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RechazoMisionModal;

