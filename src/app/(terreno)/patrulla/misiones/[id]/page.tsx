'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, MapPin, Calendar, Archive, Map, XCircle, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { EstadoBadge } from '@/components/misiones/EstadoBadge';
import { obtenerDetalleMision, rechazarMision } from '@/services/misionesService';
import { UnidadInactivaBanner } from '@/components/common/UnidadInactivaBanner';
import { MapaModal } from '@/components/maps/MapaModal';
import { RechazoMisionModal, type CoordenadasGPS } from '@/components/misiones/RechazoMisionModal';
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
  const { usuario, unidadActiva } = useAuth();

  const [mision, setMision] = useState<MisionLocal | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);
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
        setMision({
          id: misionId,
          incidenteId: `inc-${misionId}`,
          codigoIncidente: `INC-2026-${misionId.substring(0, 5).toUpperCase()}`,
          tipologia: 'Caída de árbol',
          direccion: 'Av. Alemania 600, Valdivia',
          coordenadas: { lat: -39.81, lng: -73.24 },
          prioridad: 'ALTA',
          estado: 'FINALIZADA',
          fechaDespacho: '2026-10-18T11:00:00Z',
          actualizadoEn: '2026-10-18T11:45:00Z',
        });
      }
    } finally {
      setCargando(false);
    }
  }, [misionId]);

  useEffect(() => {
    cargarDetalle();
  }, [cargarDetalle]);

  if (cargando || !mision) {
    return <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>Cargando misión...</div>;
  }

  const normPrioridad = mision.prioridad?.toUpperCase() || '';
  let prioridadClase = styles.priorityNeutro;
  if (normPrioridad === 'CRITICA') {
    prioridadClase = styles.priorityCritica;
  } else if (normPrioridad === 'ALTA') {
    prioridadClase = styles.priorityAlta;
  }

  const trabajoTexto = (mision.datosAdicionales?.trabajo as string) || mision.direccion;
  const esSoloLectura =
    !unidadActiva ||
    mision.estado === 'FINALIZADA' ||
    mision.estado === 'COMPLETADA' ||
    mision.estado === 'CERRADA' ||
    mision.estado === 'RECHAZADA';

  const estadoNorm = mision.estado?.toUpperCase() || '';
  const esRechazable =
    unidadActiva &&
    (estadoNorm === 'DESPACHADA' || estadoNorm === 'ASIGNADA' || estadoNorm === 'PENDIENTE');

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
            actualizadoEn: res.mision?.actualizadoEn || new Date().toISOString(),
            datosAdicionales: {
              ...prev.datosAdicionales,
              justificacionRechazo: motivo,
            },
          }
        : prev
    );

    setModalRechazoAbierto(false);
    setFeedbackMensaje({
      tipo: res.modoOffline ? 'offline' : 'success',
      texto: res.mensaje,
    });
  };

  return (
    <div className={styles.container}>
      <Link href="/patrulla/misiones" className={styles.backLink}>
        <ArrowLeft size={16} aria-hidden="true" />
        <span>Historial</span>
      </Link>

      {!unidadActiva && (
        <UnidadInactivaBanner
          tipoUnidad="patrulla"
          nombreUnidad={usuario?.unidadNombre}
        />
      )}

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

      {estadoNorm === 'RECHAZADA' && (
        <div className={styles.rejectedBanner} role="status">
          <div className={styles.rejectedHeader}>
            <XCircle size={18} aria-hidden="true" />
            <span>Misión Rechazada por Patrulla Verificadora</span>
          </div>
          {mision.datosAdicionales?.justificacionRechazo && (
            <p className={styles.rejectedReason}>
              <strong>Motivo documentado:</strong>{' '}
              {String(mision.datosAdicionales.justificacionRechazo)}
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

          {/* Bloque Trabajo separado */}
          <div className={styles.sectionBlock}>
            <span className={styles.itemLabel}>Trabajo</span>
            <span className={styles.itemValue}>{trabajoTexto}</span>
          </div>

          {/* Fecha Despachada */}
          <div className={styles.sectionBlock}>
            <span className={styles.itemLabel}>Despachada</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={15} color="var(--color-text-muted)" aria-hidden="true" />
              <span className={styles.itemValue}>
                {formatearFechaHora24h(mision.fechaDespacho)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {esRechazable && (
        <div className={styles.tacticalActionCard}>
          <h3 className={styles.tacticalActionTitle}>Acciones Operativas de Despacho</h3>
          <p className={styles.tacticalActionDesc}>
            Verifique los antecedentes del incidente antes de concurrir. Si la patrulla presenta
            desperfectos o atiende una emergencia prioritaria, debe fundamentar el rechazo con un motivo justificado.
          </p>
          <div className={styles.tacticalActionButtons}>
            <Button
              variant="destructive"
              size="md"
              fullWidth
              icon={<XCircle size={18} />}
              onClick={() => setModalRechazoAbierto(true)}
            >
              Rechazar Misión
            </Button>
          </div>
        </div>
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

      <RechazoMisionModal
        abierto={modalRechazoAbierto}
        codigoMision={mision.codigoIncidente}
        alConfirmar={handleConfirmarRechazo}
        alCancelar={() => setModalRechazoAbierto(false)}
      />
    </div>
  );
}
