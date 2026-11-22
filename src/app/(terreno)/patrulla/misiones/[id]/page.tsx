'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import {
  XCircle,
  CheckCircle,
  AlertCircle,
  Navigation,
  ClipboardCheck,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useConnectivity } from '@/hooks/useConnectivity';
import { useToastOptional } from '@/components/ui/Toast';
import {
  MisionDetalleTopBar,
  MisionDetalleHeaderCard,
  MisionDespachoActionsCard,
  MisionEstadoActivoCard,
  MisionNoEncontradaCard,
  MisionSoloLecturaNotice,
} from '@/components/misiones/MisionDetalleShared';
import { UnidadInactivaBanner } from '@/components/common/UnidadInactivaBanner';
import { SinUnidadBanner } from '@/components/common/SinUnidadBanner';
import { MapaModal } from '@/components/maps/MapaModal';
import { RechazoMisionModal, type CoordenadasGPS } from '@/components/misiones/RechazoMisionModal';
import {
  obtenerDetalleMision,
  aceptarMisionPatrulla,
  rechazarMision,
} from '@/services/misionesService';
import type { MisionLocal } from '@/types/offline';
import sharedStyles from '@/components/misiones/MisionDetailLayout.module.css';
import styles from './PatrullaDetailPage.module.css';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PatrullaMisionDetailPage({ params }: PageProps) {
  const resolvedParams =
    params && typeof (params as unknown as { then?: unknown }).then === 'function'
      ? use(params)
      : (params as unknown as { id: string });
  const misionId = resolvedParams?.id;
  const toast = useToastOptional();
  const {
    usuario,
    unidadActiva,
    tieneUnidadAsignada,
    estadoAsignacion,
    tienePermiso,
    esPatrulla,
  } = useAuth();
  const { status, pendientes, sincronizar, actualizarPendientes } = useConnectivity();
  const [mision, setMision] = useState<MisionLocal | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);
  const [aceptando, setAceptando] = useState<boolean>(false);
  const [mensajeConfirmacion, setMensajeConfirmacion] = useState<string | null>(null);
  const [errorAceptacion, setErrorAceptacion] = useState<string | null>(null);
  const [mapaAbierto, setMapaAbierto] = useState<boolean>(false);
  const [modalRechazoAbierto, setModalRechazoAbierto] = useState<boolean>(false);
  const [feedbackMensaje, setFeedbackMensaje] = useState<{
    tipo: 'success' | 'offline';
    texto: string;
  } | null>(null);

  const cargarDetalle = useCallback(async () => {
    setCargando(true);
    try {
      const encontrada = await obtenerDetalleMision(misionId);
      setMision(encontrada || null);
    } finally {
      setCargando(false);
    }
  }, [misionId]);

  useEffect(() => {
    void cargarDetalle();
  }, [cargarDetalle]);

  // Refrescar detalle local cuando la cola offline termine de sincronizarse al recuperar red
  useEffect(() => {
    const handleOutboxSynced = () => {
      void cargarDetalle();
    };
    window.addEventListener('sgrai:outbox-synced', handleOutboxSynced);
    return () => {
      window.removeEventListener('sgrai:outbox-synced', handleOutboxSynced);
    };
  }, [cargarDetalle]);

  const handleAceptarMision = async () => {
    if (!mision || aceptando) return;
    setAceptando(true);
    setErrorAceptacion(null);
    setMensajeConfirmacion(null);

    try {
      const resultado = await aceptarMisionPatrulla(mision.id, {
        misionActual: mision,
      });
      setMision(resultado.mision);
      setMensajeConfirmacion(resultado.mensaje);
      if (toast) {
        if (resultado.enColaOffline) {
          toast.showWarning(resultado.mensaje, 'Guardado sin conexión', {
            dedupKey: `aceptar-mision-offline-${mision.id}`,
          });
        } else if (resultado.yaAceptadaPreviamente) {
          toast.showInfo(resultado.mensaje, 'Misión ya en curso', {
            dedupKey: `aceptar-mision-idemp-${mision.id}`,
          });
        } else {
          toast.showSuccess(resultado.mensaje, 'Asignación aceptada', {
            dedupKey: `aceptar-mision-${mision.id}`,
          });
        }
      }
      await actualizarPendientes();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'No se pudo confirmar la aceptación de la misión.';
      setErrorAceptacion(msg);
      if (toast) {
        toast.showError(msg, 'No se pudo aceptar la asignación');
      }
    } finally {
      setAceptando(false);
    }
  };

  if (cargando) {
    return (
      <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
        Cargando misión...
      </div>
    );
  }

  if (!mision) {
    return (
      <MisionNoEncontradaCard
        backHref="/patrulla/misiones"
        backLabel="Misiones"
        status={status}
        pendingCount={pendientes}
        onRetry={sincronizar}
        descripcion="La misión solicitada no existe o no se encuentra asignada a su unidad operativa, o no está disponible en caché local."
      />
    );
  }

  const estadoNormalizado = mision.estado?.toUpperCase() || '';
  const esDespachada = estadoNormalizado === 'DESPACHADA';
  const esEnCurso =
    estadoNormalizado === 'EN_CURSO' ||
    estadoNormalizado === 'EN_RUTA' ||
    estadoNormalizado === 'EN_TERRENO';

  const tienePermisoVerificar =
    typeof tienePermiso === 'function'
      ? tienePermiso('misiones:terreno:verificar')
      : false;

  const mostrarBotonAceptar =
    unidadActiva && esDespachada && tienePermisoVerificar;

  const trabajoTexto =
    (mision.datosAdicionales?.trabajo as string) || mision.direccion;
  const esSoloLectura =
    !unidadActiva ||
    estadoNormalizado === 'FINALIZADA' ||
    estadoNormalizado === 'COMPLETADA' ||
    estadoNormalizado === 'CERRADA' ||
    estadoNormalizado === 'RECHAZADA';

  const esRechazable =
    unidadActiva &&
    esPatrulla &&
    tienePermisoVerificar &&
    (estadoNormalizado === 'DESPACHADA' ||
      estadoNormalizado === 'ASIGNADA' ||
      estadoNormalizado === 'PENDIENTE');

  const handleConfirmarRechazo = async (
    motivo: string,
    coordenadas?: CoordenadasGPS
  ) => {
    try {
      const res = await rechazarMision(mision.id, {
        justificacion_rechazo: motivo,
        latitud: coordenadas?.lat,
        longitud: coordenadas?.lng,
      });

      setMision((prev) =>
        prev
          ? {
              ...prev,
              estado: 'RECHAZADA',
              sincronizacionPendiente: Boolean(res.modoOffline),
              actualizadoEn: res.mision?.actualizadoEn || new Date().toISOString(),
              datosAdicionales: {
                ...prev.datosAdicionales,
                justificacionRechazo: motivo,
              },
            }
          : prev
      );

      setModalRechazoAbierto(false);
      await actualizarPendientes();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sgrai:mision_actualizada'));
      }
      setFeedbackMensaje({
        tipo: res.modoOffline ? 'offline' : 'success',
        texto: res.mensaje,
      });
      if (toast) {
        if (res.modoOffline) {
          toast.showWarning(res.mensaje, 'Guardado sin conexión', {
            dedupKey: `rechazar-mision-offline-${mision.id}`,
          });
        } else {
          toast.showSuccess(res.mensaje, 'Misión rechazada', {
            dedupKey: `rechazar-mision-${mision.id}`,
          });
        }
      }
    } catch (err) {
      setModalRechazoAbierto(false);
      const errorMsg =
        err instanceof Error
          ? err.message
          : 'No se pudo registrar el rechazo de la misión.';
      setFeedbackMensaje({
        tipo: 'offline',
        texto: errorMsg,
      });
      if (toast) {
        toast.showError(errorMsg, 'No se pudo rechazar la misión');
      }
    }
  };

  return (
    <div className={sharedStyles.container}>
      <MisionDetalleTopBar
        backHref="/patrulla/misiones"
        backLabel={estadoAsignacion === 'DESACTIVADA' ? 'Historial' : 'Misiones'}
        status={status}
        pendingCount={pendientes}
        onRetry={sincronizar}
      />

      {!tieneUnidadAsignada ? (
        <SinUnidadBanner
          tipoUnidad="patrulla"
          nombreOperador={usuario?.nombre}
        />
      ) : !unidadActiva ? (
        <UnidadInactivaBanner
          tipoUnidad="patrulla"
          nombreUnidad={usuario?.unidadNombre}
        />
      ) : null}

      {feedbackMensaje && (
        <div
          className={`${styles.feedbackBanner} ${
            feedbackMensaje.tipo === 'offline'
              ? styles.feedbackOffline
              : styles.feedbackSuccess
          }`}
          role="status"
        >
          {feedbackMensaje.tipo === 'offline' ? (
            <AlertCircle size={18} aria-hidden="true" />
          ) : (
            <CheckCircle size={18} aria-hidden="true" />
          )}
          <span>{feedbackMensaje.texto}</span>
        </div>
      )}

      {estadoNormalizado === 'RECHAZADA' && (
        <div className={styles.rejectedBanner} role="status">
          <div className={styles.rejectedHeader}>
            <XCircle size={18} aria-hidden="true" />
            <span>Misión Rechazada por Patrulla Verificadora</span>
          </div>
          {Boolean(mision.datosAdicionales?.justificacionRechazo) && (
            <p className={styles.rejectedReason}>
              <strong>Motivo documentado:</strong>{' '}
              {String(mision.datosAdicionales?.justificacionRechazo)}
            </p>
          )}
        </div>
      )}

      <MisionDetalleHeaderCard
        mision={mision}
        trabajoTexto={trabajoTexto}
        etiquetaFecha={
          esEnCurso && mision.fechaInicio ? 'Inicio de trayecto' : 'Despachada'
        }
        fechaPrincipal={mision.fechaInicio || mision.fechaDespacho}
        onVerMapa={() => setMapaAbierto(true)}
      />

      {/* Acciones Operativas de Despacho (H36 / H69) */}
      {(mostrarBotonAceptar || esRechazable) && (
        <MisionDespachoActionsCard
          ariaLabel="Acciones operativas de despacho"
          titulo="Acciones de Despacho"
          descripcion="Confirme la salida a terreno para evaluar o fundamente el rechazo si no es posible concurrir."
          mostrarAceptar={Boolean(mostrarBotonAceptar)}
          etiquetaAceptar="Aceptar Misión"
          aceptando={aceptando}
          errorAceptacion={errorAceptacion}
          onAceptar={() => void handleAceptarMision()}
          mostrarRechazar={Boolean(esRechazable)}
          etiquetaRechazar="Rechazar Misión"
          rechazando={aceptando}
          onRechazar={() => setModalRechazoAbierto(true)}
        />
      )}

      {/* Vista activa: En Trayecto / Evaluación (HU-36) */}
      {unidadActiva && esEnCurso && (
        <>
          <MisionEstadoActivoCard
            ariaLabel="Estado de traslado y evaluación"
            icono={
              <Navigation
                size={20}
                color="var(--color-primary-teal)"
                aria-hidden="true"
              />
            }
            titulo="En Trayecto / Evaluación"
            sincronizacionPendiente={Boolean(mision.sincronizacionPendiente)}
            mensajeOffline="Pendiente de sincronizar: La aceptación fue guardada en la cola local del dispositivo y se enviará automáticamente al recuperar conexión."
            mensajeConfirmacion={mensajeConfirmacion}
            estadosCanonicos={[
              { etiqueta: 'Misión', valor: 'En curso' },
              { etiqueta: 'Patrulla', valor: 'En verificación' },
              { etiqueta: 'Incidente', valor: 'Verificando' },
            ]}
          />

          <section
            className={styles.evaluationFormsSection}
            data-testid="formularios-reporte-tecnico"
            aria-label="Formularios de reporte técnico de terreno"
          >
            <div className={styles.evaluationHeader}>
              <h3 className={styles.evaluationTitle}>
                <ClipboardCheck
                  size={18}
                  color="var(--color-primary-teal)"
                  aria-hidden="true"
                />
                <span>Formularios de Reporte Técnico</span>
              </h3>
              <span className={sharedStyles.activeStatusChip}>Habilitado</span>
            </div>
            <p className={styles.evaluationBody}>
              La unidad se encuentra en trayecto / evaluación. Los formularios
              operativos para categorizar el incidente, ajustar la prioridad y
              enviar el reporte de situación están habilitados.
            </p>
          </section>
        </>
      )}

      {esSoloLectura && <MisionSoloLecturaNotice />}

      <MapaModal
        abierto={mapaAbierto}
        alCerrar={() => setMapaAbierto(false)}
        latitud={mision.coordenadas?.lat}
        longitud={mision.coordenadas?.lng}
        titulo={mision.tipologia || mision.codigoIncidente}
        direccion={mision.direccion}
      />

      <RechazoMisionModal
        abierto={modalRechazoAbierto}
        codigoMision={mision.codigoIncidente}
        alConfirmar={handleConfirmarRechazo}
        alCancelar={() => setModalRechazoAbierto(false)}
      />
    </div>
  );
}
