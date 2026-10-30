'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { MapPin, AlertCircle, RefreshCw, Archive } from 'lucide-react';
import { Heading } from '@/components/ui/Heading';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { sincronizarMisiones } from '@/services/misionesService';
import { guardarMisionesLocales } from '@/services/offlineQueue';
import { UnidadInactivaBanner } from '@/components/common/UnidadInactivaBanner';
import { formatearEstado, formatearPrioridad } from '@/lib/utils/formatters';
import type { MisionLocal } from '@/types/offline';
import styles from './CuadrillaMisionesPage.module.css';

export default function CuadrillaMisionesPage() {
  const { usuario, unidadActiva } = useAuth();
  const [misiones, setMisiones] = useState<MisionLocal[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);

  const cargarMisiones = useCallback(async () => {
    setCargando(true);
    try {
      let locales = await sincronizarMisiones({
        tipoMision: 'ATENCION_CUADRILLA',
      });

      // Si la cuadrilla está desactivada y no hay locales, inicializar con registro histórico demostrativo
      if (!unidadActiva && locales.length === 0) {
        const historicas: MisionLocal[] = [
          {
            id: 'mision-hist-01',
            incidenteId: 'inc-089',
            codigoIncidente: 'INC-2026-00089',
            tipologia: 'CAIDA_ARBOL',
            direccion: 'Av. Ramón Picarte 1100, Valdivia',
            prioridad: 'ALTA',
            estado: 'FINALIZADA',
            fechaDespacho: '2026-10-20T14:30:00Z',
            actualizadoEn: '2026-10-20T17:45:00Z',
          },
          {
            id: 'mision-hist-02',
            incidenteId: 'inc-042',
            codigoIncidente: 'INC-2026-00042',
            tipologia: 'INUNDACION_VIAL',
            direccion: 'Calle General Lagos 750, Valdivia',
            prioridad: 'MEDIA',
            estado: 'FINALIZADA',
            fechaDespacho: '2026-10-15T09:00:00Z',
            actualizadoEn: '2026-10-15T12:30:00Z',
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
      {/* Banner de advertencia si la cuadrilla está desactivada (H82) */}
      {!unidadActiva && (
        <UnidadInactivaBanner
          tipoUnidad="cuadrilla"
          nombreUnidad={usuario?.unidadNombre}
        />
      )}

      <div className={styles.titleArea}>
        <Heading variant="h1">
          {!unidadActiva
            ? 'Historial de Faenas Operativas'
            : 'Misiones de Cuadrilla'}
        </Heading>
        {!unidadActiva && (
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>
            Modo histórico de solo lectura. Consulte los registros previos de faenas de esta unidad.
          </p>
        )}
      </div>

      {cargando ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
          <p>Cargando registros...</p>
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
                ? 'No se encontraron faenas históricas registradas para esta cuadrilla.'
                : 'La cuadrilla se encuentra disponible para despacho.'}
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
              href={`/cuadrilla/misiones/${mision.id}`}
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
                <span>Prioridad: <strong>{formatearPrioridad(mision.prioridad)}</strong></span>
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
