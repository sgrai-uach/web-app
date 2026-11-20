import apiClient, { handleUnauthorizedSession } from '@/lib/api/client';
import {
  guardarCatalogoLocal,
  obtenerCatalogoLocal,
} from '@/services/offlineQueue';
import type {
  EventoPrevencionDetalleApi,
  EventoPrevencionResumenLocal,
  MisionLocal,
  PuntoCriticoPrevencionLocal,
  RecursoPrevencionLocal,
} from '@/types/offline';

export const CLAVE_CACHE_EVENTO_PREFIJO = 'evento_prevencion_';

export interface CoordenadasWGS84 {
  lat: number;
  lng: number;
}

export interface ContextoPrevencionMision {
  eventoPrevencion: EventoPrevencionResumenLocal | null;
  puntoCritico: PuntoCriticoPrevencionLocal | null;
  recursosMision: RecursoPrevencionLocal[];
  recursosOtrosEvento: RecursoPrevencionLocal[];
}

/**
 * Extrae coordenadas WGS84 (`{ lat, lng }`) desde un objeto o cadena GeoJSON `Point` (`[lng, lat]`).
 */
export function extraerCoordenadasGeoJson(
  ubicacionGeoJson: unknown
): CoordenadasWGS84 | undefined {
  if (!ubicacionGeoJson) return undefined;

  let parsed: unknown = ubicacionGeoJson;
  if (typeof ubicacionGeoJson === 'string') {
    try {
      parsed = JSON.parse(ubicacionGeoJson);
    } catch {
      return undefined;
    }
  }

  if (!parsed || typeof parsed !== 'object') return undefined;
  const obj = parsed as { type?: unknown; coordinates?: unknown };
  if (obj.type !== 'Point' || !Array.isArray(obj.coordinates) || obj.coordinates.length < 2) {
    return undefined;
  }

  const lng = Number(obj.coordinates[0]);
  const lat = Number(obj.coordinates[1]);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return undefined;
  }

  return { lat, lng };
}

/**
 * Normaliza un listado heterogéneo de recursos asignados a un evento de prevención
 * proveniente de la API o de eventos WebSocket en tiempo real.
 */
export function normalizarRecursosPrevencion(
  raw: unknown,
  misionIdFallback?: string | null
): RecursoPrevencionLocal[] {
  if (!Array.isArray(raw)) return [];

  const resultado: RecursoPrevencionLocal[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const recursoId =
      typeof obj.recursoId === 'string'
        ? obj.recursoId.trim()
        : typeof obj.recurso_id === 'string'
          ? obj.recurso_id.trim()
          : '';
    const nombre = typeof obj.nombre === 'string' ? obj.nombre.trim() : '';
    const cantidadAsignada = Number(obj.cantidadAsignada ?? obj.cantidad ?? 0);

    if (!recursoId || !nombre || !Number.isFinite(cantidadAsignada) || cantidadAsignada <= 0) {
      continue;
    }

    const misionIdRaw =
      typeof obj.misionId === 'string'
        ? obj.misionId
        : typeof obj.mision_id === 'string'
          ? obj.mision_id
          : misionIdFallback ?? null;

    resultado.push({
      ...(typeof obj.id === 'string' ? { id: obj.id } : {}),
      recursoId,
      nombre,
      esIndividual: Boolean(obj.esIndividual ?? obj.es_individual),
      cantidadAsignada,
      ...(typeof obj.cantidadEnUso === 'number' ? { cantidadEnUso: obj.cantidadEnUso } : {}),
      ...(typeof obj.estadoRecurso === 'string' ? { estadoRecurso: obj.estadoRecurso } : {}),
      ...(obj.unidad !== undefined ? { unidad: obj.unidad as string | null } : {}),
      misionId: misionIdRaw,
      ...(typeof obj.creadoEn === 'string' ? { creadoEn: obj.creadoEn } : {}),
    });
  }

  return resultado;
}

/**
 * Separa los recursos vinculados directamente a una misión preventiva (`evento_prevencion_recurso.mision_id`)
 * respecto de recursos asignados a otras misiones dentro del mismo evento.
 */
