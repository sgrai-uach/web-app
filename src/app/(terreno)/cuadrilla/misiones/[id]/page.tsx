'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Archive,
  Map,
  MapPinCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Navigation,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useConnectivity } from '@/hooks/useConnectivity';
import { Button } from '@/components/ui/Button';
import { EstadoBadge } from '@/components/misiones/EstadoBadge';
import { ConnectionStatusBadge } from '@/components/common/ConnectionStatusBadge';
import { UnidadInactivaBanner } from '@/components/common/UnidadInactivaBanner';
import { MapaModal } from '@/components/maps/MapaModal';
import {
  obtenerDetalleMision,
  reportarLlegadaCuadrilla,
  GeolocationError,
} from '@/services/misionesService';
import { formatearPrioridad, formatearFechaHora24h } from '@/lib/utils/formatters';
import type { MisionLocal } from '@/types/offline';
import styles from './CuadrillaDetailPage.module.css';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function CuadrillaMisionDetailPage({ params }: PageProps) {
  const { id: misionId } = use(params);
  const { usuario, unidadActiva, tienePermiso } = useAuth();
  const { status, pendientes, sincronizar, actualizarPendientes } = useConnectivity();

  const [mision, setMision] = useState<MisionLocal | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);
  const [reportando, setReportando] = useState<boolean>(false);
  const [errorGps, setErrorGps] = useState<string | null>(null);
  const [puedeUsarContingencia, setPuedeUsarContingencia] = useState<boolean>(false);
  const [mensajeConfirmacion, setMensajeConfirmacion] = useState<string | null>(null);
  const [mapaAbierto, setMapaAbierto] = useState<boolean>(false);

  const cargarDetalle = useCallback(async () => {
    setCargando(true);
    try {
      const encontrada = await obtenerDetalleMision(misionId);
      if (encontrada) {
        setMision(encontrada);
      } else {
        setMision({
          id: misionId,
          incidenteId: `inc-${misionId}`,
          codigoIncidente: `INC-2026-${misionId.substring(0, 5).toUpperCase()}`,
          tipologia: 'Despeje de vía pública',
          direccion: 'Av. Ramón Picarte 1100, Valdivia',
          coordenadas: { lat: -39.81422, lng: -73.24591 },
          prioridad: 'ALTA',
          estado: unidadActiva ? 'DESPACHADA' : 'FINALIZADA',
          fechaDespacho: '2026-10-20T14:30:00Z',
          actualizadoEn: '2026-10-20T14:35:00Z',
        });
      }
    } finally {
      setCargando(false);
    }
  }, [misionId, unidadActiva]);

  useEffect(() => {
    void cargarDetalle();
  }, [cargarDetalle]);

  // Refrescar detalle local cuando la cola offline termine de sincronizarse al recuperar conexión
  useEffect(() => {
    const handleOutboxSynced = () => {
      void cargarDetalle();
    };
    window.addEventListener('sgrai:outbox-synced', handleOutboxSynced);
    return () => {
      window.removeEventListener('sgrai:outbox-synced', handleOutboxSynced);
    };
  }, [cargarDetalle]);

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
      await actualizarPendientes();
    } catch (err) {
      if (err instanceof GeolocationError) {
        setErrorGps(err.message);
        if (mision.coordenadas && Boolean(mision.coordenadas.lat && mision.coordenadas.lng)) {
          setPuedeUsarContingencia(true);
        }
      } else {
        const msg =
          err instanceof Error
            ? err.message
            : 'No fue posible reportar la llegada a terreno. Intente nuevamente.';
        setErrorGps(msg);
      }
    } finally {
      setReportando(false);
    }
  };

  if (cargando || !mision) {
    return (
      <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
        Cargando misión...
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
  const esEnCurso = estadoNormalizado === 'EN_CURSO';

  const tienePermisoEjecutar =
    typeof tienePermiso === 'function'
      ? tienePermiso('misiones:terreno:ejecutar')
      : false;

  const mostrarBotonLlegada =
    unidadActiva && esDespachada && tienePermisoEjecutar;

  const trabajoTexto = (mision.datosAdicionales?.trabajo as string) || mision.direccion;
  const esSoloLectura =
    !unidadActiva ||
    estadoNormalizado === 'FINALIZADA' ||
    estadoNormalizado === 'COMPLETADA' ||
    estadoNormalizado === 'CERRADA';

  const fechaLlegadaDisplay = mision.fechaLlegada || mision.fechaInicio;

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <Link href="/cuadrilla/misiones" className={styles.backLink}>
          <ArrowLeft size={16} aria-hidden="true" />
          <span>{unidadActiva ? 'Misiones' : 'Historial'}</span>
        </Link>
        <ConnectionStatusBadge
          status={status}
          pendingCount={pendientes}
          onRetry={sincronizar}
        />
      </div>

      {!unidadActiva && (
        <UnidadInactivaBanner
          tipoUnidad="cuadrilla"
          nombreUnidad={usuario?.unidadNombre}
        />
      )}

      {/* Banner de aviso cuando la llegada se encuentra guardada en la cola local */}
      {mision.sincronizacionPendiente && (
        <div className={styles.offlineAlertBanner} role="status">
          <WifiOff size={16} aria-hidden="true" />
          <span>
            Llegada registrada localmente. Pendiente de sincronizar con el Centro de Mando.
          </span>
        </div>
      )}

      {/* Mensaje de confirmación temporal */}
      {mensajeConfirmacion && !mision.sincronizacionPendiente && (
        <div className={styles.successAlertBanner} role="status">
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>{mensajeConfirmacion}</span>
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
          {/* Bloque Tipo */}
          <div className={styles.sectionBlock}>
            <span className={styles.itemLabel}>Tipo</span>
            <span className={`${styles.itemValue} ${styles.itemValueBold}`}>
              {mision.tipologia}
            </span>
          </div>

          {/* Bloque Ubicación */}
          <div className={styles.sectionBlock}>
            <span className={styles.itemLabel}>Ubicación</span>
            <div className={styles.locationActionRow}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={16} color="var(--color-primary-teal)" aria-hidden="true" />
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

          {/* Bloque Trabajo */}
          <div className={styles.sectionBlock}>
            <span className={styles.itemLabel}>Trabajo</span>
            <span className={styles.itemValue}>{trabajoTexto}</span>
          </div>

          {/* Fecha Despacho / Arribo */}
          <div className={styles.sectionBlock}>
            <span className={styles.itemLabel}>
              {esEnCurso && fechaLlegadaDisplay ? 'Arribo a Terreno' : 'Despachada'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={15} color="var(--color-text-muted)" aria-hidden="true" />
              <span className={styles.itemValue}>
                {formatearFechaHora24h(
                  esEnCurso && fechaLlegadaDisplay
                    ? fechaLlegadaDisplay
                    : mision.fechaDespacho
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Acción destacada: Llegada a Terreno (H42) */}
      {mostrarBotonLlegada && (
        <section
          className={styles.arrivalCard}
          aria-label="Reporte de llegada a terreno"
        >
          <h2 className={styles.arrivalTitle}>
            <MapPinCheck size={20} color="var(--color-primary-teal)" aria-hidden="true" />
            <span>Confirmación de arribo</span>
          </h2>
          <p className={styles.arrivalDescription}>
            Presione el botón para certificar la presencia física del equipo en el lugar
            mediante las coordenadas GPS del dispositivo móvil y notificar a la central.
          </p>

          {errorGps && (
            <div className={styles.arrivalAlertError} role="alert">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <AlertTriangle size={18} aria-hidden="true" />
                <span>{errorGps}</span>
              </div>

              {puedeUsarContingencia && (
                <div style={{ marginTop: 'var(--space-2)' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    className={styles.contingencyButton}
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
            className={styles.arrivalButton}
          >
            Llegada a Terreno
          </Button>
        </section>
      )}

      {/* Panel informativo cuando la misión se encuentra En Trabajos de Terreno */}
      {esEnCurso && (
        <section
          className={styles.activeWorkPanel}
          aria-label="Trabajos de terreno en curso"
        >
          <div className={styles.activeWorkHeader}>
            <CheckCircle2 size={20} aria-hidden="true" />
            <span>En Trabajos de Terreno</span>
          </div>
          {fechaLlegadaDisplay && (
            <div className={styles.activeWorkTimeRow}>
              <Clock size={16} color="var(--color-text-muted)" aria-hidden="true" />
              <span>
                Arribo registrado a las{' '}
                <span className={styles.activeWorkTimeValue}>
                  {formatearFechaHora24h(fechaLlegadaDisplay)}
                </span>
              </span>
            </div>
          )}
          <p className={styles.arrivalDescription}>
            La cuadrilla se encuentra operando en el sitio. Proceda con las maniobras de faena
            y el registro de evidencias multimedia.
          </p>
        </section>
      )}

      {esSoloLectura && (
        <div className={styles.readOnlyNotice}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
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
