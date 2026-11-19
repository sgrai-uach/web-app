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
  XCircle,
  CheckCircle2,
  AlertCircle,
  WifiOff,
  FileCheck,
  Wrench,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useConnectivity } from '@/hooks/useConnectivity';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { SeccionDesplegable } from '@/components/ui/SeccionDesplegable';
import { useToastOptional } from '@/components/ui/Toast';
import { EstadoBadge } from '@/components/misiones/EstadoBadge';
import { ConnectionStatusBadge } from '@/components/common/ConnectionStatusBadge';
import { obtenerVarianteChipPrioridad } from '@/lib/utils/chipVariants';
import { UnidadInactivaBanner } from '@/components/common/UnidadInactivaBanner';
import { SinUnidadBanner } from '@/components/common/SinUnidadBanner';
import { MapaModal } from '@/components/maps/MapaModal';
import {
  RechazoMisionModal,
  type CoordenadasGPS,
} from '@/components/misiones/RechazoMisionModal';
import { CargaEvidenciaCard } from '@/components/misiones/CargaEvidenciaCard';
import { CierreMisionCuadrillaCard } from '@/components/misiones/CierreMisionCuadrillaCard';
import {
  obtenerReporteCierreCuadrillaMision,
  type ResultadoCierreCuadrilla,
} from '@/services/cierreCuadrillaService';
import { obtenerDetalleMision, rechazarMision } from '@/services/misionesService';
import { extraerAdjuntosDeMision } from '@/services/offlineQueue';
import {
  formatearPrioridad,
  formatearFechaHora24h,
  formatearTipologia,
} from '@/lib/utils/formatters';
import type { AdjuntoLocal, MisionLocal } from '@/types/offline';
import styles from './CuadrillaDetailPage.module.css';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function CuadrillaMisionDetailPage({ params }: PageProps) {
  const resolvedParams =
    params && typeof (params as { then?: unknown }).then === 'function'
      ? use(params)
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
  const [mapaAbierto, setMapaAbierto] = useState<boolean>(false);
  const [modalRechazoAbierto, setModalRechazoAbierto] = useState<boolean>(false);
  const [mensajeConfirmacion, setMensajeConfirmacion] = useState<string | null>(null);
  const [seccionCierreAbierta, setSeccionCierreAbierta] = useState<boolean>(true);

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
          <Link href="/cuadrilla/misiones" className={styles.backLink}>
            <ArrowLeft size={16} aria-hidden="true" />
            <span>{estadoAsignacion === 'DESACTIVADA' ? 'Historial' : 'Faenas'}</span>
          </Link>
          <ConnectionStatusBadge
            status={status}
            pendingCount={pendientes}
            onRetry={sincronizar}
          />
        </div>
        <div
          className={styles.missionHeader}
          style={{ textAlign: 'center', padding: 'var(--space-6)' }}
          role="alert"
        >
          <AlertCircle
            size={40}
            color="var(--color-text-muted)"
            aria-hidden="true"
            style={{ margin: '0 auto var(--space-2)' }}
          />
          <p style={{ fontWeight: 700, margin: '0 0 var(--space-1) 0' }}>
            Misión no encontrada
          </p>
          <p
            style={{
              fontSize: '0.875rem',
              color: 'var(--color-text-muted)',
              margin: '0 0 var(--space-3) 0',
            }}
          >
            La misión solicitada no existe o no se encuentra disponible en caché local.
          </p>
          <div>
            <Link href="/cuadrilla/misiones" className={styles.backLink}>
              Volver a la bandeja
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const estadoNormalizado = mision.estado?.toUpperCase() || '';
  const tienePermisoEjecutar =
    typeof tienePermiso === 'function'
      ? tienePermiso('misiones:terreno:ejecutar')
      : false;
  const tienePermisoEvidencia =
    typeof tienePermiso === 'function' ? tienePermiso('reportes:crear') : false;

  const esRechazable = Boolean(
    unidadActiva &&
      esCuadrilla &&
      tienePermisoEjecutar &&
      estadoNormalizado === 'DESPACHADA'
  );

  const esMisionActiva =
    estadoNormalizado === 'EN_CURSO' ||
    estadoNormalizado === 'EN_TERRENO' ||
    estadoNormalizado === 'ACEPTADA';

  const esFinalizada =
    estadoNormalizado === 'FINALIZADA' ||
    estadoNormalizado === 'COMPLETADA' ||
    estadoNormalizado === 'CERRADA';

  const puedeAdjuntarEvidencia = Boolean(
    unidadActiva &&
      esCuadrilla &&
      tienePermisoEvidencia &&
      esMisionActiva
  );

  const puedeEjecutarCierre = Boolean(
    unidadActiva &&
      esCuadrilla &&
      tienePermisoEjecutar &&
      esMisionActiva
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

  const fechaCierreTexto =
    typeof mision.datosAdicionales?.fechaCierre === 'string'
      ? mision.datosAdicionales.fechaCierre
      : null;

  const esSoloLectura =
    !unidadActiva ||
    esFinalizada ||
    estadoNormalizado === 'RECHAZADA';

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
    setMensajeConfirmacion(res.mensaje);
    setModalRechazoAbierto(false);
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

  const handleCierreEnviado = async (resultado: ResultadoCierreCuadrilla) => {
    if (resultado.mision) {
      setMision(resultado.mision);
    }
    setMensajeConfirmacion(resultado.mensaje);
    if (resultado.offline) {
      toast?.showWarning(resultado.mensaje);
    } else {
      toast?.showSuccess(resultado.mensaje);
    }
    await actualizarPendientes();
    router.push('/cuadrilla/misiones');
  };

  const irASeccionEvidencia = () => {
    if (typeof document === 'undefined') return;
    const el = document.getElementById('seccion-evidencia-cuadrilla');
    if (el) {
      el.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <Link href="/cuadrilla/misiones" className={styles.backLink}>
          <ArrowLeft size={16} aria-hidden="true" />
          <span>{estadoAsignacion === 'DESACTIVADA' ? 'Historial' : 'Faenas'}</span>
        </Link>
        <ConnectionStatusBadge
          status={status}
          pendingCount={pendientes}
          onRetry={sincronizar}
        />
      </div>

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

      {mision.sincronizacionPendiente && (
        <div className={styles.offlineAlertBanner} role="status">
          <WifiOff size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span>
            Acción registrada localmente. Pendiente de sincronizar con el Centro de Mando.
          </span>
        </div>
      )}

      {mensajeConfirmacion && !mision.sincronizacionPendiente && (
        <div className={styles.successAlertBanner} role="status">
          <CheckCircle2 size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span>{mensajeConfirmacion}</span>
        </div>
      )}

      <div className={styles.missionHeader}>
        <div className={styles.headerRow}>
          <div className={styles.codeArea}>
            <span className={styles.code}>{mision.codigoIncidente}</span>
            <Chip variant={obtenerVarianteChipPrioridad(mision.prioridad)} size="md">
              {formatearPrioridad(mision.prioridad)}
            </Chip>
          </div>
          <EstadoBadge estado={mision.estado} size="md" />
        </div>

        <div className={styles.detailGrid}>
          {/* Bloque Tipo */}
          <div className={styles.sectionBlock}>
            <span className={styles.itemLabel}>Tipo</span>
            <span className={`${styles.itemValue} ${styles.itemValueBold}`}>
              {formatearTipologia(mision.tipologia)}
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

          {esFinalizada && fechaCierreTexto && (
            <div className={styles.sectionBlock}>
              <span className={styles.itemLabel}>Finalizada</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2
                  size={15}
                  color="var(--color-success, #2E7D32)"
                  aria-hidden="true"
                />
                <span className={styles.itemValue}>
                  {formatearFechaHora24h(fechaCierreTexto)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Acciones de Despacho (H41) */}
      {esRechazable && (
        <section
          className={styles.dispatchCard}
          aria-label="Acciones de despacho de cuadrilla"
        >
          <h2 className={styles.dispatchTitle}>Acciones de Despacho</h2>
          <p className={styles.dispatchDesc}>
            Si la cuadrilla presenta un impedimento técnico o de fuerza mayor para
            atender la asignación, registre el rechazo motivado para reasignación
            inmediata.
          </p>
          <div className={styles.actionsStack}>
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
        </section>
      )}

      {estadoNormalizado === 'RECHAZADA' && justificacionRegistrada && (
        <div className={styles.rejectedInfoBox}>
          <span className={styles.rejectedInfoLabel}>Justificación de rechazo registrada</span>
          <span>{justificacionRegistrada}</span>
        </div>
      )}

      {/* Evidencia Multimedia (H43) */}
      {(puedeAdjuntarEvidencia || adjuntosMision.length > 0) && (
        <div id="seccion-evidencia-cuadrilla">
          <CargaEvidenciaCard
            misionId={mision.id}
            incidenteId={mision.incidenteId}
            reporteTerrenoId={reporteTerrenoIdMision}
            adjuntos={adjuntosMision}
            soloLectura={!puedeAdjuntarEvidencia}
            alAdjuntarEvidencia={handleEvidenciaCargada}
          />
        </div>
      )}

      {/* Gestión Técnica de Faena y Cierre de Misión (H68) */}
      {mostrarSeccionCierre && (
        <section
          className={styles.evaluationFormsSection}
          aria-label="Gestión técnica y cierre de misión de cuadrilla"
        >
          <div className={styles.evaluationHeader}>
            <h2 className={styles.evaluationTitle}>
              <Wrench size={18} aria-hidden="true" />
              <span>Gestión Técnica de Faena</span>
            </h2>
          </div>

          <div className={styles.evaluationContent}>
            <SeccionDesplegable
              titulo="Finalizar Misión e Informe Técnico"
              icono={<FileCheck size={18} aria-hidden="true" />}
              abierto={seccionCierreAbierta}
              onToggle={setSeccionCierreAbierta}
              indicador={
                reporteCierreEnviado ? (
                  <span className={styles.badgeCompletado}>
                    <CheckCircle2 size={12} aria-hidden="true" />
                    <span>Enviado</span>
                  </span>
                ) : undefined
              }
            >
              <CierreMisionCuadrillaCard
                misionActual={mision}
                adjuntosMision={adjuntosMision}
                usuarioActualId={usuario?.id}
                deshabilitado={!puedeEjecutarCierre}
                onCierreEnviado={handleCierreEnviado}
                onIrAEvidencia={
                  puedeAdjuntarEvidencia || adjuntosMision.length > 0
                    ? irASeccionEvidencia
                    : undefined
                }
              />
            </SeccionDesplegable>
          </div>
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
