'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Heading } from '@/components/ui/Heading';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { sincronizarMisiones } from '@/services/misionesService';
import { guardarMisionesLocales } from '@/services/offlineQueue';
import { UnidadInactivaBanner } from '@/components/common/UnidadInactivaBanner';
import { ordenarMisionesPorPrioridadYFecha } from '@/lib/utils/formatters';
import {
  MisionFiltrosChips,
  type FiltroEstado,
  type ConteoFiltros,
} from '@/components/misiones/MisionFiltrosChips';
import { MisionCard } from '@/components/misiones/MisionCard';
import type { MisionLocal } from '@/types/offline';
import styles from './PatrullaMisionesPage.module.css';

function PatrullaMisionesContenido() {
  const { usuario, unidadActiva } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [misiones, setMisiones] = useState<MisionLocal[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);

  // Leer filtro desde URL ?estado= (default: 'todas')
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
      let locales = await sincronizarMisiones({
        tipoMision: 'VERIFICACION',
      });

      if (!unidadActiva && locales.length === 0) {
        const historicas: MisionLocal[] = [
          {
            id: 'patrulla-hist-01',
            incidenteId: 'inc-102',
            codigoIncidente: 'INC-2026-00102',
            tipologia: 'Caída de árbol',
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
            tipologia: 'Deslizamiento',
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

  // Conteos para los chips
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

  // Filtrado y ordenamiento por prioridad y fecha
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

    return ordenarMisionesPorPrioridadYFecha(filtradas);
  }, [misiones, filtroActual]);

  return (
    <div className={styles.container}>
      {!unidadActiva && (
        <UnidadInactivaBanner
          tipoUnidad="patrulla"
          nombreUnidad={usuario?.unidadNombre}
        />
      )}

      <div className={styles.titleArea}>
        <Heading variant="h1">
          {!unidadActiva ? 'Historial' : 'Misiones'}
        </Heading>
      </div>

      {/* Chips de filtrado cuadrado */}
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
              {!unidadActiva
                ? 'No se encontraron misiones históricas para esta patrulla.'
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
          <Button
            variant="ghost"
            onClick={() => cambiarFiltro('todas')}
          >
            Limpiar filtros
          </Button>
        </div>
      ) : (
        <div className={styles.missionList}>
          {misionesFiltradas.map((mision) => (
            <MisionCard
              key={mision.id}
              mision={mision}
              href={`/patrulla/misiones/${mision.id}`}
              esInactiva={!unidadActiva}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PatrullaMisionesPage() {
  return (
    <Suspense fallback={<div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>Cargando misiones...</div>}>
      <PatrullaMisionesContenido />
    </Suspense>
  );
}
