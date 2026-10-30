import apiClient from '@/lib/api/client';
import type { paths } from '@/types/api-generated';
import type { MisionLocal } from '@/types/offline';
import {
  guardarMisionesLocales,
  guardarMisionLocal,
  obtenerMisionesLocales,
  obtenerMisionLocalPorId,
} from '@/services/offlineQueue';
import { limpiarTituloMision, formatearTipologia } from '@/lib/utils/formatters';

type TipoMisionFiltro =
  | 'VERIFICACION'
  | 'ATENCION_CUADRILLA'
  | 'PREVENCION'
  | 'RECUPERACION'
  | 'ASISTENCIA_SOCIAL';

export interface FiltrosMisiones {
  tipoMision?: TipoMisionFiltro;
  patrullaId?: string;
  cuadrillaId?: string;
}

type MisionApiItem = paths['/api/misiones']['get']['responses'][200]['content']['application/json']['data'][number];
type MisionDetalleApi = paths['/api/misiones/{id}']['get']['responses'][200]['content']['application/json']['data'];

/**
 * Consulta y sincroniza el listado de misiones asignadas desde el backend SGRAI.
 * Si hay conectividad, actualiza el almacenamiento local IndexedDB (Offline-First).
 * Si ocurre una falla de red o se está offline, devuelve las misiones persistidas localmente.
 */
export async function sincronizarMisiones(filtros?: FiltrosMisiones): Promise<MisionLocal[]> {
  try {
    const { data, error } = await apiClient.GET('/api/misiones', {
      params: {
        query: {
          tipoMision: filtros?.tipoMision,
          patrullaId: filtros?.patrullaId,
          cuadrillaId: filtros?.cuadrillaId,
          ordenarPor: 'creadoEn',
          orden: 'desc',
        },
        header: {
          authorization: '',
        },
      },
    });

    if (!error && data && Array.isArray(data.data)) {
      const remotas: MisionLocal[] = data.data.map((item: MisionApiItem) => ({
        id: item.id,
        incidenteId: item.incidenteId || '',
        codigoIncidente: item.incidenteCodigo || item.codigo,
        tipologia: limpiarTituloMision(item.titulo),
        direccion:
          item.descripcion ||
          (item.delegacionNombre ? `Sector ${item.delegacionNombre}` : 'Valdivia'),
        prioridad: item.prioridad,
        estado: item.estado,
        fechaDespacho: item.fechaInicio || item.creadoEn,
        actualizadoEn: item.actualizadoEn,
      }));

      if (remotas.length > 0) {
        await guardarMisionesLocales(remotas);
      }
      return remotas;
    }
  } catch {
    // Modo sin conexión o falla de red: continuar con almacenamiento local
  }

  return obtenerMisionesLocales();
}

/**
 * Consulta el detalle completo de una misión operativa.
 * Si hay conexión, consulta la API remota y refresca el almacenamiento local IndexedDB.
 * Si está offline, retorna la misión almacenada localmente.
 */
export async function obtenerDetalleMision(id: string): Promise<MisionLocal | null> {
  try {
    const { data, error } = await apiClient.GET('/api/misiones/{id}', {
      params: {
        path: { id },
      },
    });

    if (!error && data && data.data) {
      const d: MisionDetalleApi = data.data;
      const misionLocal: MisionLocal = {
        id: d.id,
        incidenteId: d.incidente?.id || '',
        codigoIncidente: d.incidente?.codigo || d.codigo,
        tipologia: d.incidente?.tipoAfectacion
          ? formatearTipologia(d.incidente.tipoAfectacion)
          : limpiarTituloMision(d.titulo),
        direccion: d.incidente?.direccion || d.descripcion || 'Valdivia',
        coordenadas:
          d.incidente?.latitud && d.incidente?.longitud
            ? { lat: d.incidente.latitud, lng: d.incidente.longitud }
            : undefined,
        prioridad: d.prioridad,
        estado: d.estado,
        fechaDespacho: d.fechaInicio || d.creadoEn,
        actualizadoEn: d.actualizadoEn,
      };

      await guardarMisionLocal(misionLocal);
      return misionLocal;
    }
  } catch {
    // Continuar con búsqueda local si falla la red
  }

  const local = await obtenerMisionLocalPorId(id);
  return local || null;
}
