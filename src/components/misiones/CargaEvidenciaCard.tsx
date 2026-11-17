'use client';

import React, { useRef, useState } from 'react';
import {
  Camera,
  Video,
  Upload,
  FileText,
  CheckCircle2,
  WifiOff,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  esMimeImagen,
  esMimeVideo,
  formatearTamanoBytes,
  validarArchivoEvidencia,
} from '@/lib/utils/mediaUtils';
import { subirEvidenciaMultimedia } from '@/services/evidenciaService';
import type { AdjuntoLocal } from '@/types/offline';
import styles from './CargaEvidenciaCard.module.css';

export interface CargaEvidenciaCardProps {
  misionId: string;
  incidenteId?: string;
  reporteTerrenoId?: string;
  adjuntos: AdjuntoLocal[];
  soloLectura?: boolean;
  alAdjuntarEvidencia?: (adjunto: AdjuntoLocal, enColaOffline: boolean) => void | Promise<void>;
}

export function CargaEvidenciaCard({
  misionId,
  incidenteId,
  reporteTerrenoId,
  adjuntos,
  soloLectura = false,
  alAdjuntarEvidencia,
}: CargaEvidenciaCardProps) {
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const archivoInputRef = useRef<HTMLInputElement>(null);

  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [archivoEnCurso, setArchivoEnCurso] = useState<string | null>(null);
  const [errorMensaje, setErrorMensaje] = useState<string | null>(null);
  const [estadoMensaje, setEstadoMensaje] = useState<{
    texto: string;
    offline: boolean;
  } | null>(null);

  const procesarArchivos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMensaje(null);
    setEstadoMensaje(null);

    const lista = Array.from(files);
    for (const archivo of lista) {
      const validacion = validarArchivoEvidencia(archivo);
      if (!validacion.valido) {
        setErrorMensaje(validacion.error || 'Archivo no válido.');
        continue;
      }

      setSubiendo(true);
      setProgreso(5);
      setArchivoEnCurso(archivo.name);
      try {
        const resultado = await subirEvidenciaMultimedia({
          archivo,
          misionId,
          incidenteId,
          reporteTerrenoId,
          onProgress: (pct) => setProgreso(pct),
        });

        setEstadoMensaje({
          texto: resultado.mensaje,
          offline: resultado.enColaOffline,
        });

        if (alAdjuntarEvidencia) {
          await alAdjuntarEvidencia(resultado.adjunto, resultado.enColaOffline);
        }
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'No se pudo procesar o cargar la evidencia.';
        setErrorMensaje(msg);
      } finally {
        setSubiendo(false);
        setProgreso(0);
        setArchivoEnCurso(null);
      }
    }

    if (fotoInputRef.current) fotoInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
    if (archivoInputRef.current) archivoInputRef.current.value = '';
  };

  return (
    <section
      className={styles.card}
      aria-label="Carga de evidencia multimedia en terreno"
    >
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <Camera size={18} color="var(--color-primary-teal)" aria-hidden="true" />
          <h2 className={styles.title}>Evidencia Multimedia</h2>
        </div>
      </div>

      <p className={styles.hint}>
        Adjunte fotografías (JPEG, PNG, WebP), videos (MP4, WebM, MOV) o documentos
        técnicos (PDF) de hasta 10 MB. Si no hay red, se guardarán localmente para
        sincronización automática.
      </p>

      {!soloLectura && (
        <>
          <input
            ref={fotoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className={styles.hiddenInput}
            aria-label="Capturar fotografía con cámara"
            data-testid="input-captura-foto"
            onChange={(e) => void procesarArchivos(e.target.files)}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            capture="environment"
            className={styles.hiddenInput}
            aria-label="Grabar video con cámara"
            data-testid="input-captura-video"
            onChange={(e) => void procesarArchivos(e.target.files)}
          />
          <input
            ref={archivoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,application/pdf"
            multiple
            className={styles.hiddenInput}
            aria-label="Seleccionar archivos desde galería o documentos"
            data-testid="input-seleccion-archivo"
            onChange={(e) => void procesarArchivos(e.target.files)}
          />

          <div className={styles.actionsGrid}>
            <Button
              type="button"
              variant="primary"
              size="md"
              fullWidth
              icon={<Camera size={18} />}
              disabled={subiendo}
              onClick={() => fotoInputRef.current?.click()}
            >
              Tomar Foto
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="md"
              fullWidth
              icon={<Video size={18} />}
              disabled={subiendo}
              onClick={() => videoInputRef.current?.click()}
            >
              Grabar Video
            </Button>
            <Button
              type="button"
              variant="outline"
              size="md"
              fullWidth
              icon={<Upload size={18} />}
              disabled={subiendo}
              onClick={() => archivoInputRef.current?.click()}
            >
              Galería / PDF
            </Button>
          </div>
        </>
      )}

      {subiendo && (
        <div
          className={styles.progressWrapper}
          role="progressbar"
          aria-valuenow={progreso}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progreso de carga de evidencia"
        >
          <div className={styles.progressHeader}>
            <span>Procesando: {archivoEnCurso || 'evidencia'}</span>
            <span>{progreso}%</span>
          </div>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: `${progreso}%` }}
            />
          </div>
        </div>
      )}

      {errorMensaje && (
        <div className={styles.alertError} role="alert">
          <AlertCircle size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{errorMensaje}</span>
        </div>
      )}

      {estadoMensaje && (
        <div
          className={estadoMensaje.offline ? styles.alertOffline : styles.alertSuccess}
          role="status"
        >
          {estadoMensaje.offline ? (
            <WifiOff size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
          ) : (
            <CheckCircle2 size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
          )}
          <span>{estadoMensaje.texto}</span>
        </div>
      )}

      {adjuntos.length > 0 && (
        <div className={styles.galleryList}>
          <h3 className={styles.galleryTitle}>
            Archivos adjuntos ({adjuntos.length})
          </h3>
          {adjuntos.map((item) => {
            const esImagen = esMimeImagen(item.tipoMime);
            const esVideo = esMimeVideo(item.tipoMime);
            const esUrlDescargable =
              item.url.startsWith('/uploads/') || item.url.startsWith('http');

            return (
              <div key={item.id} className={styles.attachmentItem}>
                {esVideo && item.url ? (
                  <video
                    controls
                    preload="metadata"
                    src={item.url}
                    className={styles.videoPreview}
                    aria-label={`Previsualización de video ${item.nombreArchivo}`}
                  />
                ) : null}

                <div className={styles.attachmentMediaRow}>
                  {esImagen && item.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.url}
                      alt={`Miniatura de ${item.nombreArchivo}`}
                      className={styles.thumbnailImg}
                    />
                  ) : !esVideo ? (
                    <div className={styles.docIconBox} aria-hidden="true">
                      <FileText size={24} />
                    </div>
                  ) : (
                    <div className={styles.docIconBox} aria-hidden="true">
                      <Video size={24} />
                    </div>
                  )}

                  <div className={styles.attachmentMeta}>
                    <span className={styles.fileName} title={item.nombreArchivo}>
                      {item.nombreArchivo}
                    </span>
                    <span className={styles.fileDetails}>
                      {item.tipoMime} — {formatearTamanoBytes(item.tamanoBytes)}
                    </span>

                    <div className={styles.statusRow}>
                      {item.errorSincronizacion ? (
                        <span className={styles.badgeError}>
                          <AlertCircle size={12} aria-hidden="true" />
                          {item.errorSincronizacion}
                        </span>
                      ) : item.sincronizacionPendiente ? (
                        <span className={styles.badgePending}>
                          <WifiOff size={12} aria-hidden="true" />
                          Pendiente offline
                        </span>
                      ) : (
                        <span className={styles.badgeSynced}>
                          <CheckCircle2 size={12} aria-hidden="true" />
                          Sincronizado
                        </span>
                      )}

                      {!esImagen && !esVideo && esUrlDescargable && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.downloadLink}
                        >
                          <ExternalLink size={12} aria-hidden="true" />
                          Ver PDF
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default CargaEvidenciaCard;
