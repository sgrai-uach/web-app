'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Heading } from '@/components/ui/Heading';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { sincronizarMisiones } from '@/services/misionesService';
import { UnidadEstadoBanner } from '@/components/common/UnidadEstadoBanner';
import { ordenarMisionesPorActualizacion } from '@/lib/utils/formatters';
import {
  MisionFiltrosChips,
  type FiltroEstado,
  type ConteoFiltros,
} from '@/components/misiones/MisionFiltrosChips';
import { MisionCard } from '@/components/misiones/MisionCard';
import { useMisionesSocket } from '@/hooks/useMisionesSocket';
import type { MisionLocal } from '@/types/offline';
import styles from '@/components/misiones/MisionesBandeja.module.css';

export interface MisionesBandejaViewProps {
  tipoUnidad: 'patrulla' | 'cuadrilla';
}

/**
 * Bandeja unificada de misiones para Patrulla Verificadora y Cuadrilla Operativa,
 * asegurando paridad total de filtros, listeners en tiempo real y renderizado.
 */
export function MisionesBandejaView({ tipoUnidad }: MisionesBandejaViewProps) {
  const { usuario, unidadActiva, tieneUnidadAsignada, estadoAsignacion } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const esCuadrilla = tipoUnidad === 'cuadrilla';
  const [misiones, setMisiones] = useState<MisionLocal[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);

  const estadoParam = searchParams.get('estado');
  const filtroActual: FiltroEstado =
    estadoParam === 'pendientes' ||
    estadoParam === 'en_curso' ||
    estadoParam === 'finalizadas'
      ? estadoParam
      : 'todas';

  const cargarMisiones = useCallback(async () => {
    setCargando(true);
    try {
      if (!tieneUnidadAsignada || estadoAsignacion === 'SIN_ASIGNACION') {
        setMisiones([]);
        return;
      }

      const locales = await sincronizarMisiones(
        esCuadrilla
          ? {
              tipoMision: 'ATENCION_CUADRILLA',
              cuadrillaId: usuario?.unidadId || undefined,
            }
          : {
              tipoMision: 'VERIFICACION',
              patrullaId: usuario?.unidadId || undefined,
            }
      );

      setMisiones(locales);
    } finally {
      setCargando(false);
    }
  }, [esCuadrilla, tieneUnidadAsignada, estadoAsignacion, usuario?.unidadId]);

  useEffect(() => {
    void cargarMisiones();
  }, [cargarMisiones]);

  useMisionesSocket({
    onNuevaMision: () => {
      void cargarMisiones();
    },
    onMisionActualizada: () => {
      void cargarMisiones();
    },
    habilitado: Boolean(unidadActiva),
  });

  useEffect(() => {
    const refrescar = () => {
      void cargarMisiones();
    };
    window.addEventListener('sgrai:outbox-synced', refrescar);
    window.addEventListener('sgrai:mision-rechazada', refrescar);
    window.addEventListener('sgrai:mision-sincronizada', refrescar);
    window.addEventListener('sgrai:mision_asignada', refrescar);
    window.addEventListener('sgrai:mision_actualizada', refrescar);
    return () => {
      window.removeEventListener('sgrai:outbox-synced', refrescar);
      window.removeEventListener('sgrai:mision-rechazada', refrescar);
      window.removeEventListener('sgrai:mision-sincronizada', refrescar);
      window.removeEventListener('sgrai:mision_asignada', refrescar);
      window.removeEventListener('sgrai:mision_actualizada', refrescar);
    };
  }, [cargarMisiones]);

  const cambiarFiltro = (nuevoFiltro: FiltroEstado) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nuevoFiltro === 'todas') {
      params.delete('estado');
    } else {
      params.set('estado', nuevoFiltro);
    }
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
  };

  const conteos = useMemo<ConteoFiltros>(() => {
    let pendientes = 0;
    let en_curso = 0;
    let finalizadas = 0;

    for (const m of misiones) {
      const e = m.estado?.toUpperCase();
      if (e === 'ASIGNADA' || e === 'DESPACHADA' || e === 'PENDIENTE') {
        pendientes++;
      } else if (e === 'EN_CURSO' || e === 'EN_TERRENO' || e === 'EN_RUTA') {
        en_curso++;
      } else if (e === 'FINALIZADA' || e === 'COMPLETADA' || e === 'CERRADA') {
        finalizadas++;
      }
    }

    return {
      todas: misiones.length,
      pendientes,
      en_curso,
      finalizadas,
    };
  }, [misiones]);

  const misionesFiltradas = useMemo(() => {
    let filtradas = misiones;

    if (filtroActual === 'pendientes') {
      filtradas = misiones.filter((m) => {
        const e = m.estado?.toUpperCase();
        return e === 'ASIGNADA' || e === 'DESPACHADA' || e === 'PENDIENTE';
      });
    } else if (filtroActual === 'en_curso') {
      filtradas = misiones.filter((m) => {
        const e = m.estado?.toUpperCase();
        return e === 'EN_CURSO' || e === 'EN_TERRENO' || e === 'EN_RUTA';
      });
    } else if (filtroActual === 'finalizadas') {
      filtradas = misiones.filter((m) => {
        const e = m.estado?.toUpperCase();
        return e === 'FINALIZADA' || e === 'COMPLETADA' || e === 'CERRADA';
      });
    }

    return ordenarMisionesPorActualizacion(filtradas);
  }, [misiones, filtroActual]);

  const rutaBase = esCuadrilla ? '/cuadrilla/misiones' : '/patrulla/misiones';

  return (
    <div className={styles.container}>
      {!tieneUnidadAsignada ? (
        <UnidadEstadoBanner
          variante="sin_asignacion"
          tipoUnidad={tipoUnidad}
          nombreOperador={usuario?.nombre}
        />
      ) : !unidadActiva ? (
        <UnidadEstadoBanner
          variante="desactivada"
          tipoUnidad={tipoUnidad}
          nombreUnidad={usuario?.unidadNombre}
        />
      ) : null}

      <div className={styles.titleArea}>
        <Heading variant="h1">
          {tieneUnidadAsignada && !unidadActiva ? 'Historial' : 'Misiones'}
        </Heading>
      </div>

      <MisionFiltrosChips
        filtroActual={filtroActual}
        conteos={conteos}
        onCambiarFiltro={cambiarFiltro}
      />

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
              {!tieneUnidadAsignada
                ? esCuadrilla
                  ? 'El funcionario no posee una cuadrilla asignada. Solicite su asignación en el Centro de Mando.'
                  : 'El funcionario no posee una patrulla asignada. Solicite su asignación en el Centro de Mando.'
                : !unidadActiva
                  ? esCuadrilla
                    ? 'No se encontraron faenas históricas registradas para esta cuadrilla.'
                    : 'No se encontraron misiones históricas para esta patrulla.'
                  : esCuadrilla
                    ? 'La cuadrilla se encuentra disponible para despacho.'
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
      ) : misionesFiltradas.length === 0 ? (
        <div className={styles.emptyState}>
          <AlertCircle size={32} color="var(--color-text-muted)" aria-hidden="true" />
          <div>
            <p style={{ fontWeight: 600, margin: '0 0 var(--space-2) 0' }}>
              No hay misiones con el filtro seleccionado.
            </p>
          </div>
          <Button variant="ghost" onClick={() => cambiarFiltro('todas')}>
            Limpiar filtros
          </Button>
        </div>
      ) : (
        <div className={styles.missionList}>
          {misionesFiltradas.map((mision) => (
            <MisionCard
              key={mision.id}
              mision={mision}
              href={`${rutaBase}/${mision.id}`}
              esInactiva={!unidadActiva}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default MisionesBandejaView;
