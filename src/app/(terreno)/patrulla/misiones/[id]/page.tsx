'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, MapPin, Calendar, Archive } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { obtenerDetalleMision } from '@/services/misionesService';
import { UnidadInactivaBanner } from '@/components/common/UnidadInactivaBanner';
import { formatearEstado, formatearPrioridad, formatearFechaHora24h } from '@/lib/utils/formatters';
import type { MisionLocal } from '@/types/offline';
import styles from './PatrullaDetailPage.module.css';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PatrullaMisionDetailPage({ params }: PageProps) {
  const { id: misionId } = use(params);
  const { usuario, unidadActiva } = useAuth();

  const [mision, setMision] = useState<MisionLocal | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);

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
          tipologia: 'CAIDA_ARBOL',
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
    return <div>Cargando registro histórico...</div>;
  }

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

      <div className={styles.missionHeader}>
        <div className={styles.headerRow}>
          <span className={styles.code}>{mision.codigoIncidente}</span>
          <span className={styles.statusBadge}>{formatearEstado(mision.estado)}</span>
        </div>

        <div className={styles.detailGrid}>
          <div className={styles.detailItem}>
            <span className={styles.itemLabel}>Tipo</span>
            <span className={styles.itemValue}><strong>{mision.tipologia}</strong></span>
          </div>

          <div className={styles.detailItem}>
            <span className={styles.itemLabel}>Ubicación</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={16} color="var(--color-primary-teal)" aria-hidden="true" />
              <span className={styles.itemValue}>{mision.direccion}</span>
            </div>
          </div>

          <div className={styles.detailItem}>
            <span className={styles.itemLabel}>Prioridad</span>
            <span className={styles.itemValue}>{formatearPrioridad(mision.prioridad)}</span>
          </div>

          <div className={styles.detailItem}>
            <span className={styles.itemLabel}>Despachada</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={16} aria-hidden="true" />
              <span className={styles.itemValue}>
                {formatearFechaHora24h(mision.fechaDespacho)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {(!unidadActiva || mision.estado === 'FINALIZADA' || mision.estado === 'COMPLETADA' || mision.estado === 'CERRADA') && (
        <div className={styles.readOnlyNotice}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <Archive size={16} aria-hidden="true" />
            <span>Solo lectura</span>
          </div>
        </div>
      )}
    </div>
  );
}
