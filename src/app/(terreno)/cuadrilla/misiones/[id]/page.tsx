'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, MapPin, Calendar, Archive, Map } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EstadoBadge } from '@/components/misiones/EstadoBadge';
import { obtenerVarianteChipPrioridad } from '@/lib/utils/chipVariants';
import { obtenerDetalleMision } from '@/services/misionesService';
import { UnidadInactivaBanner } from '@/components/common/UnidadInactivaBanner';
import { SinUnidadBanner } from '@/components/common/SinUnidadBanner';
import { MapaModal } from '@/components/maps/MapaModal';
import { formatearPrioridad, formatearFechaHora24h } from '@/lib/utils/formatters';
import type { MisionLocal } from '@/types/offline';
import styles from './CuadrillaDetailPage.module.css';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function CuadrillaMisionDetailPage({ params }: PageProps) {
  const { id: misionId } = use(params);
  const { usuario, unidadActiva, tieneUnidadAsignada } = useAuth();

  const [mision, setMision] = useState<MisionLocal | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);
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
          tipologia: 'Caída de árbol',
          direccion: 'Av. Ramón Picarte 1100, Valdivia',
          coordenadas: { lat: -39.82, lng: -73.23 },
          prioridad: 'ALTA',
          estado: 'FINALIZADA',
          fechaDespacho: '2026-10-20T14:30:00Z',
          actualizadoEn: '2026-10-20T17:45:00Z',
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

  const trabajoTexto = (mision.datosAdicionales?.trabajo as string) || mision.direccion;
  const esSoloLectura =
    !unidadActiva ||
    mision.estado === 'FINALIZADA' ||
    mision.estado === 'COMPLETADA' ||
    mision.estado === 'CERRADA';

  return (
    <div className={styles.container}>
      <Link href="/cuadrilla/misiones" className={styles.backLink}>
        <ArrowLeft size={16} aria-hidden="true" />
        <span>Historial</span>
      </Link>

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