export function filtrarRecursosDeMision(
  recursos: RecursoPrevencionLocal[],
  misionId: string,
  totalMisionesEvento?: number
): {
  propios: RecursoPrevencionLocal[];
  otrosEvento: RecursoPrevencionLocal[];
} {
  if (!Array.isArray(recursos) || recursos.length === 0) {
    return { propios: [], otrosEvento: [] };
  }

  const hayAlgunMisionId = recursos.some((r) => Boolean(r.misionId));
  const propios: RecursoPrevencionLocal[] = [];
  const otrosEvento: RecursoPrevencionLocal[] = [];

  for (const recurso of recursos) {
    if (recurso.misionId && recurso.misionId === misionId) {
      propios.push(recurso);
    } else if (!recurso.misionId && (!hayAlgunMisionId || totalMisionesEvento === 1)) {
      propios.push(recurso);
    } else {
      otrosEvento.push(recurso);
    }
  }

  return { propios, otrosEvento };
}

async function guardarEventoPrevencionEnCache(
  eventoId: string,
  detalle: EventoPrevencionDetalleApi
): Promise<void> {
  try {
    if (typeof guardarCatalogoLocal !== 'function') return;
    await guardarCatalogoLocal(`${CLAVE_CACHE_EVENTO_PREFIJO}${eventoId}`, [detalle]);
  } catch {
    // Ignorar fallos de almacenamiento local
  }
}

async function leerEventoPrevencionDesdeCache(
  eventoId: string
): Promise<EventoPrevencionDetalleApi | null> {
  try {
    if (typeof obtenerCatalogoLocal !== 'function') return null;
    const cached = await obtenerCatalogoLocal<EventoPrevencionDetalleApi>(
      `${CLAVE_CACHE_EVENTO_PREFIJO}${eventoId}`
    );
    return Array.isArray(cached) && cached.length > 0 ? cached[0] : null;
  } catch {
    return null;
  }
}

/**
 * Consulta el detalle de un evento de prevención (`GET /api/eventos-atp/prevencion/{id}`).
 * Si hay éxito, persiste el detalle en IndexedDB para acceso sin conexión.
 * Ante 403, 404, 5xx o ausencia de red, degrada silenciosamente a caché IndexedDB sin bloquear la vista.
 */
export async function obtenerDetalleEventoPrevencion(
  eventoId: string
): Promise<EventoPrevencionDetalleApi | null> {
  const limpio = eventoId?.trim();
  if (!limpio) return null;

  const estaOnline =
    typeof navigator === 'undefined' ? true : navigator.onLine !== false;

  if (estaOnline) {
    try {
      const { data, error, response } = await apiClient.GET(
        '/api/eventos-atp/prevencion/{id}',
        {
          params: {
            path: { id: limpio },
          },
        }
      );

      if (response?.status === 401) {
        handleUnauthorizedSession();
        return null;
      }

      if (!error && data && data.data) {
        await guardarEventoPrevencionEnCache(limpio, data.data);
        return data.data;
      }
    } catch {
      // Falla de red: continuar con caché IndexedDB
    }
  }

  return leerEventoPrevencionDesdeCache(limpio);
}

/**
 * Extrae tipadamente el contexto preventivo (evento, punto crítico y recursos trazados por misión)
 * desde `mision.datosAdicionales`.
 */
export function obtenerContextoPrevencionMision(
  mision?: MisionLocal | null
): ContextoPrevencionMision {
  const datos = mision?.datosAdicionales;
  if (!datos) {
    return {
      eventoPrevencion: null,
      puntoCritico: null,
      recursosMision: [],
      recursosOtrosEvento: [],
    };
  }

  const eventoRaw = datos.eventoPrevencion;
  const eventoPrevencion =
    eventoRaw && typeof eventoRaw === 'object'
      ? (eventoRaw as EventoPrevencionResumenLocal)
      : null;

  const puntoRaw = datos.puntoCritico;
  const puntoCritico =
    puntoRaw && typeof puntoRaw === 'object'
      ? (puntoRaw as PuntoCriticoPrevencionLocal)
      : null;

  const recursosMision = normalizarRecursosPrevencion(
    datos.recursosPrevencion,
    mision?.id
  );
  const recursosOtrosEvento = normalizarRecursosPrevencion(
    datos.recursosEventoPrevencion
  );

  return {
    eventoPrevencion,
    puntoCritico,
    recursosMision,
    recursosOtrosEvento,
  };
}
