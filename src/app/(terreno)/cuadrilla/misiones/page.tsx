'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { AlertCircle, RefreshCw, CheckCircle2, WifiOff, X } from 'lucide-react';
import { Heading } from '@/components/ui/Heading';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { sincronizarMisiones } from '@/services/misionesService';
import { UnidadInactivaBanner } from '@/components/common/UnidadInactivaBanner';
import { SinUnidadBanner } from '@/components/common/SinUnidadBanner';
import { ordenarMisionesPorActualizacion } from '@/lib/utils/formatters';
import {
  MisionFiltrosChips,
  type FiltroEstado,
  type ConteoFiltros,
} from '@/components/misiones/MisionFiltrosChips';
import { MisionCard } from '@/components/misiones/MisionCard';
import { NuevaMisionBanner } from '@/components/misiones/NuevaMisionBanner';
import { useMisionesSocket } from '@/hooks/useMisionesSocket';
import type { MisionLocal } from '@/types/offline';
import styles from './CuadrillaMisionesPage.module.css';

function CuadrillaMisionesContenido() {
  const { usuario, unidadActiva, tieneUnidadAsignada, estadoAsignacion } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [misiones, setMisiones] = useState<MisionLocal[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);

  // Leer filtro desde URL ?estado= (default: 'todas') y feedback persistente tras rechazo (BUG-H41-PWA-03)
  const estadoParam = searchParams.get('estado');
  const rechazoParam = searchParams.get('rechazo');
  const msgParam = searchParams.get('msg');
  const filtroActual: FiltroEstado =
    estadoParam === 'pendientes' ||
    estadoParam === 'en_curso' ||
    estadoParam === 'finalizadas'
      ? estadoParam
      : 'todas';

  const descartarFeedbackRechazo = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('rechazo');
    params.delete('msg');
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
  };

  const cargarMisiones = useCallback(async () => {
    setCargando(true);
    try {
      if (!tieneUnidadAsignada || estadoAsignacion === 'SIN_ASIGNACION') {
        setMisiones([]);
        return;
      }

      const locales = await sincronizarMisiones({
        tipoMision: 'ATENCION_CUADRILLA',
        cuadrillaId: usuario?.unidadId || undefined,
      });

      setMisiones(locales);
    } finally {
      setCargando(false);
    }
  }, [tieneUnidadAsignada, estadoAsignacion, usuario?.unidadId]);

  useEffect(() => {
    cargarMisiones();
  }, [cargarMisiones]);

  useEffect(() => {
    const refrescar = () => {
      void cargarMisiones();
    };
    window.addEventListener('sgrai:outbox-synced', refrescar);
    window.addEventListener('sgrai:mision-rechazada', refrescar);
    window.addEventListener('sgrai:mision-sincronizada', refrescar);
    window.addEventListener('sgrai:mision_actualizada', refrescar);
    return () => {
      window.removeEventListener('sgrai:outbox-synced', refrescar);
      window.removeEventListener('sgrai:mision-rechazada', refrescar);
      window.removeEventListener('sgrai:mision-sincronizada', refrescar);
      window.removeEventListener('sgrai:mision_actualizada', refrescar);
    };
  }, [cargarMisiones]);

  const { ultimaMisionAsignada, descartarUltimaMision } = useMisionesSocket({
    onNuevaMision: () => {
      void cargarMisiones();
    },
    onMisionActualizada: () => {
      void cargarMisiones();
    },
    habilitado: Boolean(unidadActiva),
  });

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

    return ordenarMisionesPorActualizacion(filtradas);
  }, [misiones, filtroActual]);

  return (
    <div className={styles.container}>
      {ultimaMisionAsignada && (
        <NuevaMisionBanner
          codigoMision={ultimaMisionAsignada.codigo}
          misionId={ultimaMisionAsignada.misionId}
          urlDetalle={`/cuadrilla/misiones/${ultimaMisionAsignada.misionId}`}
          alCerrar={descartarUltimaMision}
        />
      )}

      {(rechazoParam === 'ok' || rechazoParam === 'offline') && (
        <div
          role="status"
          className={
            rechazoParam === 'offline'
              ? styles.feedbackOfflineBanner
              : styles.feedbackSuccessBanner
          }
        >
          <div className={styles.feedbackContent}>
            {rechazoParam === 'offline' ? (
              <WifiOff size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
            ) : (
              <CheckCircle2 size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
            )}
            <span>
              {msgParam ||
                (rechazoParam === 'offline'
                  ? 'Rechazo registrado localmente. Se sincronizará automáticamente al recuperar la conexión.'
                  : 'Misión rechazada exitosamente.')}
            </span>
          </div>
          <button
            type="button"
            onClick={descartarFeedbackRechazo}
            className={styles.feedbackCloseButton}
            aria-label="Cerrar notificación de rechazo"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

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

      <div className={styles.titleArea}>
        <Heading variant="h1">
          {tieneUnidadAsignada && !unidadActiva ? 'Historial' : 'Misiones'}
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
              {!tieneUnidadAsignada
                ? 'El funcionario no posee una cuadrilla asignada. Solicite su asignación en el Centro de Mando.'
                : !unidadActiva
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
              href={`/cuadrilla/misiones/${mision.id}`}
              esInactiva={!unidadActiva}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CuadrillaMisionesPage() {
  return (
    <Suspense fallback={<div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>Cargando misiones...</div>}>
      <CuadrillaMisionesContenido />
    </Suspense>
  );
}
