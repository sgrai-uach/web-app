import apiClient from '@/lib/api/client';
import type { paths } from '@/types/api-generated';
import type { MisionLocal } from '@/types/offline';
import {
  guardarMisionesLocales,
  guardarMisionLocal,
  obtenerMisionesLocales,
  obtenerMisionLocalPorId,
  encolarAccionOutbox,
} from '@/services/offlineQueue';
import { limpiarTituloMision, formatearTipologia } from '@/lib/utils/formatters';
import { rechazoMisionSchema, type RechazoMisionInput } from '@/lib/validations/misiones';

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
        datosAdicionales: {
          trabajo: item.descripcion || 'Sin instrucciones adicionales especificadas.',
          titulo: item.titulo,
        },
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
        datosAdicionales: {
          trabajo:
            d.descripcion ||
            d.incidente?.descripcion ||
            'Sin instrucciones adicionales especificadas.',
          titulo: d.titulo,
        },
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

export interface RechazoMisionResultado {
  exito: boolean;
  mensaje: string;
  modoOffline?: boolean;
  mision?: {
    id: string;
    codigo: string;
    estado: string;
    justificacionRechazo: string;
    actualizadoEn?: string;
  };
}

/**
 * Registra el rechazo motivado de una misión táctica (H41, H69).
 * Cumple con la Regla de Negocio Crítica §3.3 (justificación obligatoria >= 5 caracteres).
 * Si hay conectividad, consume POST /api/misiones/{id}/rechazar.
 * Si no hay conexión o falla la red, valida localmente con Zod, encola en IndexedDB outbox
 * y actualiza optimísticamente el estado local a 'RECHAZADA' (Offline-First).
 */
export async function rechazarMision(
  id: string,
  datos: RechazoMisionInput
): Promise<RechazoMisionResultado> {
  const datosValidados = rechazoMisionSchema.parse(datos);

  const payloadApi = {
    justificacion_rechazo: datosValidados.justificacion_rechazo,
    latitud: datosValidados.latitud,
    longitud: datosValidados.longitud,
  };

  const estaOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  if (estaOffline) {
    await encolarAccionOutbox({
      tipo: 'RECHAZAR_MISION',
      url: `/api/misiones/${id}/rechazar`,
      metodo: 'POST',
      payload: payloadApi,
    });

    const local = await obtenerMisionLocalPorId(id);
    if (local) {
      await guardarMisionLocal({
        ...local,
        estado: 'RECHAZADA',
        actualizadoEn: new Date().toISOString(),
        datosAdicionales: {
          ...local.datosAdicionales,
          justificacionRechazo: datosValidados.justificacion_rechazo,
        },
      });
    }

    return {
      exito: true,
      mensaje: 'Rechazo registrado localmente. Se sincronizará automáticamente al recuperar la conexión.',
      modoOffline: true,
      mision: {
        id,
        codigo: local?.codigoIncidente || id,
        estado: 'RECHAZADA',
        justificacionRechazo: datosValidados.justificacion_rechazo,
      },
    };
  }

  try {
    const { data, error, response } = await apiClient.POST('/api/misiones/{id}/rechazar', {
      params: {
        path: { id },
        header: {
          authorization: '',
        },
      },
      body: payloadApi,
    });

    if (error || !response.ok) {
      const errorMsg =
        (error as { message?: string })?.message ||
        `Error al rechazar la misión (${response.status}).`;
      throw new Error(errorMsg);
    }

    const local = await obtenerMisionLocalPorId(id);
    if (local) {
      await guardarMisionLocal({
        ...local,
        estado: 'RECHAZADA',
        actualizadoEn: data?.data?.mision?.actualizadoEn || new Date().toISOString(),
        datosAdicionales: {
          ...local.datosAdicionales,
          justificacionRechazo: datosValidados.justificacion_rechazo,
        },
      });
    }

    return {
      exito: true,
      mensaje: data?.message || 'Misión rechazada exitosamente.',
      mision: data?.data?.mision,
    };
  } catch (err) {
    if (
      err instanceof TypeError &&
      (err.message.includes('fetch') || err.message.includes('network') || err.message.includes('Failed'))
    ) {
      await encolarAccionOutbox({
        tipo: 'RECHAZAR_MISION',
        url: `/api/misiones/${id}/rechazar`,
        metodo: 'POST',
        payload: payloadApi,
      });

      const local = await obtenerMisionLocalPorId(id);
      if (local) {
        await guardarMisionLocal({
          ...local,
          estado: 'RECHAZADA',
          actualizadoEn: new Date().toISOString(),
          datosAdicionales: {
            ...local.datosAdicionales,
            justificacionRechazo: datosValidados.justificacion_rechazo,
          },
        });
      }

      return {
        exito: true,
        mensaje: 'Sin conexión estable. Rechazo guardado localmente para envío diferido.',
        modoOffline: true,
        mision: {
          id,
          codigo: local?.codigoIncidente || id,
          estado: 'RECHAZADA',
          justificacionRechazo: datosValidados.justificacion_rechazo,
        },
      };
    }

    throw err;
  }
}

