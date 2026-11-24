'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  MapPinCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  HardHat,
  Navigation,
  WifiOff,
  FileCheck,
  ClipboardCheck,
  LifeBuoy,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useConnectivity } from '@/hooks/useConnectivity';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { SeccionDesplegable } from '@/components/ui/SeccionDesplegable';
import { useToastOptional } from '@/components/ui/Toast';
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
import { UnidadInactivaBanner } from '@/components/common/UnidadInactivaBanner';
import { SinUnidadBanner } from '@/components/common/SinUnidadBanner';
import { MapaModal } from '@/components/maps/MapaModal';
import { useTelemetry } from '@/hooks/useTelemetry';
import {
  TelemetryStatusBadge,
  TelemetryWarningBanner,
} from '@/components/terreno/TelemetryStatusBadge';
import {
  RechazoMisionModal,
  type CoordenadasGPS,
} from '@/components/misiones/RechazoMisionModal';
import { CargaEvidenciaCard } from '@/components/misiones/CargaEvidenciaCard';
import { CierreMisionCuadrillaCard } from '@/components/misiones/CierreMisionCuadrillaCard';
import { SolicitudApoyoCuadrillaCard } from '@/components/misiones/SolicitudApoyoCuadrillaCard';
import {
  obtenerReporteCierreCuadrillaMision,
  type ResultadoCierreCuadrilla,
} from '@/services/cierreCuadrillaService';
import {
  obtenerSolicitudesApoyoMision,
  type ResultadoSolicitudApoyo,
} from '@/services/solicitudApoyoService';
import {
  obtenerDetalleMision,
  aceptarMision,
  rechazarMision,
  reportarLlegadaCuadrilla,
  GeolocationError,
} from '@/services/misionesService';
import { extraerAdjuntosDeMision } from '@/services/offlineQueue';
import { formatearEstado, formatearFechaHora24h } from '@/lib/utils/formatters';
import type { AdjuntoLocal, MisionLocal } from '@/types/offline';
import styles from '@/components/misiones/MisionDetailLayout.module.css';
import cuadrillaStyles from './CuadrillaDetailPage.module.css';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function CuadrillaMisionDetailPage({ params }: PageProps) {
  const resolvedParams =
    params && typeof (params as { then?: unknown }).then === 'function'
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
    esCuadrilla,
    tienePermiso,
  } = useAuth();
  const { status, pendientes, sincronizar, actualizarPendientes } = useConnectivity();

  const [mision, setMision] = useState<MisionLocal | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);
  const [aceptando, setAceptando] = useState<boolean>(false);
  const [errorAceptacion, setErrorAceptacion] = useState<string | null>(null);
  const [reportando, setReportando] = useState<boolean>(false);
  const [errorGps, setErrorGps] = useState<string | null>(null);
  const [puedeUsarContingencia, setPuedeUsarContingencia] = useState<boolean>(false);
  const [mensajeConfirmacion, setMensajeConfirmacion] = useState<string | null>(null);
  const [mapaAbierto, setMapaAbierto] = useState<boolean>(false);
  const [modalRechazoAbierto, setModalRechazoAbierto] = useState<boolean>(false);
  const [seccionApoyoAbierta, setSeccionApoyoAbierta] = useState<boolean>(true);
  const [seccionCierreAbierta, setSeccionCierreAbierta] = useState<boolean>(true);

  const estadoTelemetriaNormalizado = mision?.estado?.toUpperCase() || '';
  const misionActivaTelemetria = Boolean(
    unidadActiva &&
      (estadoTelemetriaNormalizado === 'EN_CURSO' ||
        estadoTelemetriaNormalizado === 'EN_RUTA' ||
        estadoTelemetriaNormalizado === 'EN_TERRENO' ||
        estadoTelemetriaNormalizado === 'ACEPTADA')
  );

  const { estado: estadoTelemetria, reintentar: reintentarTelemetria } = useTelemetry({
    unidadId: usuario?.unidadId ?? null,
    tipoUnidad: 'CUADRILLA',
    activa: misionActivaTelemetria,
  });

  const cargarDetalle = useCallback(
    async (silencioso = false) => {
      if (!silencioso) {
        setCargando(true);
      }
      try {
        const encontrada = await obtenerDetalleMision(misionId);
        setMision(encontrada || null);
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

  useEffect(() => {
    const handleSync = () => {
      void cargarDetalle(true);
    };
    window.addEventListener('sgrai:outbox-synced', handleSync);
    window.addEventListener('sgrai:mision-sincronizada', handleSync);
    return () => {
      window.removeEventListener('sgrai:outbox-synced', handleSync);
      window.removeEventListener('sgrai:mision-sincronizada', handleSync);
    };
  }, [cargarDetalle]);

  const handleAceptarAsignacion = async () => {
    if (!mision || aceptando) return;
    setAceptando(true);
    setErrorAceptacion(null);
    setMensajeConfirmacion(null);

    try {
      const resultado = await aceptarMision(mision.id, {
        misionActual: mision,
        tipoUnidad: 'cuadrilla',
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
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sgrai:mision_actualizada'));
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'No se pudo confirmar la aceptación de la asignación.';
      setErrorAceptacion(msg);
      if (toast) {
        toast.showError(msg, 'No se pudo aceptar la asignación');
      }
    } finally {
      setAceptando(false);
    }
  };

  const handleReportarLlegada = async (usarContingencia = false) => {
    if (!mision || reportando) return;
    setReportando(true);
    setErrorGps(null);
    setMensajeConfirmacion(null);

    try {
      const resultado = await reportarLlegadaCuadrilla(mision.id, {
        misionActual: mision,
        usarUbicacionMision: usarContingencia,
      });
      setMision(resultado.mision);
      setMensajeConfirmacion(resultado.mensaje);
      setPuedeUsarContingencia(false);
      if (toast) {
        if (resultado.enColaOffline) {
          toast.showWarning(resultado.mensaje, 'Guardado sin conexión', {
            dedupKey: `llegada-mision-offline-${mision.id}`,
          });
        } else if (resultado.yaReportadaPreviamente) {
          toast.showInfo(resultado.mensaje, 'Llegada ya registrada', {
            dedupKey: `llegada-mision-idemp-${mision.id}`,
          });
        } else {
          toast.showSuccess(resultado.mensaje, 'Llegada registrada', {
            dedupKey: `llegada-mision-${mision.id}`,
          });
        }
      }
      await actualizarPendientes();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sgrai:mision_actualizada'));
      }
    } catch (err) {
      if (err instanceof GeolocationError) {
        setErrorGps(err.message);
        if (mision.coordenadas && Boolean(mision.coordenadas.lat && mision.coordenadas.lng)) {
          setPuedeUsarContingencia(true);
        }
        if (toast) {
          toast.showWarning(err.message, 'Ubicación GPS no disponible');
        }
      } else {
        const msg =
          err instanceof Error
            ? err.message
            : 'No fue posible reportar la llegada a terreno. Intente nuevamente.';
        setErrorGps(msg);
        if (toast) {
          toast.showError(msg, 'No se pudo reportar la llegada');
        }
      }
    } finally {
      setReportando(false);
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
        backHref="/cuadrilla/misiones"
        backLabel={estadoAsignacion === 'DESACTIVADA' ? 'Historial' : 'Faenas'}
        status={status}
        pendingCount={pendientes}
        onRetry={sincronizar}
        descripcion="La misión solicitada no existe o no se encuentra asignada a su cuadrilla operativa, o no está disponible en caché local."
      />
    );
  }

  const estadoNormalizado = mision.estado?.toUpperCase() || '';
  const esDespachada = estadoNormalizado === 'DESPACHADA';
  const esEnCurso =
    estadoNormalizado === 'EN_CURSO' ||
    estadoNormalizado === 'EN_TERRENO' ||
    estadoNormalizado === 'ACEPTADA';
  const esFinalizada =
    estadoNormalizado === 'FINALIZADA' ||
    estadoNormalizado === 'COMPLETADA' ||
    estadoNormalizado === 'CERRADA';

  const tienePermisoEjecutar =
    typeof tienePermiso === 'function'
      ? tienePermiso('misiones:terreno:ejecutar')
      : false;
  const tienePermisoEvidencia =
    typeof tienePermiso === 'function' ? tienePermiso('reportes:crear') : false;

  // Prioridad H40: En estado DESPACHADA se muestra "Aceptar Asignación" y "Rechazar Misión" (H41)
  const mostrarBotonAceptar = Boolean(
    unidadActiva && esCuadrilla && tienePermisoEjecutar && esDespachada
  );
  const esRechazable = mostrarBotonAceptar;

  const esMisionActiva = esEnCurso;

  // H42 se habilita una vez aceptada la misión (EN_CURSO) y mientras no haya arribo registrado
  const tieneLlegadaRegistrada = Boolean(
    mision.fechaLlegada || mision.datosAdicionales?.hitoLlegada
  );
  const mostrarBotonLlegada = Boolean(
    unidadActiva &&
      esCuadrilla &&
      tienePermisoEjecutar &&
      esMisionActiva &&
      !tieneLlegadaRegistrada
  );

  // H43: Adjuntar evidencia multimedia en faena activa
  const puedeAdjuntarEvidencia = Boolean(
    unidadActiva && esCuadrilla && tienePermisoEvidencia && esMisionActiva
  );

  // H44: Solicitud de apoyo adicional en terreno (sin interrumpir la faena EN_CURSO)
  const puedeSolicitarApoyo = Boolean(
    unidadActiva && esCuadrilla && tienePermisoEvidencia && esMisionActiva
  );
  const solicitudesApoyo = obtenerSolicitudesApoyoMision(mision);
  const apoyoPendienteSync = solicitudesApoyo.some((s) => !s.sincronizado);
  const mostrarSeccionApoyo =
    puedeSolicitarApoyo || solicitudesApoyo.length > 0;

  // H68: Cierre técnico final de cuadrilla
  const puedeEjecutarCierre = Boolean(
    unidadActiva && esCuadrilla && tienePermisoEjecutar && esMisionActiva
  );

  const reporteCierreExistente = obtenerReporteCierreCuadrillaMision(mision);
  const reporteCierreEnviado =
    Boolean(reporteCierreExistente) ||
    Boolean(mision.datosAdicionales?.reporteCuadrillaEnviado) ||
    esFinalizada;

  const mostrarSeccionCierre =
    puedeEjecutarCierre ||
    Boolean(reporteCierreExistente) ||
    Boolean(mision.datosAdicionales?.reporteCuadrillaEnviado) ||
    (tieneUnidadAsignada && esFinalizada);
  const adjuntosMision = extraerAdjuntosDeMision(mision);
  const reporteTerrenoIdMision =
    typeof mision.datosAdicionales?.reporteTerrenoId === 'string'
      ? mision.datosAdicionales.reporteTerrenoId
      : undefined;

  const trabajoTexto =
    (mision.datosAdicionales?.trabajo as string) || mision.direccion;
  const justificacionRegistrada =
    typeof mision.datosAdicionales?.justificacionRechazo === 'string'
      ? mision.datosAdicionales.justificacionRechazo
      : null;
  const esSoloLectura =
    !unidadActiva || esFinalizada || estadoNormalizado === 'RECHAZADA';

  const estadoCuadrilla =
    typeof mision.datosAdicionales?.estadoCuadrilla === 'string'
      ? mision.datosAdicionales.estadoCuadrilla
      : 'EN_MISION';
  const estadoIncidente =
    typeof mision.datosAdicionales?.estadoIncidente === 'string'
      ? mision.datosAdicionales.estadoIncidente
      : 'EN_ATENCION';

  const fechaLlegadaDisplay = mision.fechaLlegada || mision.fechaInicio;
  const fechaCierreTexto =
    typeof mision.datosAdicionales?.fechaCierre === 'string'
      ? mision.datosAdicionales.fechaCierre
      : null;

  const handleConfirmarRechazo = async (
    motivo: string,
    coordenadas?: CoordenadasGPS
  ) => {
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
            actualizadoEn: new Date().toISOString(),
            datosAdicionales: {
              ...prev.datosAdicionales,
              justificacionRechazo: motivo,
            },
          }
        : null
    );
    setModalRechazoAbierto(false);
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
    await actualizarPendientes();
    router.push('/cuadrilla/misiones');
  };

  const handleEvidenciaCargada = async (adjunto: AdjuntoLocal) => {
    setMision((prev) => {
      if (!prev) return null;
      const actuales = extraerAdjuntosDeMision(prev);
      const filtrados = actuales.filter((item) => item.id !== adjunto.id);
      return {
        ...prev,
        datosAdicionales: {
          ...prev.datosAdicionales,
          adjuntos: [adjunto, ...filtrados],
        },
        actualizadoEn: new Date().toISOString(),
      };
    });
    await actualizarPendientes();
  };

  const handleApoyoSolicitado = async (resultado: ResultadoSolicitudApoyo) => {
    if (resultado.mision) {
      setMision(resultado.mision);
    }
    await actualizarPendientes();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sgrai:mision_actualizada'));
    }
  };

  const handleCierreEnviado = async (resultado: ResultadoCierreCuadrilla) => {
    if (resultado.mision) {
      setMision(resultado.mision);
    }
    setMensajeConfirmacion(resultado.mensaje);
    if (toast) {
      if (resultado.offline) {
        toast.showWarning(resultado.mensaje, 'Guardado sin conexión');
      } else {
        toast.showSuccess(resultado.mensaje, 'Misión cerrada');
      }
    }
    await actualizarPendientes();
    router.push('/cuadrilla/misiones');
  };

  return (
    <div className={styles.container}>
      <MisionDetalleTopBar
        backHref="/cuadrilla/misiones"
        backLabel={estadoAsignacion === 'DESACTIVADA' ? 'Historial' : 'Faenas'}
        status={status}
        pendingCount={pendientes}
        onRetry={sincronizar}
      />

      {!tieneUnidadAsignada ? (
        <SinUnidadBanner
          tipoUnidad="cuadrilla"
          nombreOperador={usuario?.nombre}
        />
      ) : !unidadActiva ? (
        <UnidadInactivaBanner
          tipoUnidad="cuadrilla"
          nombreUnidad={usuario?.unidadNombre}
        />
      ) : null}

      <MisionDetalleHeaderCard
        mision={mision}
        trabajoTexto={trabajoTexto}
        etiquetaFecha={
          esMisionActiva && mision.fechaInicio ? 'Inicio de trayecto' : 'Despachada'
        }
        fechaPrincipal={mision.fechaInicio || mision.fechaDespacho}
        fechaCierre={esFinalizada ? fechaCierreTexto : null}
        onVerMapa={() => setMapaAbierto(true)}
      />

      {!(unidadActiva && esMisionActiva) && mision.sincronizacionPendiente && (
        <div className={styles.offlineQueueBanner} role="status">
          <WifiOff size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span>
            Acción registrada localmente. Pendiente de sincronizar con el Centro de
            Mando.
          </span>
        </div>
      )}

      {!(unidadActiva && esMisionActiva) &&
        mensajeConfirmacion &&
        !mision.sincronizacionPendiente && (
          <div className={styles.SyncedBanner} role="status">
            {mensajeConfirmacion}
          </div>
        )}

      {/* Acciones Operativas de Despacho (H40 — Aceptar / H41 — Rechazar) */}
      {(mostrarBotonAceptar || esRechazable) && (
        <MisionDespachoActionsCard
          ariaLabel="Acciones operativas de despacho"
          titulo="Acciones de Despacho"
          descripcion="Confirme la aceptación para notificar a la central de operaciones que la cuadrilla inicia el desplazamiento y asume la atención de la emergencia, o registre un rechazo motivado si existe un impedimento técnico o de fuerza mayor."
          mostrarAceptar={mostrarBotonAceptar}
          etiquetaAceptar="Aceptar Asignación"
          aceptando={aceptando}
          errorAceptacion={errorAceptacion}
          onAceptar={() => void handleAceptarAsignacion()}
          mostrarRechazar={esRechazable}
          etiquetaRechazar="Rechazar Misión"
          rechazando={aceptando}
          onRechazar={() => setModalRechazoAbierto(true)}
        />
      )}

      {estadoNormalizado === 'RECHAZADA' && justificacionRegistrada && (
        <MisionRechazoBanner
          titulo="Misión Rechazada por Cuadrilla"
          justificacion={justificacionRegistrada}
        />
      )}

      {/* Vista activa: Faena en Curso (H40) */}
      {unidadActiva && esMisionActiva && (
        <MisionEstadoActivoCard
          ariaLabel="Estado de faena operativa"
          icono={
            <HardHat
              size={20}
              color="var(--color-primary-teal, #1B6F7D)"
              aria-hidden="true"
            />
          }
          titulo="Faena en Curso"
          sincronizacionPendiente={Boolean(mision.sincronizacionPendiente)}
          mensajeOffline="Pendiente de sincronizar: La acción fue guardada en la cola local del dispositivo y se enviará automáticamente al recuperar conexión."
          mensajeConfirmacion={mensajeConfirmacion}
          badgeExtra={
            <TelemetryStatusBadge
              estado={estadoTelemetria}
              onRetry={reintentarTelemetria}
            />
          }
          bannerExtra={
            <TelemetryWarningBanner
              estado={estadoTelemetria}
              onRetry={reintentarTelemetria}
            />
          }
          estadosCanonicos={[
            { etiqueta: 'Misión', valor: 'En curso' },
            { etiqueta: 'Cuadrilla', valor: formatearEstado(estadoCuadrilla) },
            { etiqueta: 'Incidente', valor: formatearEstado(estadoIncidente) },
          ]}
        />
      )}

      {/* Confirmación de arribo a terreno (H42 — Post-aceptación) */}
      {mostrarBotonLlegada && (
        <section
          className={cuadrillaStyles.arrivalCard}
          aria-label="Reporte de llegada a terreno"
        >
          <h2 className={cuadrillaStyles.arrivalTitle}>
            <MapPinCheck
              size={20}
              color="var(--color-primary-teal)"
              aria-hidden="true"
            />
            <span>Confirmación de arribo</span>
          </h2>
          <p className={cuadrillaStyles.arrivalDescription}>
            Presione el botón para certificar la presencia física del equipo en el
            lugar mediante las coordenadas GPS del dispositivo móvil y notificar a la
            central.
          </p>

          {errorGps && (
            <div className={cuadrillaStyles.arrivalAlertError} role="alert">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <AlertTriangle size={18} aria-hidden="true" />
                <span>{errorGps}</span>
              </div>

              {puedeUsarContingencia && (
                <div style={{ marginTop: 'var(--space-2)' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cuadrillaStyles.contingencyButton}
                    icon={<Navigation size={15} />}
                    loading={reportando}
                    onClick={() => handleReportarLlegada(true)}
                  >
                    Registrar llegada con ubicación de la misión
                  </Button>
                </div>
              )}
            </div>
          )}

          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={reportando}
            icon={<MapPinCheck size={20} />}
            onClick={() => handleReportarLlegada(false)}
            className={cuadrillaStyles.arrivalButton}
          >
            Llegada a Terreno
          </Button>
        </section>
      )}

      {/* Panel informativo cuando la cuadrilla ya registró arribo a terreno (H42) */}
      {unidadActiva && esMisionActiva && tieneLlegadaRegistrada && (
        <section
          className={cuadrillaStyles.activeWorkPanel}
          aria-label="Trabajos de terreno en curso"
        >
          <div className={cuadrillaStyles.activeWorkHeader}>
            <CheckCircle2 size={20} aria-hidden="true" />
            <span>En Trabajos de Terreno</span>
          </div>
          {fechaLlegadaDisplay && (
            <div className={cuadrillaStyles.activeWorkTimeRow}>
              <Clock size={16} color="var(--color-text-muted)" aria-hidden="true" />
              <span>
                Arribo registrado a las{' '}
                <span className={cuadrillaStyles.activeWorkTimeValue}>
                  {formatearFechaHora24h(fechaLlegadaDisplay)}
                </span>
              </span>
            </div>
          )}
          <p className={cuadrillaStyles.arrivalDescription}>
            La cuadrilla se encuentra operando en el sitio. Proceda con las maniobras
            de faena y el registro de evidencias multimedia.
          </p>
        </section>
      )}

      {/* Gestión Técnica de Faena: Solicitud de Apoyo (H44) y Cierre de Misión (H68 / H43) */}
      {mostrarSeccionCierre && (
        <section
          className={styles.evaluationFormsSection}
          data-testid="formularios-reporte-tecnico"
          aria-label="Gestión técnica y cierre de misión de cuadrilla"
        >
          <div className={styles.evaluationHeader}>
            <h3 className={styles.evaluationTitle}>
              <ClipboardCheck
                size={20}
                color="var(--color-primary-teal, #1B6F7D)"
                aria-hidden="true"
              />
              <span>Gestión Técnica de Faena</span>
            </h3>
          </div>

          <div className={styles.evaluationContent}>
            {mostrarSeccionApoyo && (
              <SeccionDesplegable
                titulo="Solicitar Apoyo Adicional"
                icono={<LifeBuoy size={18} aria-hidden="true" />}
                abierto={seccionApoyoAbierta}
                onToggle={setSeccionApoyoAbierta}
                indicador={
                  solicitudesApoyo.length > 0 ? (
                    <Chip variant="warning" size="sm">
                      {apoyoPendienteSync
                        ? `Pendiente sync (${solicitudesApoyo.length})`
                        : `Apoyo solicitado (${solicitudesApoyo.length})`}
                    </Chip>
                  ) : null
                }
              >
                <SolicitudApoyoCuadrillaCard
                  misionActual={mision}
                  deshabilitado={!puedeSolicitarApoyo}
                  onApoyoSolicitado={handleApoyoSolicitado}
                />
              </SeccionDesplegable>
            )}

            <SeccionDesplegable
              titulo="Finalizar Misión e Informe Técnico"
              icono={<FileCheck size={18} aria-hidden="true" />}
              abierto={seccionCierreAbierta}
              onToggle={setSeccionCierreAbierta}
              indicador={
                reporteCierreEnviado ? (
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
              <CierreMisionCuadrillaCard
                misionActual={mision}
                adjuntosMision={adjuntosMision}
                reporteTerrenoId={reporteTerrenoIdMision}
                puedeAdjuntarEvidencia={puedeAdjuntarEvidencia}
                usuarioActualId={usuario?.id}
                deshabilitado={!puedeEjecutarCierre}
                onCierreEnviado={handleCierreEnviado}
                onAdjuntarEvidencia={handleEvidenciaCargada}
              />
            </SeccionDesplegable>
          </div>
        </section>
      )}

      {/* Respaldo RBAC si cuenta con reportes:crear sin misiones:terreno:ejecutar */}
      {!mostrarSeccionCierre && mostrarSeccionApoyo && (
        <section
          className={styles.evidenceStandaloneWrapper}
          aria-label="Solicitud de apoyo adicional en terreno"
        >
          <SeccionDesplegable
            titulo="Solicitar Apoyo Adicional"
            icono={<LifeBuoy size={18} aria-hidden="true" />}
            abierto={seccionApoyoAbierta}
            onToggle={setSeccionApoyoAbierta}
            indicador={
              solicitudesApoyo.length > 0 ? (
                <Chip variant="warning" size="sm">
                  {apoyoPendienteSync
                    ? `Pendiente sync (${solicitudesApoyo.length})`
                    : `Apoyo solicitado (${solicitudesApoyo.length})`}
                </Chip>
              ) : null
            }
          >
            <SolicitudApoyoCuadrillaCard
              misionActual={mision}
              deshabilitado={!puedeSolicitarApoyo}
              onApoyoSolicitado={handleApoyoSolicitado}
            />
          </SeccionDesplegable>
        </section>
      )}

      {!mostrarSeccionCierre &&
        (puedeAdjuntarEvidencia || adjuntosMision.length > 0) && (
          <section
            id="seccion-evidencia-cuadrilla"
            className={styles.evidenceStandaloneWrapper}
            aria-label="Evidencia multimedia de la faena"
          >
            <CargaEvidenciaCard
              embebida
              misionId={mision.id}
              incidenteId={mision.incidenteId}
              reporteTerrenoId={reporteTerrenoIdMision}
              adjuntos={adjuntosMision}
              soloLectura={!puedeAdjuntarEvidencia}
              alAdjuntarEvidencia={handleEvidenciaCargada}
            />
          </section>
        )}

      {Array.isArray(mision.bitacoraTiempos) && mision.bitacoraTiempos.length > 0 && (
        <MisionBitacoraTimeline
          bitacora={mision.bitacoraTiempos}
          tipoUnidad="CUADRILLA"
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
        titulo="Rechazar Asignación de Cuadrilla"
        unidadEtiqueta="cuadrilla"
        alConfirmar={handleConfirmarRechazo}
        alCancelar={() => setModalRechazoAbierto(false)}
      />
    </div>
  );
}
