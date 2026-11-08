import apiClient from '@/lib/api/client';
import type { paths } from '@/types/api-generated';
import type {
  MisionLocal,
  ReportarLlegadaPayload,
  ReportarLlegadaResponseData,
} from '@/types/offline';
import {
  guardarMisionesLocales,
  guardarMisionLocal,
  obtenerMisionesLocales,
  obtenerMisionLocalPorId,
  encolarAccionOutbox,
} from '@/services/offlineQueue';
import { limpiarTituloMision, formatearTipologia } from '@/lib/utils/formatters';

export class MisionServiceError extends Error {
  public readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'MisionServiceError';
    this.statusCode = statusCode;
  }
}

export type GeoErrorCode =
  | 'NO_SOPORTADO'
  | 'PERMISO_DENEGADO'
  | 'POSICION_NO_DISPONIBLE'
  | 'TIMEOUT'
  | 'DESCONOCIDO';

export class GeolocationError extends Error {
  public readonly code: GeoErrorCode;

  constructor(code: GeoErrorCode, message: string) {
    super(message);
    this.name = 'GeolocationError';
    this.code = code;
  }
}

export interface CoordenadasGps {
  latitud: number;
  longitud: number;
}

export interface ResultadoReportarLlegada {
  mision: MisionLocal;
  enColaOffline: boolean;
  yaReportadaPreviamente?: boolean;
  mensaje: string;
}

export interface OpcionesReportarLlegada {
  coordenadas?: Partial<ReportarLlegadaPayload>;
  misionActual?: MisionLocal;
  usarUbicacionMision?: boolean;
  observaciones?: string;
  timeoutGpsMs?: number;
}

/**
 * Valida que las coordenadas y datos de llegada cumplan estrictamente
 * con el contrato de la API antes de enviarse o encolarse en IndexedDB.
 */
export function validarPayloadLlegadaMision(
  payload: Partial<ReportarLlegadaPayload>
): ReportarLlegadaPayload {
  const { latitud, longitud, observaciones } = payload;

  if (
    typeof latitud !== 'number' ||
    !Number.isFinite(latitud) ||
    latitud < -90 ||
    latitud > 90
  ) {
    throw new MisionServiceError(400, 'La latitud es inválida. Debe ser un número entre -90 y 90.');
  }

  if (
    typeof longitud !== 'number' ||
    !Number.isFinite(longitud) ||
    longitud < -180 ||
    longitud > 180
  ) {
    throw new MisionServiceError(400, 'La longitud es inválida. Debe ser un número entre -180 y 180.');
  }

  const validado: ReportarLlegadaPayload = {
    latitud,
    longitud,
  };

  if (typeof observaciones === 'string' && observaciones.trim().length > 0) {
    validado.observaciones = observaciones.trim().slice(0, 500);
  }

  return validado;
}

/**
 * Solicita las coordenadas GPS de alta precisión mediante la Geolocation API del navegador.
 */
export async function obtenerCoordenadasGps(timeoutMs = 10000): Promise<CoordenadasGps> {
  if (
    typeof window === 'undefined' ||
    typeof navigator === 'undefined' ||
    !navigator.geolocation ||
    typeof navigator.geolocation.getCurrentPosition !== 'function'
  ) {
    throw new GeolocationError(
      'NO_SOPORTADO',
      'El navegador o dispositivo no soporta geolocalización GPS.'
    );
  }

  return new Promise<CoordenadasGps>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitud: pos.coords.latitude,
          longitud: pos.coords.longitude,
        });
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(
              new GeolocationError(
                'PERMISO_DENEGADO',
                'Permiso de ubicación denegado. Active los permisos de GPS en su navegador.'
              )
            );
            break;
          case error.POSITION_UNAVAILABLE:
            reject(
              new GeolocationError(
                'POSICION_NO_DISPONIBLE',
                'Señal satelital no disponible. Verifique que la ubicación de su dispositivo esté activada.'
              )
            );
            break;
          case error.TIMEOUT:
            reject(
              new GeolocationError(
                'TIMEOUT',
                'Tiempo de espera agotado al obtener señal GPS. Intente a cielo abierto o use la ubicación de la misión.'
              )
            );
            break;
          default:
            reject(
              new GeolocationError(
                'DESCONOCIDO',
                'No fue posible obtener las coordenadas GPS del dispositivo.'
              )
            );
            break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 0,
      }
    );
  });
}

/**
 * Reporta la llegada a terreno de la cuadrilla (H42).
 * - Invoca POST /api/misiones/{id}/llegada con coordenadas GPS actuales.
 * - En caso de 201 Created: actualiza el estado local a 'EN_CURSO' y fechaLlegada.
 * - En caso de 409 Conflict: maneja la idempotencia (llegada ya reportada) fijando 'EN_CURSO'.
 * - En caso de estar sin conexión: persiste de forma optimista en IndexedDB y encola en outbox.
 */
