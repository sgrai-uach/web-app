'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  MapPin,
  MapPinCheck,
  Map,
  Calendar,
  Clock,
  CheckCircle,
  CheckCircle2,
  WifiOff,
  Archive,
  XCircle,
  History,
  Send,
  FileCheck,
  AlertTriangle,
  UserCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EstadoBadge } from '@/components/misiones/EstadoBadge';
import {
  ConnectionStatusBadge,
  type ConnectionStatus,
} from '@/components/common/ConnectionStatusBadge';
import {
  formatearPrioridad,
  formatearFechaHora24h,
  formatearTipologia,
} from '@/lib/utils/formatters';
import type { MisionBitacoraHitoLocal, MisionLocal } from '@/types/offline';
import styles from './MisionDetailLayout.module.css';

export interface MisionDetalleTopBarProps {
  backHref: string;
  backLabel: string;
  status: ConnectionStatus;
  pendingCount: number;
  onRetry: () => void;
}

/**
 * Barra superior estandarizada compartida entre las vistas de detalle de
 * Patrulla Verificadora y Delegado de Cuadrilla.
 */
export function MisionDetalleTopBar({
  backHref,
  backLabel,
  status,
  pendingCount,
  onRetry,
}: MisionDetalleTopBarProps) {
  return (
    <div className={styles.topBar}>
      <Link href={backHref} className={styles.backLink}>
        <ArrowLeft size={16} aria-hidden="true" />
        <span>{backLabel}</span>
      </Link>
      <ConnectionStatusBadge
        status={status}
        pendingCount={pendingCount}
        onRetry={onRetry}
      />
    </div>
  );
}

export interface MisionDetalleHeaderCardProps {
  mision: MisionLocal;
  trabajoTexto: string;
  etiquetaFecha: string;
  fechaPrincipal?: string | null;
  fechaCierre?: string | null;
  onVerMapa: () => void;
}

/**
 * Ficha principal de identificación de misión con borde lateral teal institucional,
 * tipología formateada, ubicación con acceso al mapa, trabajo y fechas operativas.
 */
