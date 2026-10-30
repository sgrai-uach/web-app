'use client';

import React, { useEffect, useState } from 'react';
import { MapPin, CheckCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { sincronizarMisiones } from '@/services/misionesService';
import { EstadoBadge } from '@/components/misiones/EstadoBadge';
import { Button } from '@/components/ui/Button';
import { formatearPrioridad, ordenarMisionesPorPrioridadYFecha } from '@/lib/utils/formatters';
import type { MisionLocal } from '@/types/offline';
import styles from './TerrenoSiguienteMision.module.css';

export function TerrenoSiguienteMision() {
  const { esCuadrilla, unidadActiva } = useAuth();
  const [siguienteMision, setSiguienteMision] = useState<MisionLocal | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);

  useEffect(() => {
    let cancelado = false;

    async function buscarSiguiente() {
      try {
        const misiones = await sincronizarMisiones({
          tipoMision: esCuadrilla ? 'ATENCION_CUADRILLA' : 'VERIFICACION',
        });
        if (cancelado) return;

        // 1. Prioridad: misión actualmente en curso o en ruta
        const enCurso = misiones.find((m) => {
          const e = m.estado?.toUpperCase();
          return e === 'EN_CURSO' || e === 'EN_TERRENO' || e === 'EN_RUTA';
        });

        if (enCurso) {
          setSiguienteMision(enCurso);
          return;
        }

        // 2. Misiones pendientes ordenadas por prioridad (Crítica > Alta...) y fecha más reciente
        const pendientes = misiones.filter((m) => {
          const e = m.estado?.toUpperCase();
          return e === 'ASIGNADA' || e === 'DESPACHADA' || e === 'PENDIENTE';
        });

        const ordenadas = ordenarMisionesPorPrioridadYFecha(pendientes);
        setSiguienteMision(ordenadas.length > 0 ? ordenadas[0] : null);
      } catch {
        // En caso de error, mantener neutro
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    void buscarSiguiente();

    return () => {
      cancelado = true;
    };
  }, [esCuadrilla]);

  if (cargando) {
    return (
      <div className={styles.container}>
        <span className={styles.sectionTitle}>Siguiente misión</span>
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          Buscando despacho prioritario...
        </p>
      </div>
    );
  }

  const rutaBase = esCuadrilla ? '/cuadrilla/misiones' : '/patrulla/misiones';

  if (!siguienteMision) {
    return (
      <div className={styles.container}>
        <span className={styles.sectionTitle}>Siguiente misión</span>
        <div className={styles.emptyState}>
          <CheckCircle size={20} color="var(--color-success, #2E7D32)" aria-hidden="true" />
          <span>
            {!unidadActiva
              ? 'Unidad inactiva en modo de solo lectura.'
              : 'Sin misiones pendientes. La unidad se encuentra disponible para despacho.'}
          </span>
        </div>
      </div>
    );
  }

  const normPrioridad = siguienteMision.prioridad?.toUpperCase() || '';
  let prioridadClase = styles.priorityNeutro;
  if (normPrioridad === 'CRITICA') {
    prioridadClase = styles.priorityCritica;
  } else if (normPrioridad === 'ALTA') {
    prioridadClase = styles.priorityAlta;
  }

  const esEnCurso =
    siguienteMision.estado === 'EN_CURSO' ||
    siguienteMision.estado === 'EN_TERRENO' ||
    siguienteMision.estado === 'EN_RUTA';

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div className={styles.titleGroup}>
          <span className={styles.sectionTitle}>
            {esEnCurso ? 'Misión en curso' : 'Siguiente misión'}
          </span>
          <span className={styles.code}>{siguienteMision.codigoIncidente}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className={`${styles.priorityChip} ${prioridadClase}`}>
            {formatearPrioridad(siguienteMision.prioridad)}
          </span>
          <EstadoBadge estado={siguienteMision.estado} />
        </div>
      </div>

      <div className={styles.typology}>{siguienteMision.tipologia}</div>

      <div className={styles.locationRow}>
        <MapPin size={16} color="var(--color-primary-teal)" aria-hidden="true" />
        <span>{siguienteMision.direccion}</span>
      </div>

      <div style={{ alignSelf: 'flex-start', marginTop: 'var(--space-1)' }}>
        <Button
          variant="primary"
          size="md"
          href={`${rutaBase}/${siguienteMision.id}`}
          icon={<ArrowRight size={16} />}
          iconPosition="right"
        >
          Abrir
        </Button>
      </div>
    </div>
  );
}
