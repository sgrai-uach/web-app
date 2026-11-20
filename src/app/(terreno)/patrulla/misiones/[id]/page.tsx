'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  Tag,
  CheckCircle,
  CheckCircle2,
  Navigation,
  ClipboardCheck,
  ShieldAlert,
  ShieldCheck,
  FileCheck,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useConnectivity } from '@/hooks/useConnectivity';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { useToastOptional } from '@/components/ui/Toast';
import {
  MisionDetalleTopBar,
  MisionDetalleHeaderCard,
  MisionEstadoActivoCard,
  MisionNoEncontradaCard,
  MisionSoloLecturaNotice,
} from '@/components/misiones/MisionDetalleShared';
import { UnidadInactivaBanner } from '@/components/common/UnidadInactivaBanner';
import { SinUnidadBanner } from '@/components/common/SinUnidadBanner';
import { MapaModal } from '@/components/maps/MapaModal';
import { SeccionDesplegable } from '@/components/ui/SeccionDesplegable';
import { EvaluacionTipologiaCard } from '@/components/misiones/EvaluacionTipologiaCard';
import { EvaluacionPrioridadCard } from '@/components/misiones/EvaluacionPrioridadCard';
import { EvaluacionReporteCierreCard } from '@/components/misiones/EvaluacionReporteCierreCard';
import { PrevencionMisionCard } from '@/components/misiones/PrevencionMisionCard';
import { NotaInformativaReporte } from '@/components/misiones/ReporteTerrenoBase';
import { esMisionDePrevencion } from '@/lib/utils/formatters';
import {
  obtenerDetalleMision,
  aceptarMisionPatrulla,
} from '@/services/misionesService';
import { obtenerReportesPrioridadMision } from '@/services/prioridadService';
import { obtenerReporteVerificacionMision } from '@/services/reporteVerificacionService';
import type { MisionLocal } from '@/types/offline';
import styles from '@/components/misiones/MisionDetailLayout.module.css';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PatrullaMisionDetailPage({ params }: PageProps) {
  const { id: misionId } = use(params);
  const router = useRouter();
  const toast = useToastOptional();
  const {
    usuario,
    unidadActiva,
    tieneUnidadAsignada,
    estadoAsignacion,
    tienePermiso,
  } = useAuth();
  const { status, pendientes, sincronizar, actualizarPendientes } = useConnectivity();
  const [mision, setMision] = useState<MisionLocal | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);
  const [aceptando, setAceptando] = useState<boolean>(false);
  const [mensajeConfirmacion, setMensajeConfirmacion] = useState<string | null>(null);
  const [errorAceptacion, setErrorAceptacion] = useState<string | null>(null);
  const [mapaAbierto, setMapaAbierto] = useState<boolean>(false);
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
    window.addEventListener('sgrai:prevencion-actualizada', handleMisionSincronizada);
    return () => {
      window.removeEventListener('sgrai:outbox-synced', handleOutboxSynced);
      window.removeEventListener('sgrai:mision-sincronizada', handleMisionSincronizada);
      window.removeEventListener('sgrai:prevencion-actualizada', handleMisionSincronizada);
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
      await actualizarPendientes();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'No se pudo confirmar la aceptación de la misión.';
      setErrorAceptacion(msg);
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
        descripcion="La misión solicitada no existe, fue removida o no se encuentra disponible en caché local."
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
  const esPrevencion = esMisionDePrevencion(mision);
  const esFinalizada =
    estadoNormalizado === 'FINALIZADA' ||
    estadoNormalizado === 'COMPLETADA' ||
    estadoNormalizado === 'CERRADA';
  const esSoloLectura = !unidadActiva || esFinalizada;
  const mostrarFormulariosTecnicos =
    !esPrevencion &&
    Boolean(mision.incidenteId) &&
    ((unidadActiva && esEnCurso) || (tieneUnidadAsignada && esFinalizada));

  return (
    <div className={styles.container}>
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

      <MisionDetalleHeaderCard
        mision={mision}
        trabajoTexto={trabajoTexto}
        etiquetaFecha={
          esEnCurso && mision.fechaInicio ? 'Inicio de trayecto' : 'Despachada'
        }
        fechaPrincipal={mision.fechaInicio || mision.fechaDespacho}
        onVerMapa={() => setMapaAbierto(true)}
      />

      {/* Acción principal: Confirmar y Aceptar Misión (HU-36) */}
      {mostrarBotonAceptar && (
        <section
          className={styles.actionCard}
          aria-label="Confirmación de salida de patrulla"
        >
          <h2 className={styles.actionTitle}>
            {esPrevencion
              ? 'Confirmación de despliegue preventivo'
              : 'Confirmación de salida a terreno'}
          </h2>
          <p className={styles.actionDescription}>
            {esPrevencion
              ? 'Presione el botón para informar al Centro de Mando que la patrulla ha tomado conocimiento del evento preventivo y se dirige al punto crítico con los recursos asignados.'
              : 'Presione el botón para informar al Centro de Mando que la patrulla ha tomado conocimiento de la emergencia y se dirige al lugar para iniciar la evaluación.'}
          </p>

          {errorAceptacion && (
            <div className={styles.errorAlert} role="alert">
              {errorAceptacion}
            </div>
          )}

          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={aceptando}
            icon={<CheckCircle size={20} />}
            onClick={handleAceptarMision}
            className={styles.actionPrimaryButton}
          >
            Aceptar Misión
          </Button>
        </section>
      )}

      {/* Vista activa: En Trayecto / Evaluación (HU-36) o Operación Preventiva (HU-33) */}
      {unidadActiva && esEnCurso && (
        <MisionEstadoActivoCard
          ariaLabel={
            esPrevencion
              ? 'Estado de operación preventiva'
              : 'Estado de traslado y evaluación'
          }
          icono={
            esPrevencion ? (
              <ShieldCheck
                size={20}
                color="var(--color-primary-teal-dark, #14505A)"
                aria-hidden="true"
              />
            ) : (
              <Navigation
                size={20}
                color="var(--color-primary-teal, #1B6F7D)"
                aria-hidden="true"
              />
            )
          }
          titulo={
            esPrevencion
              ? 'Operación Preventiva en Curso'
              : 'En Trayecto / Evaluación'
          }
          sincronizacionPendiente={Boolean(mision.sincronizacionPendiente)}
          mensajeOffline="Pendiente de sincronizar: La aceptación fue guardada en la cola local del dispositivo y se enviará automáticamente al recuperar conexión."
          mensajeConfirmacion={mensajeConfirmacion}
          estadosCanonicos={
            esPrevencion
              ? [
                  { etiqueta: 'Misión', valor: 'En curso' },
                  { etiqueta: 'Patrulla', valor: 'En prevención' },
                  { etiqueta: 'Operación', valor: 'Evento Preventivo' },
                ]
              : [
                  { etiqueta: 'Misión', valor: 'En curso' },
                  { etiqueta: 'Patrulla', valor: 'En verificación' },
                  { etiqueta: 'Incidente', valor: 'Verificando' },
                ]
          }
        />
      )}

      {esPrevencion && (
        <>
          <PrevencionMisionCard
            mision={mision}
            esOffline={status === 'offline'}
            onVerMapa={() => setMapaAbierto(true)}
          />
          {unidadActiva && esEnCurso && (
            <NotaInformativaReporte testId="nota-operacion-preventiva">
              Misión preventiva programada en punto crítico territorial, sin
              incidente previo asociado. Los formularios de categorización,
              prioridad y dictamen de incidente no aplican para despliegues
              preventivos.
            </NotaInformativaReporte>
          )}
        </>
      )}

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

      {esSoloLectura && <MisionSoloLecturaNotice />}

      <MapaModal
        abierto={mapaAbierto}
        alCerrar={() => setMapaAbierto(false)}
        latitud={mision.coordenadas?.lat}
        longitud={mision.coordenadas?.lng}
        titulo={mision.tipologia || mision.codigoIncidente}
        direccion={mision.direccion}
      />
    </div>
  );
}
