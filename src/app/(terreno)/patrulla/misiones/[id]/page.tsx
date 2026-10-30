'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, MapPin, Calendar, Archive } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { obtenerDetalleMision } from '@/services/misionesService';
import { UnidadInactivaBanner } from '@/components/common/UnidadInactivaBanner';
import { formatearEstado, formatearPrioridad } from '@/lib/utils/formatters';
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
        <span>Volver al Historial</span>
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
            <span className={styles.itemLabel}>Tipología Evaluada</span>
            <span className={styles.itemValue}>{mision.tipologia}</span>
          </div>

          <div className={styles.detailItem}>
            <span className={styles.itemLabel}>Dirección de la Emergencia</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={16} color="var(--color-primary-teal)" aria-hidden="true" />
              <span className={styles.itemValue}>{mision.direccion}</span>
            </div>
          </div>

          <div className={styles.detailItem}>
            <span className={styles.itemLabel}>Prioridad Asignada en Terreno</span>
            <span className={styles.itemValue}>{formatearPrioridad(mision.prioridad)}</span>
          </div>

          <div className={styles.detailItem}>
            <span className={styles.itemLabel}>Fecha y Hora de Evaluación</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={16} aria-hidden="true" />
              <span className={styles.itemValue}>
                {new Date(mision.fechaDespacho).toLocaleString('es-CL')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.readOnlyNotice}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <Archive size={18} aria-hidden="true" />
          <span>Registro Histórico de Triage — Modo Solo Lectura</span>
        </div>
        <p style={{ fontSize: '0.8125rem', marginTop: 'var(--space-2)', marginBottom: 0 }}>
          {!unidadActiva
            ? 'Esta patrulla verificadora se encuentra inactiva. No se admiten reclasificaciones ni nuevos informes.'
            : 'Misión concluida en los registros municipales.'}
        </p>
      </div>
    </div>
  );
}
