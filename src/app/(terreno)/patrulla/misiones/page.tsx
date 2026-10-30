'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { MapPin, AlertCircle, RefreshCw, Archive } from 'lucide-react';
import { Heading } from '@/components/ui/Heading';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { obtenerMisionesLocales, guardarMisionesLocales } from '@/services/offlineQueue';
import { UnidadInactivaBanner } from '@/components/common/UnidadInactivaBanner';
import { formatearEstado, formatearPrioridad } from '@/lib/utils/formatters';
import type { MisionLocal } from '@/types/offline';
import styles from './PatrullaMisionesPage.module.css';

export default function PatrullaMisionesPage() {
  const { usuario, unidadActiva } = useAuth();
  const [misiones, setMisiones] = useState<MisionLocal[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);

  const cargarMisiones = useCallback(async () => {
    setCargando(true);
    try {
      let locales = await obtenerMisionesLocales();

      // Si la patrulla está desactivada y no hay locales, inicializar con registro histórico demostrativo
      if (!unidadActiva && locales.length === 0) {
        const historicas: MisionLocal[] = [
          {
            id: 'patrulla-hist-01',
            incidenteId: 'inc-102',
            codigoIncidente: 'INC-2026-00102',
            tipologia: 'CAIDA_ARBOL',
            direccion: 'Av. Alemania 600, Valdivia',
            prioridad: 'ALTA',
            estado: 'FINALIZADA',
            fechaDespacho: '2026-10-18T11:00:00Z',
            actualizadoEn: '2026-10-18T11:45:00Z',
          },
          {
            id: 'patrulla-hist-02',
            incidenteId: 'inc-067',
            codigoIncidente: 'INC-2026-00067',
            tipologia: 'DESLIZAMIENTO',
            direccion: 'Camino a Niebla Km 4, Valdivia',
            prioridad: 'CRITICA',
            estado: 'FINALIZADA',
            fechaDespacho: '2026-10-14T16:20:00Z',
            actualizadoEn: '2026-10-14T17:10:00Z',
          },
        ];
        await guardarMisionesLocales(historicas);
        locales = historicas;
      }

      setMisiones(locales);
    } finally {
      setCargando(false);
    }
  }, [unidadActiva]);

  useEffect(() => {
    cargarMisiones();
  }, [cargarMisiones]);

  return (
    <div className={styles.container}>
      {/* Banner de advertencia si la patrulla está desactivada (H85) */}
      {!unidadActiva && (
        <UnidadInactivaBanner
          tipoUnidad="patrulla"
          nombreUnidad={usuario?.unidadNombre}
        />
      )}

      <div className={styles.titleArea}>
        <Heading variant="h1">
          {!unidadActiva
            ? 'Historial de Misiones de Triage'
            : 'Misiones de Patrulla'}
        </Heading>
        {!unidadActiva && (
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>
            Modo histórico de solo lectura. Consulte los registros de triage y evaluaciones previas.
          </p>
        )}
      </div>

      {cargando ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
          <p>Cargando registros de patrulla...</p>
        </div>
      ) : misiones.length === 0 ? (
        <div className={styles.emptyState}>
          <AlertCircle size={40} color="var(--color-text-muted)" aria-hidden="true" />
          <div>
            <p style={{ fontWeight: 700, margin: '0 0 var(--space-1) 0' }}>
              Sin registros disponibles
            </p>
            <p style={{ fontSize: '0.875rem', margin: 0 }}>
              {!unidadActiva
                ? 'No se encontraron misiones históricas para esta patrulla verificadora.'
                : 'La patrulla se encuentra disponible para despacho.'}
            </p>
          </div>
          <Button
            variant="secondary"
            icon={<RefreshCw size={18} />}
            onClick={cargarMisiones}
          >
            Actualizar
          </Button>
        </div>
      ) : (
        <div className={styles.missionList}>
          {misiones.map((mision) => (
            <Link
              key={mision.id}
              href={`/patrulla/misiones/${mision.id}`}
              className={styles.missionCard}
            >
              <div className={styles.cardHeader}>
                <span className={styles.code}>{mision.codigoIncidente}</span>
                <span
                  className={`${styles.badgeStatus} ${
                    !unidadActiva
                      ? styles.badgeStatusInactiva
                      : styles.badgeStatusFinalizada
                  }`}
                >
                  {formatearEstado(mision.estado)}
                </span>
              </div>

              <div className={styles.typology}>{mision.tipologia}</div>

              <div className={styles.addressRow}>
                <MapPin size={16} aria-hidden="true" />
                <span>{mision.direccion}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                <span>Prioridad Evaluada: <strong>{formatearPrioridad(mision.prioridad)}</strong></span>
                {!unidadActiva && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Archive size={14} aria-hidden="true" />
                    Solo lectura
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
