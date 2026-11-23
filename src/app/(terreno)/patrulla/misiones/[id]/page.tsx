'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  Navigation,
  ClipboardCheck,
  Tag,
  ShieldAlert,
  FileCheck,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useConnectivity } from '@/hooks/useConnectivity';
import { Chip } from '@/components/ui/Chip';
import { useToastOptional } from '@/components/ui/Toast';
import { SeccionDesplegable } from '@/components/ui/SeccionDesplegable';
import {
  MisionDetalleTopBar,
  MisionDetalleHeaderCard,
  MisionDespachoActionsCard,
  MisionEstadoActivoCard,
  MisionNoEncontradaCard,
  MisionSoloLecturaNotice,
  MisionRechazoBanner,
  MisionBitacoraTimeline,
} from '@/components/misiones/MisionDetalleShared';
import { EvaluacionTipologiaCard } from '@/components/misiones/EvaluacionTipologiaCard';
import { EvaluacionPrioridadCard } from '@/components/misiones/EvaluacionPrioridadCard';
import { EvaluacionReporteCierreCard } from '@/components/misiones/EvaluacionReporteCierreCard';
import { UnidadInactivaBanner } from '@/components/common/UnidadInactivaBanner';
import { SinUnidadBanner } from '@/components/common/SinUnidadBanner';
import { MapaModal } from '@/components/maps/MapaModal';
import { RechazoMisionModal, type CoordenadasGPS } from '@/components/misiones/RechazoMisionModal';
import {
  obtenerDetalleMision,
  aceptarMisionPatrulla,
  rechazarMision,
} from '@/services/misionesService';
import { obtenerReportesPrioridadMision } from '@/services/prioridadService';
import { obtenerReporteVerificacionMision } from '@/services/reporteVerificacionService';
import type { MisionLocal } from '@/types/offline';
import sharedStyles from '@/components/misiones/MisionDetailLayout.module.css';
import styles from './PatrullaDetailPage.module.css';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PatrullaMisionDetailPage({ params }: PageProps) {
  const resolvedParams =
    params && typeof (params as unknown as { then?: unknown }).then === 'function'
      ? use(params as Promise<{ id: string }>)
      : (params as unknown as { id: string });
  const misionId = resolvedParams?.id;
  const router = useRouter();
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
  const [seccionCategorizacionAbierta, setSeccionCategorizacionAbierta] = useState<boolean>(true);
  const [seccionPrioridadAbierta, setSeccionPrioridadAbierta] = useState<boolean>(false);
  const [seccionReporteCierreAbierta, setSeccionReporteCierreAbierta] = useState<boolean>(false);

  const cargarDetalle = useCallback(
    async (silencioso = false) => {
      if (!silencioso) {
        setCargando(true);
      }
      try {
        const encontrada = await obtenerDetalleMision(misionId);
        if (encontrada) {
          setMision(encontrada);
          const reportesPrio = obtenerReportesPrioridadMision(encontrada);
          const reporteCierre = obtenerReporteVerificacionMision(encontrada);
          const estadoNorm = encontrada.estado?.toUpperCase() || '';
          const yaCerrada =
            estadoNorm === 'FINALIZADA' ||
            estadoNorm === 'COMPLETADA' ||
            estadoNorm === 'CERRADA';
          const tipologiaYaEvaluada = Boolean(
            encontrada.datosAdicionales?.tipologiaEvaluada
          );
          const prioridadYaEvaluada =
            Boolean(encontrada.datosAdicionales?.prioridadEvaluada) ||
            reportesPrio.length > 0;
          const cierreYaEnviado =
            Boolean(reporteCierre) ||
            Boolean(encontrada.datosAdicionales?.reporteVerificacionEnviado);

          setSeccionCategorizacionAbierta(!tipologiaYaEvaluada && !yaCerrada);
          setSeccionPrioridadAbierta(
            tipologiaYaEvaluada && !prioridadYaEvaluada && !yaCerrada
          );
          setSeccionReporteCierreAbierta(
            (tipologiaYaEvaluada && prioridadYaEvaluada) ||
              yaCerrada ||
              cierreYaEnviado
          );
        } else {
          setMision(null);
        }
      } finally {
        if (!silencioso) {
          setCargando(false);
        }
      }
    },
    [misionId]
  );

  useEffect(() => {
    void cargarDetalle();
  }, [cargarDetalle]);

  // Refrescar detalle local cuando la cola offline o eventos de otro integrante de la patrulla sincronicen la misión
  useEffect(() => {
    const handleOutboxSynced = () => {
      void cargarDetalle(true);
    };
    const handleMisionSincronizada = () => {
      void cargarDetalle(true);
    };
    window.addEventListener('sgrai:outbox-synced', handleOutboxSynced);
    window.addEventListener('sgrai:mision-sincronizada', handleMisionSincronizada);
    return () => {
      window.removeEventListener('sgrai:outbox-synced', handleOutboxSynced);
      window.removeEventListener('sgrai:mision-sincronizada', handleMisionSincronizada);
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

  const tienePermisoCrearReporte =
    typeof tienePermiso === 'function'
      ? tienePermiso('reportes:crear') || tienePermiso('misiones:terreno:verificar')
      : false;

  const mostrarBotonAceptar =
    unidadActiva && esDespachada && tienePermisoVerificar;

  const trabajoTexto =
    (mision.datosAdicionales?.trabajo as string) || mision.direccion;
  const esFinalizada =
    estadoNormalizado === 'FINALIZADA' ||
    estadoNormalizado === 'COMPLETADA' ||
    estadoNormalizado === 'CERRADA' ||
    estadoNormalizado === 'RECHAZADA';
  const esSoloLectura = !unidadActiva || esFinalizada;
  const mostrarFormulariosTecnicos =
    (unidadActiva && esEnCurso) ||
    (tieneUnidadAsignada && esFinalizada && estadoNormalizado !== 'RECHAZADA');

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
              actualizadoEn:
                (res.mision as { actualizadoEn?: string } | undefined)?.actualizadoEn ||
                new Date().toISOString(),
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
        <MisionRechazoBanner
          titulo="Misión Rechazada por Patrulla Verificadora"
          justificacion={
            mision.datosAdicionales?.justificacionRechazo
              ? String(mision.datosAdicionales.justificacionRechazo)
              : null
          }
        />
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
      )}

      {/* Formularios Técnicos de Evaluación en Terreno (H37, H38, H39, H43) */}
      {mostrarFormulariosTecnicos && (
        <section
          className={styles.evaluationFormsSection}
          data-testid="formularios-reporte-tecnico"
          aria-label="Formularios de reporte técnico de terreno"
        >
          <div className={styles.evaluationHeader}>
            <h3 className={styles.evaluationTitle}>
              <ClipboardCheck
                size={20}
                color="var(--color-primary-teal, #1B6F7D)"
                aria-hidden="true"
              />
              <span>Formularios de Reporte Técnico</span>
            </h3>
          </div>

          <div className={styles.evaluationContent}>
            {(() => {
              const reportesPrioridad = obtenerReportesPrioridadMision(mision);
              const reportesPrioridadCount = reportesPrioridad.length;
              const reporteCierre = obtenerReporteVerificacionMision(mision);
              const tipologiaCompletada = Boolean(
                mision.datosAdicionales?.tipologiaEvaluada
              );
              const prioridadCompletada =
                Boolean(mision.datosAdicionales?.prioridadEvaluada) ||
                reportesPrioridadCount > 0;
              const cierreCompletado =
                Boolean(reporteCierre) ||
                Boolean(mision.datosAdicionales?.reporteVerificacionEnviado);
              const versionPrioridad =
                typeof mision.datosAdicionales?.versionReportePrioridad === 'number'
                  ? mision.datosAdicionales.versionReportePrioridad
                  : reportesPrioridadCount > 0
                    ? reportesPrioridadCount
                    : undefined;

              return (
                <>
                  <SeccionDesplegable
                    titulo="Categorización del incidente"
                    icono={<Tag size={18} />}
                    abierto={seccionCategorizacionAbierta}
                    onToggle={(abierto) => setSeccionCategorizacionAbierta(abierto)}
                    indicador={
                      tipologiaCompletada ? (
                        <Chip
                          variant="success"
                          size="sm"
                          icon={<CheckCircle2 size={12} />}
                        >
                          Completado
                        </Chip>
                      ) : mision.sincronizacionPendiente ? (
                        <Chip variant="warning" size="sm">
                          Pendiente
                        </Chip>
                      ) : null
                    }
                  >
                    <EvaluacionTipologiaCard
                      incidenteId={mision.incidenteId}
                      misionActual={mision}
                      usuarioActualId={usuario?.id}
                      deshabilitado={esSoloLectura}
                      onTipologiaActualizada={(resultado) => {
                        if (resultado.mision) {
                          setMision(resultado.mision);
                        }
                        setSeccionCategorizacionAbierta(false);
                        if (!prioridadCompletada) {
                          setSeccionPrioridadAbierta(true);
                        } else if (!cierreCompletado) {
                          setSeccionReporteCierreAbierta(true);
                        }
                      }}
                    />
                  </SeccionDesplegable>

                  <SeccionDesplegable
                    titulo="Evaluación en terreno y prioridad"
                    icono={<ShieldAlert size={18} />}
                    abierto={seccionPrioridadAbierta}
                    onToggle={(abierto) => setSeccionPrioridadAbierta(abierto)}
                    indicador={
                      prioridadCompletada ? (
                        <Chip
                          variant="success"
                          size="sm"
                          icon={<CheckCircle2 size={12} />}
                        >
                          Completado
                          {typeof versionPrioridad === 'number'
                            ? ` (#${versionPrioridad})`
                            : ''}
                        </Chip>
                      ) : mision.sincronizacionPendiente ? (
                        <Chip variant="warning" size="sm">
                          Pendiente
                        </Chip>
                      ) : null
                    }
                  >
                    {seccionPrioridadAbierta && (
                      <EvaluacionPrioridadCard
                        incidenteId={mision.incidenteId}
                        misionActual={mision}
                        usuarioActualId={usuario?.id}
                        deshabilitado={esSoloLectura}
                        onPrioridadActualizada={(resultado) => {
                          if (resultado.mision) {
                            setMision(resultado.mision);
                          }
                          setSeccionPrioridadAbierta(false);
                          if (!cierreCompletado) {
                            setSeccionReporteCierreAbierta(true);
                          }
                          void actualizarPendientes();
                        }}
                      />
                    )}
                  </SeccionDesplegable>

                  <SeccionDesplegable
                    titulo="Informe técnico de verificación y cierre"
                    icono={<FileCheck size={18} />}
                    abierto={seccionReporteCierreAbierta}
                    onToggle={(abierto) => setSeccionReporteCierreAbierta(abierto)}
                    indicador={
                      cierreCompletado ? (
                        <Chip
                          variant="success"
                          size="sm"
                          icon={<CheckCircle2 size={12} />}
                        >
                          Completado
                        </Chip>
                      ) : mision.sincronizacionPendiente ? (
                        <Chip variant="warning" size="sm">
                          Pendiente
                        </Chip>
                      ) : null
                    }
                  >
                    {seccionReporteCierreAbierta && (
                      <EvaluacionReporteCierreCard
                        misionActual={mision}
                        usuarioActualId={usuario?.id}
                        deshabilitado={esSoloLectura || !tienePermisoCrearReporte}
                        onReporteEnviado={(resultado) => {
                          if (resultado.mision) {
                            setMision(resultado.mision);
                          }
                          setMensajeConfirmacion(resultado.mensaje);
                          if (toast) {
                            if (resultado.offline) {
                              toast.showWarning(
                                resultado.mensaje,
                                'Guardado sin conexión'
                              );
                            } else {
                              toast.showSuccess(resultado.mensaje, 'Misión cerrada');
                            }
                          }
                          void actualizarPendientes();
                          router.push('/patrulla/misiones');
                        }}
                      />
                    )}
                  </SeccionDesplegable>
                </>
              );
            })()}
          </div>
        </section>
      )}

      {Array.isArray(mision.bitacoraTiempos) && mision.bitacoraTiempos.length > 0 && (
        <MisionBitacoraTimeline
          bitacora={mision.bitacoraTiempos}
          tipoUnidad="PATRULLA"
          responsableFallback={usuario?.nombre}
        />
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
        titulo="Rechazar Misión de Verificación"
        unidadEtiqueta="patrulla"
        alConfirmar={handleConfirmarRechazo}
        alCancelar={() => setModalRechazoAbierto(false)}
      />
    </div>
  );
}
