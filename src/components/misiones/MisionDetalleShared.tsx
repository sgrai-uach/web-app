'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  AlertCircle,
  MapPin,
  Map,
  Calendar,
  CheckCircle,
  CheckCircle2,
  WifiOff,
  Archive,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EstadoBadge } from '@/components/misiones/EstadoBadge';
import {
  ConnectionStatusBadge,
  type ConnectionStatus,
} from '@/components/common/ConnectionStatusBadge';
import { obtenerVarianteChipPrioridad } from '@/lib/utils/chipVariants';
import {
  formatearPrioridad,
  formatearFechaHora24h,
  formatearTipologia,
} from '@/lib/utils/formatters';
import type { MisionLocal } from '@/types/offline';
import styles from './MisionDetailLayout.module.css';

export interface MisionDetalleTopBarProps {
  backHref: string;
  backLabel: string;
  status: ConnectionStatus;
  pendingCount: number;
  onRetry: () => void;
}

/**
 * Barra superior estandarizada (teal oscuro #14505A) compartida entre las vistas
 * de detalle de Patrulla Verificadora y Cuadrilla Operativa.
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
 * Ficha principal de identificación de misión con borde superior mint institucional,
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
  return (
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
        <Chip variant="success" size="sm">
          Misión activa
        </Chip>
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
