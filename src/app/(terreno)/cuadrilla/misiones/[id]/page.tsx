'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  XCircle,
  CheckCircle2,
  WifiOff,
  FileCheck,
  ClipboardCheck,
  HardHat,
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
  MisionEstadoActivoCard,
  MisionNoEncontradaCard,
  MisionSoloLecturaNotice,
} from '@/components/misiones/MisionDetalleShared';
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
import type { AdjuntoLocal, MisionLocal } from '@/types/offline';
import styles from '@/components/misiones/MisionDetailLayout.module.css';

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
      <MisionNoEncontradaCard
        backHref="/cuadrilla/misiones"
        backLabel={estadoAsignacion === 'DESACTIVADA' ? 'Historial' : 'Faenas'}
        status={status}
        pendingCount={pendientes}
        onRetry={sincronizar}
        descripcion="La misión solicitada no existe o no se encuentra disponible en caché local."
      />
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
    if (toast) {
      if (res.modoOffline) {
        toast.showWarning(res.mensaje, 'Guardado sin conexión');
      } else {
        toast.showSuccess(res.mensaje, 'Misión rechazada');
      }
    }
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
        etiquetaFecha="Despachada"
        fechaPrincipal={mision.fechaDespacho}
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

      {/* Acciones de Despacho (H41) */}
      {esRechazable && (
        <section
          className={styles.actionCard}
          aria-label="Acciones de despacho de cuadrilla"
        >
          <h2 className={styles.actionTitle}>Acciones de Despacho</h2>
          <p className={styles.actionDescription}>
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
          <span className={styles.rejectedInfoLabel}>
            Justificación de rechazo registrada
          </span>
          <span>{justificacionRegistrada}</span>
        </div>
      )}

      {/* Vista activa: Faena en Curso */}
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
          mensajeOffline="Acción registrada localmente. Pendiente de sincronizar con el Centro de Mando."
          mensajeConfirmacion={mensajeConfirmacion}
          estadosCanonicos={[
            { etiqueta: 'Misión', valor: 'En curso' },
            { etiqueta: 'Cuadrilla', valor: 'En misión' },
            { etiqueta: 'Incidente', valor: 'En atención' },
          ]}
        />
      )}

      {/* Gestión Técnica de Faena y Cierre de Misión (H68) */}
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
