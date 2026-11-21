'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Archive,
  Map,
  Tag,
  CheckCircle,
  CheckCircle2,
  Navigation,
  ClipboardCheck,
  WifiOff,
  AlertCircle,
  ShieldAlert,
  FileCheck,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useConnectivity } from '@/hooks/useConnectivity';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { useToastOptional } from '@/components/ui/Toast';
import { EstadoBadge } from '@/components/misiones/EstadoBadge';
import { obtenerVarianteChipPrioridad } from '@/lib/utils/chipVariants';
import { ConnectionStatusBadge } from '@/components/common/ConnectionStatusBadge';
import { UnidadInactivaBanner } from '@/components/common/UnidadInactivaBanner';
import { SinUnidadBanner } from '@/components/common/SinUnidadBanner';
import { MapaModal } from '@/components/maps/MapaModal';
import { SeccionDesplegable } from '@/components/ui/SeccionDesplegable';
import { EvaluacionTipologiaCard } from '@/components/misiones/EvaluacionTipologiaCard';
import { EvaluacionPrioridadCard } from '@/components/misiones/EvaluacionPrioridadCard';
import { EvaluacionReporteCierreCard } from '@/components/misiones/EvaluacionReporteCierreCard';
import { RecuperacionMisionEstadoCard } from '@/components/misiones/RecuperacionMisionEstadoCard';
import {
  obtenerDetalleMision,
  aceptarMisionPatrulla,
} from '@/services/misionesService';
import { obtenerReportesPrioridadMision } from '@/services/prioridadService';
import { obtenerReporteVerificacionMision } from '@/services/reporteVerificacionService';
import { formatearPrioridad, formatearFechaHora24h, formatearTipologia } from '@/lib/utils/formatters';
import type { MisionLocal } from '@/types/offline';
import styles from './PatrullaDetailPage.module.css';

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
        return encontrada;
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
    const handleMisionSincronizada = async () => {
      const estadoAnterior = mision?.estado?.toUpperCase() || '';
      const esRecup = mision?.tipoMision === 'RECUPERACION';
      const actualizada = await cargarDetalle(true);
      const estadoNuevo = actualizada?.estado?.toUpperCase() || '';
      const pasoAFinalizada =
        estadoAnterior !== 'COMPLETADA' &&
        estadoAnterior !== 'FINALIZADA' &&
        estadoAnterior !== 'CERRADA' &&
        (estadoNuevo === 'COMPLETADA' ||
          estadoNuevo === 'FINALIZADA' ||
          estadoNuevo === 'CERRADA');

      if ((esRecup || actualizada?.tipoMision === 'RECUPERACION') && pasoAFinalizada) {
        toast?.showSuccess(
          'El operativo de recuperación fue declarado concluido. La patrulla quedó disponible.',
          'Misión completada'
        );
      }
    };
    window.addEventListener('sgrai:outbox-synced', handleOutboxSynced);
    window.addEventListener('sgrai:mision-sincronizada', handleMisionSincronizada);
    return () => {
      window.removeEventListener('sgrai:outbox-synced', handleOutboxSynced);
      window.removeEventListener('sgrai:mision-sincronizada', handleMisionSincronizada);
    };
  }, [cargarDetalle, mision?.estado, mision?.tipoMision, toast]);

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
      <div className={styles.container}>
        <div className={styles.topBar}>
          <Link href="/patrulla/misiones" className={styles.backLink}>
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Misiones</span>
          </Link>
          <ConnectionStatusBadge
            status={status}
            pendingCount={pendientes}
            onRetry={sincronizar}
          />
        </div>
        <div
          style={{
            backgroundColor: 'var(--color-white)',
            border: '1px solid var(--color-border)',
            padding: 'var(--space-6)',
            textAlign: 'center',
          }}
          role="alert"
        >
          <p style={{ fontWeight: 700, margin: '0 0 var(--space-2) 0' }}>
            Misión no encontrada
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>
            La misión solicitada no existe, fue removida o no se encuentra disponible en caché local.
          </p>
        </div>
      </div>
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

  const esRecuperacion = mision.tipoMision === 'RECUPERACION';
  const trabajoTexto =
    (mision.datosAdicionales?.trabajo as string) || mision.direccion;
  const esFinalizada =
    estadoNormalizado === 'FINALIZADA' ||
    estadoNormalizado === 'COMPLETADA' ||
    estadoNormalizado === 'CERRADA';
  const esSoloLectura = !unidadActiva || esFinalizada;
  const mostrarFormulariosTecnicos =
    !esRecuperacion &&
    ((unidadActiva && esEnCurso) || (tieneUnidadAsignada && esFinalizada));

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <Link href="/patrulla/misiones" className={styles.backLink}>
          <ArrowLeft size={16} aria-hidden="true" />
          <span>{estadoAsignacion === 'DESACTIVADA' ? 'Historial' : 'Misiones'}</span>
        </Link>
        <ConnectionStatusBadge
          status={status}
          pendingCount={pendientes}
          onRetry={sincronizar}
        />
      </div>

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

      <div className={styles.missionHeader}>
        <div className={styles.headerRow}>
          <div className={styles.codeArea}>
            <AlertCircle
              size={20}
              color="var(--color-primary-teal, #1B6F7D)"
              aria-hidden="true"
            />
            <span className={styles.code}>{mision.codigoIncidente}</span>
            <Chip variant={obtenerVarianteChipPrioridad(mision.prioridad)} size="md">
              {formatearPrioridad(mision.prioridad)}
            </Chip>
          </div>
          <EstadoBadge estado={mision.estado} size="md" />
        </div>

        <div className={styles.detailGrid}>
          {/* Bloque Tipo (único en negrita) */}
          <div className={styles.sectionBlock}>
            <span className={styles.itemLabel}>Tipo</span>
            <span className={`${styles.itemValue} ${styles.itemValueBold}`}>
              {formatearTipologia(mision.tipologia)}
            </span>
          </div>

          {/* Bloque Ubicación separado */}
          <div className={styles.sectionBlock}>
            <span className={styles.itemLabel}>Ubicación</span>
            <div className={styles.locationActionRow}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin
                  size={16}
                  color="var(--color-primary-teal)"
                  aria-hidden="true"
                />
                <span className={styles.itemValue}>{mision.direccion}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                icon={<Map size={14} />}
                onClick={() => setMapaAbierto(true)}
              >
                Ver mapa
              </Button>
            </div>
          </div>

          {/* Bloque Trabajo separado */}
          <div className={styles.sectionBlock}>
            <span className={styles.itemLabel}>Trabajo</span>
            <span className={styles.itemValue}>{trabajoTexto}</span>
          </div>

          {/* Fecha Despachada / Inicio */}
          <div className={styles.sectionBlock}>
            <span className={styles.itemLabel}>
              {esEnCurso && mision.fechaInicio ? 'Inicio de trayecto' : 'Despachada'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar
                size={15}
                color="var(--color-text-muted)"
                aria-hidden="true"
              />
              <span className={styles.itemValue}>
                {formatearFechaHora24h(mision.fechaInicio || mision.fechaDespacho)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Acción principal: Confirmar y Aceptar Misión (HU-36) */}
      {mostrarBotonAceptar && (
        <section
          className={styles.acceptCard}
          aria-label="Confirmación de salida de patrulla"
        >
          <h2 className={styles.acceptTitle}>Confirmación de salida a terreno</h2>
          <p className={styles.acceptDescription}>
            {esRecuperacion
              ? 'Presione el botón para informar al Centro de Mando que la patrulla ha tomado conocimiento del operativo de recuperación y se dirige al sector para iniciar las labores de entrega o rehabilitación.'
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
            className={styles.acceptButton}
          >
            Aceptar Misión
          </Button>
        </section>
      )}

      {/* Vista activa: En Trayecto / Evaluación (HU-36) */}
      {unidadActiva && esEnCurso && (
        <section
          className={styles.enTrayectoCard}
          aria-label="Estado de traslado y evaluación"
        >
          <div className={styles.enTrayectoHeader}>
            <div className={styles.enTrayectoTitleRow}>
              <Navigation
                size={20}
                color="var(--color-primary-teal, #1B6F7D)"
                aria-hidden="true"
              />
              <h2 className={styles.enTrayectoTitle}>
                {esRecuperacion ? 'En Trayecto / Recuperación' : 'En Trayecto / Evaluación'}
              </h2>
            </div>
            <Chip variant="success" size="sm">
              Misión activa
            </Chip>
          </div>

          <div className={styles.enTrayectoContent}>
            {mision.sincronizacionPendiente ? (
              <div className={styles.offlineQueueBanner} role="status">
                <WifiOff size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
                <span>
                  Pendiente de sincronizar: La aceptación fue guardada en la cola
                  local del dispositivo y se enviará automáticamente al recuperar
                  conexión.
                </span>
              </div>
            ) : (
              mensajeConfirmacion && (
                <div className={styles.SyncedBanner} role="status">
                  {mensajeConfirmacion}
                </div>
              )
            )}

            <div className={styles.canonicalStatesGrid}>
              <div className={styles.canonicalStateItem}>
                <span className={styles.canonicalStateLabel}>Misión</span>
                <span className={styles.canonicalStateValue}>En curso</span>
              </div>
              <div className={styles.canonicalStateItem}>
                <span className={styles.canonicalStateLabel}>Patrulla</span>
                <span className={styles.canonicalStateValue}>
                  {esRecuperacion ? 'En recuperación' : 'En verificación'}
                </span>
              </div>
              <div className={styles.canonicalStateItem}>
                <span className={styles.canonicalStateLabel}>
                  {esRecuperacion ? 'Operativo' : 'Incidente'}
                </span>
                <span className={styles.canonicalStateValue}>
                  {esRecuperacion ? 'En ejecución' : 'Verificando'}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {esRecuperacion && (esEnCurso || esFinalizada) && (
        <section
          className={styles.evaluationFormsSection}
          aria-label="Estado de misión de recuperación"
        >
          <div className={styles.evaluationContent}>
            <RecuperacionMisionEstadoCard mision={mision} />
          </div>
        </section>
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

      {esSoloLectura && (
        <div className={styles.readOnlyNotice}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Archive size={16} aria-hidden="true" />
            <span>Solo lectura</span>
          </div>
        </div>
      )}

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
