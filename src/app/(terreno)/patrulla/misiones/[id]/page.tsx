'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
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
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useConnectivity } from '@/hooks/useConnectivity';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EstadoBadge } from '@/components/misiones/EstadoBadge';
import { obtenerVarianteChipPrioridad } from '@/lib/utils/chipVariants';
import { ConnectionStatusBadge } from '@/components/common/ConnectionStatusBadge';
import { UnidadInactivaBanner } from '@/components/common/UnidadInactivaBanner';
import { SinUnidadBanner } from '@/components/common/SinUnidadBanner';
import { MapaModal } from '@/components/maps/MapaModal';
import { SeccionDesplegable } from '@/components/ui/SeccionDesplegable';
import { EvaluacionTipologiaCard } from '@/components/misiones/EvaluacionTipologiaCard';
import { EvaluacionPrioridadCard } from '@/components/misiones/EvaluacionPrioridadCard';
import {
  obtenerDetalleMision,
  aceptarMisionPatrulla,
} from '@/services/misionesService';
import { formatearPrioridad, formatearFechaHora24h, formatearTipologia } from '@/lib/utils/formatters';
import type { MisionLocal } from '@/types/offline';
import styles from './PatrullaDetailPage.module.css';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PatrullaMisionDetailPage({ params }: PageProps) {
  const { id: misionId } = use(params);
  const { usuario, unidadActiva, tieneUnidadAsignada, tienePermiso } = useAuth();
  const { status, pendientes, sincronizar, actualizarPendientes } = useConnectivity();
  const [mision, setMision] = useState<MisionLocal | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);
  const [aceptando, setAceptando] = useState<boolean>(false);
  const [mensajeConfirmacion, setMensajeConfirmacion] = useState<string | null>(null);
  const [errorAceptacion, setErrorAceptacion] = useState<string | null>(null);
  const [mapaAbierto, setMapaAbierto] = useState<boolean>(false);
  const [seccionCategorizacionAbierta, setSeccionCategorizacionAbierta] = useState<boolean>(true);
  const [seccionPrioridadAbierta, setSeccionPrioridadAbierta] = useState<boolean>(false);

  const cargarDetalle = useCallback(async () => {
    setCargando(true);
    try {
      const encontrada = await obtenerDetalleMision(misionId);
      if (encontrada) {
        setMision(encontrada);
        const reportesCount = Array.isArray(encontrada.datosAdicionales?.reportesPrioridad)
          ? encontrada.datosAdicionales.reportesPrioridad.length
          : Array.isArray(encontrada.datosAdicionales?.reportesTerreno)
            ? encontrada.datosAdicionales.reportesTerreno.length
            : 0;
        const tipologiaYaEvaluada = Boolean(encontrada.datosAdicionales?.tipologiaEvaluada);
        const prioridadYaEvaluada =
          Boolean(encontrada.datosAdicionales?.prioridadEvaluada) || reportesCount > 0;

        setSeccionCategorizacionAbierta(!tipologiaYaEvaluada);
        setSeccionPrioridadAbierta(tipologiaYaEvaluada && !prioridadYaEvaluada);
      } else {
        setMision({
          id: misionId,
          incidenteId: `inc-${misionId}`,
          codigoIncidente: `INC-2026-${misionId.substring(0, 5).toUpperCase()}`,
          tipologia: 'Caída de árbol',
          direccion: 'Av. Alemania 600, Valdivia',
          coordenadas: { lat: -39.81, lng: -73.24 },
          prioridad: 'ALTA',
          estado: unidadActiva ? 'DESPACHADA' : 'FINALIZADA',
          fechaDespacho: '2026-10-18T11:00:00Z',
          actualizadoEn: '2026-10-18T11:45:00Z',
        });
      }
    } finally {
      setCargando(false);
    }
  }, [misionId, unidadActiva]);

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

  if (cargando || !mision) {
    return (
      <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
        Cargando misión...
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

  const mostrarBotonAceptar =
    unidadActiva && esDespachada && tienePermisoVerificar;

  const trabajoTexto =
    (mision.datosAdicionales?.trabajo as string) || mision.direccion;
  const esSoloLectura =
    !unidadActiva ||
    estadoNormalizado === 'FINALIZADA' ||
    estadoNormalizado === 'COMPLETADA' ||
    estadoNormalizado === 'CERRADA';

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <Link href="/patrulla/misiones" className={styles.backLink}>
          <ArrowLeft size={16} aria-hidden="true" />
          <span>{unidadActiva ? 'Misiones' : 'Historial'}</span>
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
            Presione el botón para informar al Centro de Mando que la patrulla ha
            tomado conocimiento de la emergencia y se dirige al lugar para iniciar
            la evaluación.
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
        <>
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
                  En Trayecto / Evaluación
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
                  <span className={styles.canonicalStateValue}>En verificación</span>
                </div>
                <div className={styles.canonicalStateItem}>
                  <span className={styles.canonicalStateLabel}>Incidente</span>
                  <span className={styles.canonicalStateValue}>Verificando</span>
                </div>
              </div>
            </div>
          </section>

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
                const reportesPrioridadCount = Array.isArray(
                  mision.datosAdicionales?.reportesPrioridad
                )
                  ? mision.datosAdicionales.reportesPrioridad.length
                  : Array.isArray(mision.datosAdicionales?.reportesTerreno)
                    ? mision.datosAdicionales.reportesTerreno.length
                    : 0;
                const tipologiaCompletada = Boolean(
                  mision.datosAdicionales?.tipologiaEvaluada
                );
                const prioridadCompletada =
                  Boolean(mision.datosAdicionales?.prioridadEvaluada) ||
                  reportesPrioridadCount > 0;
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
                        onTipologiaActualizada={(resultado) => {
                          if (resultado.mision) {
                            setMision(resultado.mision);
                          }
                          setSeccionCategorizacionAbierta(false);
                          if (!prioridadCompletada) {
                            setSeccionPrioridadAbierta(true);
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
                          onPrioridadActualizada={(resultado) => {
                            if (resultado.mision) {
                              setMision(resultado.mision);
                            }
                            setSeccionPrioridadAbierta(false);
                            void actualizarPendientes();
                          }}
                        />
                      )}
                    </SeccionDesplegable>
                  </>
                );
              })()}
            </div>
          </section>
        </>
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
