'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Archive,
  Map,
  XCircle,
  CheckCircle,
  AlertCircle,
  Navigation,
  ClipboardCheck,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useConnectivity } from '@/hooks/useConnectivity';
import { Button } from '@/components/ui/Button';
import { EstadoBadge } from '@/components/misiones/EstadoBadge';
import { ConnectionStatusBadge } from '@/components/common/ConnectionStatusBadge';
import { UnidadInactivaBanner } from '@/components/common/UnidadInactivaBanner';
import { SinUnidadBanner } from '@/components/common/SinUnidadBanner';
import { MapaModal } from '@/components/maps/MapaModal';
import { RechazoMisionModal, type CoordenadasGPS } from '@/components/misiones/RechazoMisionModal';
import {
  obtenerDetalleMision,
  aceptarMisionPatrulla,
  rechazarMision,
} from '@/services/misionesService';
import { formatearPrioridad, formatearFechaHora24h } from '@/lib/utils/formatters';
import type { MisionLocal } from '@/types/offline';
import styles from './PatrullaDetailPage.module.css';

interface PageProps {
  params: Promise<{ id: string }> | { id: string };
}

export default function PatrullaMisionDetailPage({ params }: PageProps) {
  const resolvedParams =
    params && typeof (params as { then?: unknown }).then === 'function'
      ? use(params as Promise<{ id: string }>)
      : (params as { id: string });
  const misionId = resolvedParams?.id;
  const { usuario, unidadActiva, tieneUnidadAsignada, tienePermiso, esPatrulla } = useAuth();
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
      if (encontrada) {
        setMision(encontrada);
      } else {
        setMision(null);
      }
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
        </div>
        <div className={styles.detailCard} style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
          <AlertCircle size={40} color="var(--color-text-muted)" aria-hidden="true" style={{ margin: '0 auto var(--space-3)' }} />
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 var(--space-2)' }}>
            Misión no encontrada
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '0 0 var(--space-4)' }}>
            La misión solicitada no existe o no se encuentra asignada a su unidad operativa.
          </p>
          <Link
            href="/patrulla/misiones"
            style={{
              display: 'inline-block',
              padding: 'var(--space-2) var(--space-4)',
              background: 'var(--color-primary-teal)',
              color: 'var(--color-white)',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            Volver a la bandeja
          </Link>
        </div>
      </div>
    );
  }

  const normPrioridad = mision.prioridad?.toUpperCase() || '';
  let prioridadClase = styles.priorityNeutro;
  if (normPrioridad === 'CRITICA') {
    prioridadClase = styles.priorityCritica;
  } else if (normPrioridad === 'ALTA') {
    prioridadClase = styles.priorityAlta;
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
    } catch (err) {
      setModalRechazoAbierto(false);
      setFeedbackMensaje({
        tipo: 'offline',
        texto:
          err instanceof Error
            ? err.message
            : 'No se pudo registrar el rechazo de la misión.',
      });
    }
  };

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

      <div className={styles.missionHeader}>
        <div className={styles.headerRow}>
          <div className={styles.codeArea}>
            <span className={styles.code}>{mision.codigoIncidente}</span>
            <span className={`${styles.priorityChip} ${prioridadClase}`}>
              {formatearPrioridad(mision.prioridad)}
            </span>
          </div>
          <EstadoBadge estado={mision.estado} />
        </div>

        <div className={styles.detailGrid}>
          {/* Bloque Tipo (único en negrita) */}
          <div className={styles.sectionBlock}>
            <span className={styles.itemLabel}>Tipo</span>
            <span className={`${styles.itemValue} ${styles.itemValueBold}`}>
              {mision.tipologia}
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

      {/* Acciones Operativas de Despacho (H36 / H69) */}
      {(mostrarBotonAceptar || esRechazable) && (
        <section
          className={styles.dispatchActionsCard}
          aria-label="Acciones operativas de despacho"
        >
          <h2 className={styles.dispatchActionsTitle}>Acciones de Despacho</h2>
          <p className={styles.dispatchActionsDesc}>
            Confirme la salida a terreno para evaluar o fundamente el rechazo si no es posible concurrir.
          </p>

          {errorAceptacion && (
            <div className={styles.errorAlert} role="alert">
              {errorAceptacion}
            </div>
          )}

          <div className={styles.dispatchButtonsGroup}>
            {mostrarBotonAceptar && (
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
            )}

            {esRechazable && (
              <Button
                variant="destructive"
                size="md"
                fullWidth
                icon={<XCircle size={18} />}
                onClick={() => setModalRechazoAbierto(true)}
                disabled={aceptando}
              >
                Rechazar Misión
              </Button>
            )}
          </div>
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
                  color="var(--color-primary-teal)"
                  aria-hidden="true"
                />
                <h2 className={styles.enTrayectoTitle}>
                  En Trayecto / Evaluación
                </h2>
              </div>
              <span className={styles.activeStatusChip}>Misión activa</span>
            </div>

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
          </section>

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
              <span className={styles.activeStatusChip}>Habilitado</span>
            </div>
            <p className={styles.evaluationBody}>
              La unidad se encuentra en trayecto / evaluación. Los formularios
              operativos para categorizar el incidente, ajustar la prioridad y
              enviar el reporte de situación están habilitados.
            </p>
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

      <RechazoMisionModal
        abierto={modalRechazoAbierto}
        codigoMision={mision.codigoIncidente}
        alConfirmar={handleConfirmarRechazo}
        alCancelar={() => setModalRechazoAbierto(false)}
      />
    </div>
  );
}