export async function reportarLlegadaCuadrilla(
  misionId: string,
  opciones?: OpcionesReportarLlegada
): Promise<ResultadoReportarLlegada> {
  const misionBase: MisionLocal =
    opciones?.misionActual ||
    (await obtenerMisionLocalPorId(misionId)) || {
      id: misionId,
      incidenteId: '',
      codigoIncidente: misionId,
      tipologia: 'Atención de Cuadrilla',
      direccion: 'Valdivia',
      prioridad: 'ALTA',
      estado: 'DESPACHADA',
      fechaDespacho: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
    };

  let coords: CoordenadasGps;

  if (
    opciones?.coordenadas &&
    typeof opciones.coordenadas.latitud === 'number' &&
    typeof opciones.coordenadas.longitud === 'number'
  ) {
    coords = {
      latitud: opciones.coordenadas.latitud,
      longitud: opciones.coordenadas.longitud,
    };
  } else if (opciones?.usarUbicacionMision && misionBase.coordenadas) {
    coords = {
      latitud: misionBase.coordenadas.lat,
      longitud: misionBase.coordenadas.lng,
    };
  } else {
    coords = await obtenerCoordenadasGps(opciones?.timeoutGpsMs ?? 10000);
  }

  const payload = validarPayloadLlegadaMision({
    latitud: coords.latitud,
    longitud: coords.longitud,
    observaciones: opciones?.observaciones || opciones?.coordenadas?.observaciones,
  });

  const estaOffline =
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    navigator.onLine === false;

  if (!estaOffline) {
    try {
      const { data, error, response } = await apiClient.POST('/api/misiones/{id}/llegada', {
        params: {
          path: { id: misionId },
        },
        body: payload,
      });

      if (!error && data && data.data) {
        const resData: ReportarLlegadaResponseData['data'] = data.data;
        const misionActualizada: MisionLocal = {
          ...misionBase,
          id: resData.misionId || misionId,
          codigoIncidente: resData.codigoMision || misionBase.codigoIncidente,
          estado: resData.estadoMision || 'EN_CURSO',
          fechaInicio: resData.registradoEn || misionBase.fechaInicio || new Date().toISOString(),
          fechaLlegada: resData.registradoEn,
          sincronizacionPendiente: false,
          datosAdicionales: {
            ...(misionBase.datosAdicionales || {}),
            hitoLlegada: resData.descripcion,
            miembrosActualizados: resData.miembrosActualizados,
          },
          actualizadoEn: resData.registradoEn || new Date().toISOString(),
        };

        await guardarMisionLocal(misionActualizada);

        return {
          mision: misionActualizada,
          enColaOffline: false,
          mensaje: data.message || 'Llegada a terreno reportada exitosamente.',
        };
      }

      const status = response?.status ?? 500;

      // Idempotencia: 409 Conflict indica que la llegada ya fue reportada
      if (status === 409) {
        const ahoraIso = new Date().toISOString();
        const misionIdempotente: MisionLocal = {
          ...misionBase,
          estado: 'EN_CURSO',
          fechaInicio: misionBase.fechaInicio || ahoraIso,
          fechaLlegada: misionBase.fechaLlegada || ahoraIso,
          sincronizacionPendiente: false,
          actualizadoEn: ahoraIso,
        };

        await guardarMisionLocal(misionIdempotente);

        return {
          mision: misionIdempotente,
          enColaOffline: false,
          yaReportadaPreviamente: true,
          mensaje: 'La llegada a terreno ya fue reportada previamente. Misión en curso.',
        };
      }

      if (status === 400 || status === 401 || status === 403 || status === 404) {
        const msgError =
          (error as { message?: string } | undefined)?.message ||
          (status === 403
            ? 'No cuenta con permisos o no es el delegado de la brigada asignada.'
            : status === 404
              ? 'La misión solicitada no fue encontrada.'
              : 'No fue posible registrar la llegada a terreno.');
        throw new MisionServiceError(status, msgError);
      }
    } catch (err) {
      if (err instanceof MisionServiceError) {
        throw err;
      }
      // Falla de red -> procede al flujo optimista offline
    }
  }

  // Flujo Optimista Offline-First
  const ahoraOffline = new Date().toISOString();
  const misionOptimista: MisionLocal = {
    ...misionBase,
    estado: 'EN_CURSO',
    fechaInicio: misionBase.fechaInicio || ahoraOffline,
    fechaLlegada: ahoraOffline,
    sincronizacionPendiente: true,
    datosAdicionales: {
      ...(misionBase.datosAdicionales || {}),
      hitoLlegada: 'Llegada a terreno reportada (Pendiente de sincronizar)',
    },
    actualizadoEn: ahoraOffline,
  };

  await guardarMisionLocal(misionOptimista);
  await encolarAccionOutbox({
    tipo: 'REPORTAR_LLEGADA',
    url: `/api/misiones/${misionId}/llegada`,
    metodo: 'POST',
    payload: payload as unknown as Record<string, unknown>,
  });

  return {
    mision: misionOptimista,
    enColaOffline: true,
    mensaje:
      'Sin conexión: Llegada registrada localmente. Se sincronizará automáticamente al recuperar cobertura celular.',
  };
}

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
