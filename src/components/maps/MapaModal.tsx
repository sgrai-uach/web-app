'use client';

import React, { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { X, MapPin } from 'lucide-react';
import styles from './MapaModal.module.css';

// Carga dinámica de Leaflet exclusivamente en el cliente sin SSR
const MapaLeafletView = dynamic(() => import('./MapaLeafletView'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--color-text-muted)',
      }}
    >
      Cargando visor cartográfico...
    </div>
  ),
});

interface MapaModalProps {
  abierto: boolean;
  alCerrar: () => void;
  latitud?: number | null;
  longitud?: number | null;
  titulo?: string;
  direccion?: string;
}

export function MapaModal({
  abierto,
  alCerrar,
  latitud,
  longitud,
  titulo = 'Ubicación de la emergencia',
  direccion,
}: MapaModalProps) {
  useEffect(() => {
    if (!abierto) return;

    function manejarEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        alCerrar();
      }
    }

    document.addEventListener('keydown', manejarEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', manejarEscape);
      document.body.style.overflow = '';
    };
  }, [abierto, alCerrar]);

  if (!abierto) return null;

  // Coordenadas fijas de fallback (Plaza de la República de Valdivia)
  const latValdivia = -39.8142;
  const lngValdivia = -73.2459;
  const lat = typeof latitud === 'number' && !isNaN(latitud) ? latitud : latValdivia;
  const lng = typeof longitud === 'number' && !isNaN(longitud) ? longitud : lngValdivia;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mapa-modal-titulo"
    >
      <div className={styles.modalContent}>
        {/* Cabecera plana de alto contraste */}
        <div className={styles.headerBar}>
          <div className={styles.titleArea}>
            <MapPin size={20} color="var(--color-accent-mint)" aria-hidden="true" />
            <span id="mapa-modal-titulo" className={styles.titleText}>
              {titulo}
            </span>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={alCerrar}
            aria-label="Cerrar visor de mapa"
            title="Cerrar visor"
          >
            <X size={24} aria-hidden="true" />
          </button>
        </div>

        {/* Visor Leaflet / OpenStreetMap */}
        <div className={styles.mapContainer}>
          <MapaLeafletView latitud={lat} longitud={lng} titulo={titulo} />
        </div>

        {/* Barra inferior con dirección y coordenadas de respaldo */}
        <div className={styles.footerBar}>
          {direccion && (
            <div className={styles.locationAddress}>
              <MapPin size={16} color="var(--color-primary-teal)" aria-hidden="true" />
              <span>{direccion}</span>
            </div>
          )}
          <div className={styles.coordinatesNotice}>
            Coordenadas GPS: {lat.toFixed(6)}, {lng.toFixed(6)} · Valdivia
          </div>
        </div>
      </div>
    </div>
  );
}

export default MapaModal;