export function MisionDetalleHeaderCard({
  mision,
  trabajoTexto,
  etiquetaFecha,
  fechaPrincipal,
  fechaCierre,
  onVerMapa,
}: MisionDetalleHeaderCardProps) {
  const normPrioridad = mision.prioridad?.toUpperCase() || '';
  let prioridadClase = styles.priorityNeutro;
  if (normPrioridad === 'CRITICA') {
    prioridadClase = styles.priorityCritica;
  } else if (normPrioridad === 'ALTA') {
    prioridadClase = styles.priorityAlta;
  }

  return (
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
        <div className={styles.sectionBlock}>
          <span className={styles.itemLabel}>Tipo</span>
          <span className={`${styles.itemValue} ${styles.itemValueBold}`}>
            {formatearTipologia(mision.tipologia)}
          </span>
        </div>

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
              onClick={onVerMapa}
            >
              Ver mapa
            </Button>
          </div>
        </div>

        <div className={styles.sectionBlock}>
          <span className={styles.itemLabel}>Trabajo</span>
          <span className={styles.itemValue}>{trabajoTexto}</span>
        </div>

        <div className={styles.sectionBlock}>
          <span className={styles.itemLabel}>{etiquetaFecha}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar
              size={15}
              color="var(--color-text-muted)"
              aria-hidden="true"
            />
            <span className={styles.itemValue}>
              {formatearFechaHora24h(fechaPrincipal)}
            </span>
          </div>
        </div>

        {fechaCierre && (
          <div className={styles.sectionBlock}>
            <span className={styles.itemLabel}>Finalizada</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2
                size={15}
                color="var(--color-success, #2E7D32)"
                aria-hidden="true"
              />
              <span className={styles.itemValue}>
                {formatearFechaHora24h(fechaCierre)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export interface EstadoCanonicoItem {
  etiqueta: string;
  valor: string;
}

export interface MisionEstadoActivoCardProps {
  ariaLabel: string;
  icono: React.ReactNode;
  titulo: string;
  sincronizacionPendiente?: boolean;
  mensajeOffline: string;
  mensajeConfirmacion?: string | null;
  estadosCanonicos: EstadoCanonicoItem[];
}

/**
 * Tarjeta estandarizada de estado operativo activo en terreno (Patrulla y Cuadrilla)
 * con indicador de misión activa, banner de sincronización offline/confirmada y grilla de 3 estados canónicos.
 */
export function MisionEstadoActivoCard({
  ariaLabel,
  icono,
  titulo,
  sincronizacionPendiente = false,
  mensajeOffline,
  mensajeConfirmacion,
  estadosCanonicos,
}: MisionEstadoActivoCardProps) {
  return (
    <section className={styles.enTrayectoCard} aria-label={ariaLabel}>
      <div className={styles.enTrayectoHeader}>
        <div className={styles.enTrayectoTitleRow}>
          {icono}
          <h2 className={styles.enTrayectoTitle}>{titulo}</h2>
        </div>
        <span className={styles.activeStatusChip}>Misión activa</span>
      </div>

      <div className={styles.enTrayectoContent}>
        {sincronizacionPendiente ? (
          <div className={styles.offlineQueueBanner} role="status">
            <WifiOff size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
            <span>{mensajeOffline}</span>
          </div>
        ) : (
          mensajeConfirmacion && (
            <div className={styles.SyncedBanner} role="status">
              {mensajeConfirmacion}
            </div>
          )
        )}

        <div className={styles.canonicalStatesGrid}>
          {estadosCanonicos.map((estadoItem) => (
            <div key={estadoItem.etiqueta} className={styles.canonicalStateItem}>
              <span className={styles.canonicalStateLabel}>
                {estadoItem.etiqueta}
              </span>
              <span className={styles.canonicalStateValue}>
                {estadoItem.valor}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export interface MisionNoEncontradaCardProps {
  backHref: string;
  backLabel: string;
  status: ConnectionStatus;
  pendingCount: number;
  onRetry: () => void;
  descripcion: string;
}

/**
 * Pantalla estandarizada de estado vacío cuando no existe la misión solicitada en red ni caché local.
 */
export function MisionNoEncontradaCard({
  backHref,
  backLabel,
  status,
  pendingCount,
  onRetry,
  descripcion,
}: MisionNoEncontradaCardProps) {
  return (
    <div className={styles.container}>
      <MisionDetalleTopBar
        backHref={backHref}
        backLabel={backLabel}
        status={status}
        pendingCount={pendingCount}
        onRetry={onRetry}
      />
      <div className={styles.notFoundCard} role="alert">
        <p className={styles.notFoundTitle}>Misión no encontrada</p>
        <p className={styles.notFoundDescription}>{descripcion}</p>
        <Link href={backHref} className={styles.notFoundBackLink}>
          Volver a la bandeja
        </Link>
      </div>
    </div>
  );
}

export interface MisionDespachoActionsCardProps {
  ariaLabel: string;
  titulo: string;
  descripcion: string;
  mostrarAceptar?: boolean;
  etiquetaAceptar?: string;
  aceptando?: boolean;
  errorAceptacion?: string | null;
  onAceptar?: () => void;
  mostrarRechazar?: boolean;
  etiquetaRechazar?: string;
  rechazando?: boolean;
  onRechazar?: () => void;
}

/**
 * Tarjeta compartida de acciones operativas para misiones en estado DESPACHADA
 * (aceptación y/o rechazo motivado) homologada entre Patrulla Verificadora y Cuadrilla.
 */
export function MisionDespachoActionsCard({
  ariaLabel,
  titulo,
  descripcion,
  mostrarAceptar = false,
  etiquetaAceptar = 'Aceptar Misión',
  aceptando = false,
  errorAceptacion,
  onAceptar,
  mostrarRechazar = false,
  etiquetaRechazar = 'Rechazar Misión',
  rechazando = false,
  onRechazar,
}: MisionDespachoActionsCardProps) {
  const tieneAceptar = Boolean(mostrarAceptar && onAceptar);
  const tieneRechazar = Boolean(mostrarRechazar && onRechazar);

  if (!tieneAceptar && !tieneRechazar) {
    return null;
  }

  return (
    <section className={styles.actionCard} aria-label={ariaLabel}>
      <h2 className={styles.actionTitle}>{titulo}</h2>
      <p className={styles.actionDescription}>{descripcion}</p>

      {errorAceptacion && (
        <div className={styles.errorAlert} role="alert">
          {errorAceptacion}
        </div>
      )}

      <div className={styles.actionsStack}>
        {tieneAceptar && onAceptar && (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={aceptando}
            disabled={aceptando || rechazando}
            icon={<CheckCircle size={20} />}
            onClick={onAceptar}
            className={styles.actionPrimaryButton}
          >
            {etiquetaAceptar}
          </Button>
        )}

        {tieneRechazar && onRechazar && (
          <Button
            variant="destructive"
            size="md"
            fullWidth
            disabled={aceptando || rechazando}
            icon={<XCircle size={18} />}
            onClick={onRechazar}
          >
            {etiquetaRechazar}
          </Button>
        )}
      </div>
    </section>
  );
}

/**
 * Pie informativo estandarizado cuando la misión o la unidad están en modo solo lectura.
 */
export function MisionSoloLecturaNotice() {
  return (
    <div className={styles.readOnlyNotice}>
      <div className={styles.readOnlyNoticeInner}>
        <Archive size={16} aria-hidden="true" />
        <span>Solo lectura</span>
      </div>
    </div>
  );
}

export interface MisionRechazoBannerProps {
  titulo: string;
  justificacion?: string | null;
}

/**
 * Banner estandarizado de rechazo motivado compartido entre Patrulla Verificadora y Cuadrilla.
 */
export function MisionRechazoBanner({
  titulo,
  justificacion,
}: MisionRechazoBannerProps) {
  return (
    <div className={styles.rejectedBanner} role="status">
      <div className={styles.rejectedHeader}>
        <XCircle size={18} aria-hidden="true" />
        <span>{titulo}</span>
      </div>
      {justificacion && (
        <p className={styles.rejectedReason}>
          <strong>Motivo documentado:</strong> {justificacion}
        </p>
      )}
    </div>
  );
}

export type TipoUnidadMision = 'PATRULLA' | 'CUADRILLA';

interface ConfigHitoTerreno {
  titulo: string;
  categoria: 'despacho' | 'aceptacion' | 'llegada' | 'evaluacion' | 'cierre' | 'rechazo' | 'neutro';
  destacar: boolean;
  mostrarResponsableFallback: boolean;
}

function resolverConfigHitoTerreno(
  hito: MisionBitacoraHitoLocal,
  tipoUnidad: TipoUnidadMision
): ConfigHitoTerreno {
  const codigo = (hito.codigoHito || hito.hito || '').trim().toUpperCase();

  if (codigo === 'DESPACHADA' || codigo === 'MISION_DESPACHADA') {
    return {
      titulo:
        tipoUnidad === 'PATRULLA'
          ? 'Patrulla Verificadora Despachada'
          : 'Cuadrilla Despachada',
      categoria: 'despacho',
      destacar: false,
      mostrarResponsableFallback: false,
    };
  }
  if (codigo === 'PATRULLA_DESPACHADA') {
    return {
      titulo: 'Patrulla Verificadora Despachada',
      categoria: 'despacho',
      destacar: false,
      mostrarResponsableFallback: false,
    };
  }
  if (codigo === 'CUADRILLA_DESPACHADA') {
    return {
      titulo: 'Cuadrilla Despachada',
      categoria: 'despacho',
      destacar: false,
      mostrarResponsableFallback: false,
    };
  }
  if (codigo === 'MISION_ACEPTADA' || codigo === 'ACEPTACION_MISION') {
    return {
      titulo: 'Misión Aceptada por Unidad',
      categoria: 'aceptacion',
      destacar: false,
      mostrarResponsableFallback: true,
    };
  }
  if (codigo === 'LLEGADA_TERRENO') {
    return {
      titulo: 'Llegada a Terreno',
      categoria: 'llegada',
      destacar: true,
      mostrarResponsableFallback: true,
    };
  }
  if (codigo === 'TIPOLOGIA_RECLASIFICADA') {
    const desc = (hito.descripcion || '').toLowerCase();
    const sinCambios = desc.includes('sin modificaciones') || desc.includes('sin variaciones');
    return {
      titulo: sinCambios
        ? 'Tipología constatada en terreno (sin cambios)'
        : 'Tipología reclasificada en terreno',
      categoria: 'evaluacion',
      destacar: false,
      mostrarResponsableFallback: true,
    };
  }
  if (codigo === 'PRIORIDAD_ASIGNADA') {
    return {
      titulo: 'Prioridad evaluada y asignada en terreno',
      categoria: 'evaluacion',
      destacar: false,
      mostrarResponsableFallback: true,
    };
  }
  if (codigo === 'VERIFICACION_COMPLETADA' || codigo === 'VERIFICACION_FINALIZADA') {
    return {
      titulo: 'Verificación completada',
      categoria: 'cierre',
      destacar: true,
      mostrarResponsableFallback: true,
    };
  }
  if (codigo === 'MISION_RECHAZADA' || codigo === 'RECHAZO_MISION' || codigo === 'RECHAZADA') {
    return {
      titulo: 'Misión Rechazada en Terreno',
      categoria: 'rechazo',
      destacar: false,
      mostrarResponsableFallback: true,
    };
  }
  if (codigo === 'REPORTE_TERRENO') {
    return {
      titulo: 'Reporte Técnico Emitido',
      categoria: 'evaluacion',
      destacar: false,
      mostrarResponsableFallback: true,
    };
  }

  return {
    titulo: hito.hito || 'Evento Operativo',
    categoria: 'neutro',
    destacar: false,
    mostrarResponsableFallback: false,
  };
}

export interface MisionBitacoraTimelineProps {
  bitacora?: MisionBitacoraHitoLocal[];
  tipoUnidad: TipoUnidadMision;
  responsableFallback?: string | null;
  abiertoPorDefecto?: boolean;
}

/**
 * Bitácora cronológica de operaciones (línea de tiempo) estandarizada y compartida
 * entre Patrulla Verificadora y Cuadrilla en la app de terreno.
 */
export function MisionBitacoraTimeline({
  bitacora = [],
  tipoUnidad,
  responsableFallback,
  abiertoPorDefecto = true,
}: MisionBitacoraTimelineProps) {
  const [abierto, setAbierto] = useState(abiertoPorDefecto);

  return (
    <section
      className={styles.bitacoraCard}
      aria-label="Bitácora cronológica de operaciones"
    >
      <div className={styles.bitacoraHeader}>
        <div className={styles.bitacoraTitleRow}>
          <History
            size={18}
            color="var(--color-primary-teal)"
            aria-hidden="true"
          />
          <h2 className={styles.bitacoraTitle}>
            Bitácora Cronológica ({bitacora.length})
          </h2>
        </div>

        <button
          type="button"
          className={styles.bitacoraToggleBtn}
          onClick={() => setAbierto((prev) => !prev)}
          aria-expanded={abierto}
        >
          <span>{abierto ? 'Ocultar' : 'Ver historial'}</span>
          {abierto ? (
            <ChevronUp size={14} aria-hidden="true" />
          ) : (
            <ChevronDown size={14} aria-hidden="true" />
          )}
        </button>
      </div>

      {abierto && (
        <div className={styles.bitacoraBody}>
          {bitacora.length === 0 ? (
            <p className={styles.bitacoraEmpty}>
              No se registran eventos en la bitácora de esta misión aún.
            </p>
          ) : (
            <div className={styles.timelineList}>
              {bitacora.map((hito, index) => {
                const cfg = resolverConfigHitoTerreno(hito, tipoUnidad);
                const responsable =
                  hito.registradoPorNombre ||
                  (cfg.mostrarResponsableFallback ? responsableFallback : null);
                const fechaTexto = hito.timestamp
                  ? formatearFechaHora24h(hito.timestamp)
                  : `${hito.fecha} ${hito.hora}`.trim();
                const tieneCoordenadas =
                  typeof hito.latitud === 'number' &&
                  typeof hito.longitud === 'number' &&
                  Number.isFinite(hito.latitud) &&
                  Number.isFinite(hito.longitud);

                return (
                  <div
                    key={`${hito.id || hito.timestamp || hito.hito}-${index}`}
                    className={`${styles.timelineItem} ${
                      cfg.destacar ? styles.timelineItemHighlight : ''
                    }`}
                  >
                    {cfg.categoria === 'llegada' ? (
                      <div className={styles.timelineDotIcon} aria-hidden="true">
                        <MapPinCheck size={12} />
                      </div>
                    ) : cfg.categoria === 'aceptacion' ? (
                      <div className={styles.timelineDotIcon} aria-hidden="true">
                        <CheckCircle2 size={12} />
                      </div>
                    ) : cfg.categoria === 'rechazo' ? (
                      <div
                        className={`${styles.timelineDotIcon} ${styles.timelineDotRechazo}`}
                        aria-hidden="true"
                      >
                        <AlertTriangle size={12} />
                      </div>
                    ) : cfg.categoria === 'evaluacion' || cfg.categoria === 'cierre' ? (
                      <div className={styles.timelineDotIcon} aria-hidden="true">
                        <FileCheck size={12} />
                      </div>
                    ) : cfg.categoria === 'despacho' ? (
                      <div className={styles.timelineDotIcon} aria-hidden="true">
                        <Send size={11} />
                      </div>
                    ) : (
                      <div className={styles.timelineDot} />
                    )}

                    <div className={styles.timelineHeader}>
                      <span className={styles.timelineHito}>{cfg.titulo}</span>
                      <span className={styles.timelineDate}>
                        <Clock size={12} aria-hidden="true" />
                        <span>{fechaTexto}</span>
                      </span>
                    </div>

                    {hito.descripcion && (
                      <p className={styles.timelineDesc}>{hito.descripcion}</p>
                    )}

                    {(responsable || tieneCoordenadas) && (
                      <div className={styles.timelineMetaRow}>
                        {responsable && (
                          <span className={styles.timelineMetaItem}>
                            <UserCheck size={12} aria-hidden="true" />
                            <span>Reportado por: {responsable}</span>
                          </span>
                        )}
                        {tieneCoordenadas && (
                          <span className={styles.timelineMetaItem}>
                            <MapPin size={12} aria-hidden="true" />
                            <span className={styles.timelineCoords}>
                              {hito.latitud!.toFixed(5)}, {hito.longitud!.toFixed(5)}
                            </span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
