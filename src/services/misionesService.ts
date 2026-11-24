import apiClient from '@/lib/api/client';
import type { paths } from '@/types/api-generated';
import type {
  AceptarMisionPayload,
  AdjuntoLocal,
  MisionLocal,
  RechazarMisionPayload,
  ReportarLlegadaPayload,
  ReportarLlegadaResponseData,
} from '@/types/offline';
import { rechazoMisionSchema, type RechazoMisionInput } from '@/lib/validations/misiones';
import {
  guardarMisionesLocales,
  guardarMisionLocal,
  limpiarMisionesLocales,
  obtenerMisionesLocales,
  obtenerMisionLocalPorId,
  encolarAccionOutbox,
  obtenerEvaluacionMisionCache,
  fusionarDatosAdicionalesMision,
} from '@/services/offlineQueue';
import { limpiarTituloMision, formatearTipologia } from '@/lib/utils/formatters';
import { getAuthCookie } from '@/lib/utils/cookieUtils';

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

function solicitarPosicion(options: PositionOptions): Promise<CoordenadasGps> {
  return new Promise<CoordenadasGps>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitud: pos.coords.latitude,
          longitud: pos.coords.longitude,
        });
      },
      (error) => {
        reject(error);
      },
      options
    );
  });
}

function mapearErrorGeolocalizacion(error: unknown): GeolocationError {
  const geoErr = error as Partial<GeolocationPositionError> | null | undefined;
  switch (geoErr?.code) {
    case 1: // PERMISSION_DENIED
      return new GeolocationError(
        'PERMISO_DENEGADO',
        'Permiso de ubicación denegado. Active los permisos de GPS en su navegador.'
      );
    case 2: // POSITION_UNAVAILABLE
      return new GeolocationError(
        'POSICION_NO_DISPONIBLE',
        'Señal satelital no disponible. Verifique que la ubicación de su dispositivo esté activada.'
      );
    case 3: // TIMEOUT
      return new GeolocationError(
        'TIMEOUT',
        'Tiempo de espera agotado al obtener señal GPS. Intente a cielo abierto o use la ubicación de la misión.'
      );
    default:
      return new GeolocationError(
        'DESCONOCIDO',
        'No fue posible obtener las coordenadas GPS del dispositivo.'
      );
  }
}

/**
 * Solicita las coordenadas GPS mediante la Geolocation API del navegador.
 * Intenta primero alta precisión (con caché reciente de hasta 15s) y, ante TIMEOUT o
 * POSITION_UNAVAILABLE en arranque en frío, realiza fallback automático a precisión estándar (red/Wi-Fi).
 */
export async function obtenerCoordenadasGps(timeoutMs = 8000): Promise<CoordenadasGps> {
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

  try {
    return await solicitarPosicion({
      enableHighAccuracy: true,
      timeout: timeoutMs,
      maximumAge: 15000,
    });
  } catch (error) {
    const geoErr = error as Partial<GeolocationPositionError> | null | undefined;
    // Solo hacer fallback si falló por TIMEOUT (3) o POSITION_UNAVAILABLE (2); nunca si el usuario denegó permiso (1)
    if (geoErr?.code === 2 || geoErr?.code === 3) {
      try {
        return await solicitarPosicion({
          enableHighAccuracy: false,
          timeout: 6000,
          maximumAge: 60000,
        });
      } catch (fallbackError) {
        throw mapearErrorGeolocalizacion(fallbackError);
      }
    }
    throw mapearErrorGeolocalizacion(error);
  }
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
        } as never,
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
        const msgConflict = (error as { message?: string } | undefined)?.message || '';
        if (/CANCELADA|RECHAZADA|CERRADA|FINALIZADA/i.test(msgConflict)) {
          try {
            await obtenerDetalleMision(misionId);
          } catch {
            // Ignorar fallo secundario al sincronizar estado real
          }
          throw new MisionServiceError(
            409,
            msgConflict || 'La misión se encuentra en un estado incompatible para reportar llegada.'
          );
        }

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

type MisionApiItem =
  paths['/api/misiones']['get']['responses'][200]['content']['application/json']['data'][number];
type MisionDetalleApi =
  paths['/api/misiones/{id}']['get']['responses'][200]['content']['application/json']['data'];
type AceptarMisionApiData =
  paths['/api/misiones/{id}/aceptar']['post']['responses'][200]['content']['application/json'];

export interface ResultadoAceptarMision {
  mision: MisionLocal;
  enColaOffline: boolean;
  yaAceptadaPreviamente?: boolean;
  mensaje: string;
}

export interface OpcionesAceptarMision {
  coordenadas?: AceptarMisionPayload;
  misionActual?: MisionLocal;
  timeoutGpsMs?: number;
  tipoUnidad?: 'patrulla' | 'cuadrilla';
}

/**
 * Valida que el payload de aceptación de misión cumpla estrictamente con el contrato OpenAPI
 * generado antes de enviarse o guardarse en la cola local IndexedDB (GEMINI.md §5.3).
 */
export function validarPayloadAceptarMision(
  coordenadas?: AceptarMisionPayload | null
): AceptarMisionPayload {
  const payload: AceptarMisionPayload = {};
  if (
    coordenadas &&
    typeof coordenadas.latitud === 'number' &&
    Number.isFinite(coordenadas.latitud) &&
    coordenadas.latitud >= -90 &&
    coordenadas.latitud <= 90 &&
    typeof coordenadas.longitud === 'number' &&
    Number.isFinite(coordenadas.longitud) &&
    coordenadas.longitud >= -180 &&
    coordenadas.longitud <= 180
  ) {
    payload.latitud = coordenadas.latitud;
    payload.longitud = coordenadas.longitud;
  }
  return payload;
}

/**
 * Obtiene las coordenadas GPS del dispositivo móvil de forma no bloqueante.
 * Si el navegador demora más de `timeoutMs` (por defecto 5000 ms) o no cuenta con permisos,
 * resuelve un objeto vacío `{}` para no retrasar la confirmación de salida de la patrulla.
 */
export async function obtenerCoordenadasOpcionales(
  timeoutMs = 5000
): Promise<AceptarMisionPayload> {
  if (
    typeof window === 'undefined' ||
    typeof navigator === 'undefined' ||
    !navigator.geolocation ||
    typeof navigator.geolocation.getCurrentPosition !== 'function'
  ) {
    return {};
  }

  return new Promise<AceptarMisionPayload>((resolve) => {
    let resuelto = false;
    const finalizar = (coords: AceptarMisionPayload) => {
      if (!resuelto) {
        resuelto = true;
        resolve(validarPayloadAceptarMision(coords));
      }
    };

    const timer = setTimeout(() => {
      finalizar({});
    }, timeoutMs);

    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timer);
          finalizar({
            latitud: pos.coords.latitude,
            longitud: pos.coords.longitude,
          });
        },
        () => {
          clearTimeout(timer);
          finalizar({});
        },
        {
          enableHighAccuracy: true,
          timeout: timeoutMs,
          maximumAge: 30000,
        }
      );
    } catch {
      clearTimeout(timer);
      finalizar({});
    }
  });
}

function leerCacheEvaluacionSegura(
  misionId: string
): Record<string, unknown> | undefined {
  return typeof obtenerEvaluacionMisionCache === 'function'
    ? obtenerEvaluacionMisionCache(misionId)
    : undefined;
}

function normalizarEvaluadorHito(
  raw: unknown
): { id?: string; nombre: string; email?: string; rut?: string | null } | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  const nombre = typeof obj.nombre === 'string' ? obj.nombre.trim() : '';
  if (!nombre) return undefined;
  return {
    id: typeof obj.id === 'string' ? obj.id : undefined,
    nombre,
    email: typeof obj.email === 'string' ? obj.email : undefined,
    rut: typeof obj.rut === 'string' ? obj.rut : null,
  };
}

function resolverEsReclasificacionHito(
  ultimoHitoTipologia: { hito?: string } | undefined,
  metadatosHito: Record<string, unknown> | null | undefined,
  datosPrevios: Record<string, unknown>
): boolean {
  if (typeof metadatosHito?.esReclasificacion === 'boolean') {
    return metadatosHito.esReclasificacion;
  }
  const tipoAnteriorId = metadatosHito?.tipoAnteriorId;
  const tipoNuevoId = metadatosHito?.tipoNuevoId;
  if (typeof tipoAnteriorId === 'string' && typeof tipoNuevoId === 'string') {
    return tipoAnteriorId !== tipoNuevoId;
  }
  const tipoAnterior = metadatosHito?.tipoAnterior;
  const tipoNuevo = metadatosHito?.tipoNuevo;
  if (typeof tipoAnterior === 'string' && typeof tipoNuevo === 'string') {
    return tipoAnterior.trim().toLowerCase() !== tipoNuevo.trim().toLowerCase();
  }
  if (ultimoHitoTipologia?.hito === 'TIPOLOGIA_CONFIRMADA') {
    return false;
  }
  if (typeof datosPrevios.esReclasificacion === 'boolean') {
    return datosPrevios.esReclasificacion;
  }
  return ultimoHitoTipologia?.hito === 'TIPOLOGIA_RECLASIFICADA';
}

/**
 * Consulta y sincroniza el listado de misiones asignadas desde el backend SGRAI.
 * Si hay conectividad, actualiza el almacenamiento local IndexedDB (Offline-First).
 * Si ocurre una falla de red o se está offline, devuelve las misiones persistidas localmente.
 */
export async function sincronizarMisiones(filtros?: FiltrosMisiones): Promise<MisionLocal[]> {
  try {
    const token = typeof window !== 'undefined' ? getAuthCookie() : null;
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
          authorization: token ? (token.startsWith('Bearer ') ? token : `Bearer ${token}`) : '',
        },
      },
    });

    if (!error && data && Array.isArray(data.data)) {
      let localesPreviasMap = new Map<string, MisionLocal>();
      try {
        const previas = (await obtenerMisionesLocales()) || [];
        localesPreviasMap = new Map(previas.map((m) => [m.id, m]));
      } catch {
        // Ignorar si IndexedDB no está disponible
      }

      const remotas: MisionLocal[] = data.data.map((item: MisionApiItem) => {
        const previa = localesPreviasMap.get(item.id);
        const estadoItemStr = String(item.estado);
        const mantenerOptimista = Boolean(
          previa?.sincronizacionPendiente &&
            (estadoItemStr === 'DESPACHADA' ||
              (previa.estado === 'COMPLETADA' &&
                (estadoItemStr === 'EN_CURSO' ||
                  estadoItemStr === 'EN_TERRENO' ||
                  estadoItemStr === 'DESPACHADA')))
        );
        const cachePrevia = leerCacheEvaluacionSegura(item.id);
        const datosPrevios: Record<string, unknown> = {
          ...(cachePrevia || {}),
          ...(previa?.datosAdicionales || {}),
        };
        const tipoAfectacionRemoto = (
          item as { incidenteTipoAfectacion?: string | null }
        ).incidenteTipoAfectacion;

        const tipologiaRemota = tipoAfectacionRemoto
          ? formatearTipologia(tipoAfectacionRemoto)
          : limpiarTituloMision(item.titulo);

        const tipologiaConstatadaPrevia =
          typeof datosPrevios.tipologiaConstatada === 'string'
            ? datosPrevios.tipologiaConstatada
            : undefined;

        const tipologiaFinal =
          previa?.sincronizacionPendiente &&
          datosPrevios.tipologiaEvaluada === true &&
          tipologiaConstatadaPrevia
            ? tipologiaConstatadaPrevia
            : tipologiaRemota || tipologiaConstatadaPrevia || limpiarTituloMision(item.titulo);

        return {
          id: item.id,
          incidenteId: item.incidenteId || '',
          codigoIncidente: item.incidenteCodigo || item.codigo,
          tipologia: tipologiaFinal,
          direccion:
            item.descripcion ||
            (item.delegacionNombre ? `Sector ${item.delegacionNombre}` : 'Valdivia'),
          prioridad: item.prioridad,
          estado: mantenerOptimista && previa ? previa.estado : item.estado,
          fechaDespacho: item.fechaInicio || item.creadoEn,
          fechaInicio:
            mantenerOptimista && previa ? previa.fechaInicio : item.fechaInicio || null,
          fechaLlegada:
            mantenerOptimista && previa
              ? previa.fechaLlegada ?? null
              : item.estado === 'EN_CURSO'
                ? previa?.fechaLlegada ?? null
                : null,
          sincronizacionPendiente: mantenerOptimista
            ? true
            : Boolean(previa?.sincronizacionPendiente),
          datosAdicionales: {
            ...datosPrevios,
            trabajo: item.descripcion || 'Sin instrucciones adicionales especificadas.',
            titulo: item.titulo,
            tipoMision: item.tipoMision,
            patrullaId: (item as Record<string, unknown>).patrullaId as string | null | undefined,
            patrullaNombre: (item as Record<string, unknown>).patrullaNombre as string | null | undefined,
            cuadrillaId: (item as Record<string, unknown>).cuadrillaId as string | null | undefined,
            cuadrillaNombre: (item as Record<string, unknown>).cuadrillaNombre as string | null | undefined,
          },
          actualizadoEn: item.actualizadoEn,
        };
      });

      await limpiarMisionesLocales();
      if (remotas.length > 0) {
        await guardarMisionesLocales(remotas);
      }
      return remotas;
    }
  } catch {
    // Modo sin conexión o falla de red: continuar con almacenamiento local
  }

  return (await obtenerMisionesLocales()) || [];
}

/**
 * Consulta el detalle completo de una misión operativa.
 * Si hay conexión, consulta la API remota y refresca el almacenamiento local IndexedDB.
 * Si está offline o la consulta remota es rechazada, retorna la misión almacenada localmente
 * fusionada con el caché de evaluaciones de la patrulla.
 */
export async function obtenerDetalleMision(id: string): Promise<MisionLocal | null> {
  let previaLocal: MisionLocal | undefined;
  try {
    previaLocal = await obtenerMisionLocalPorId(id);
  } catch {
    previaLocal = undefined;
  }

  const cachePrevia = leerCacheEvaluacionSegura(id);
  const datosPrevios: Record<string, unknown> = {
    ...(cachePrevia || {}),
    ...(previaLocal?.datosAdicionales || {}),
  };

  try {
    const { data, error } = await apiClient.GET('/api/misiones/{id}', {
      params: {
        path: { id },
      },
    });

    if (!error && data && data.data) {
      const d: MisionDetalleApi = data.data;
      const estadoRemotoStr = String(d.estado);
      const mantenerOptimista = Boolean(
        previaLocal?.sincronizacionPendiente &&
          (estadoRemotoStr === 'DESPACHADA' ||
            (previaLocal.estado === 'COMPLETADA' &&
              (estadoRemotoStr === 'EN_CURSO' ||
                estadoRemotoStr === 'EN_TERRENO' ||
                estadoRemotoStr === 'DESPACHADA')))
      );

      const hitoLlegadaRemoto = Array.isArray(d.bitacoraTiempos)
        ? d.bitacoraTiempos.find((h) => h.hito === 'LLEGADA_TERRENO')
        : undefined;

      const adjuntosEnReportes: AdjuntoLocal[] = Array.isArray(d.reportesTerreno)
        ? d.reportesTerreno.flatMap((rep) =>
            Array.isArray(rep.adjuntos)
              ? rep.adjuntos.map((adj) => ({
                  id: adj.id,
                  nombreArchivo: adj.nombreArchivo,
                  url: adj.url,
                  tipoMime: adj.tipoMime,
                  tamanoBytes: adj.tamanoBytes,
                  creadoEn: adj.creadoEn,
                  sincronizacionPendiente: false,
                }))
              : []
          )
        : [];

      const adjuntosRaizMision: AdjuntoLocal[] = Array.isArray(
        (d as { adjuntos?: unknown }).adjuntos
      )
        ? (
            (d as {
              adjuntos: Array<{
                id: string;
                nombreArchivo: string;
                url: string;
                tipoMime: string;
                tamanoBytes: number;
                creadoEn: string;
              }>;
            }).adjuntos || []
          ).map((adj) => ({
            id: adj.id,
            nombreArchivo: adj.nombreArchivo,
            url: adj.url,
            tipoMime: adj.tipoMime,
            tamanoBytes: adj.tamanoBytes,
            creadoEn: adj.creadoEn,
            sincronizacionPendiente: false,
          }))
        : [];

      const idsAdjuntosRemotos = new Set<string>();
      const adjuntosRemotos: AdjuntoLocal[] = [];
      for (const adj of [...adjuntosEnReportes, ...adjuntosRaizMision]) {
        if (adj.id && !idsAdjuntosRemotos.has(adj.id)) {
          idsAdjuntosRemotos.add(adj.id);
          adjuntosRemotos.push(adj);
        }
      }

      const adjuntosPrevios = Array.isArray(previaLocal?.datosAdicionales?.adjuntos)
        ? (previaLocal.datosAdicionales.adjuntos as AdjuntoLocal[])
        : [];
      const adjuntosPendientesLocales = adjuntosPrevios.filter(
        (item) => item.sincronizacionPendiente
      );

      const adjuntosCombinados = [
        ...adjuntosPendientesLocales,
        ...adjuntosRemotos.filter(
          (rem) => !adjuntosPendientesLocales.some((loc) => loc.id === rem.id)
        ),
      ];

      const reportesRemotos = Array.isArray(d.reportesTerreno) ? d.reportesTerreno : [];
      const reportesPrioridadRemotos = reportesRemotos.filter(
        (r) => !r.tipoReporte || r.tipoReporte === 'EVALUACION_PRIORIDAD'
      );
      const reportesCierreRemotos = reportesRemotos.filter(
        (r) => r.tipoReporte === 'VERIFICACION_CIERRE'
      );
      const bitacoraRemota = Array.isArray(d.bitacoraTiempos) ? d.bitacoraTiempos : [];
      const evalRemota = d.evaluaciones;

      const hitosTipologia = bitacoraRemota.filter(
        (h) => h.hito === 'TIPOLOGIA_RECLASIFICADA' || h.hito === 'TIPOLOGIA_CONFIRMADA'
      );
      const ultimoHitoTipologia =
        hitosTipologia.length > 0 ? hitosTipologia[hitosTipologia.length - 1] : undefined;

      const metadatosHito = (
        ultimoHitoTipologia as { metadatos?: Record<string, unknown> | null } | undefined
      )?.metadatos;

      const justificacionDesdeHito =
        typeof metadatosHito?.justificacion === 'string'
          ? metadatosHito.justificacion
          : ultimoHitoTipologia?.hito === 'TIPOLOGIA_RECLASIFICADA' &&
              typeof ultimoHitoTipologia.descripcion === 'string' &&
              ultimoHitoTipologia.descripcion.includes('Justificación:')
            ? ultimoHitoTipologia.descripcion.split('Justificación:')[1]?.trim() || undefined
            : undefined;

      const evaluadorDesdeHito =
        normalizarEvaluadorHito(metadatosHito?.evaluador) ??
        normalizarEvaluadorHito(
          (ultimoHitoTipologia as { registradoPor?: unknown } | undefined)?.registradoPor
        ) ??
        normalizarEvaluadorHito(datosPrevios.evaluadorTipologia);

      const fechaEvaluacionTipologia =
        evalRemota?.tipologiaEvaluadaEn ??
        ultimoHitoTipologia?.timestamp ??
        (typeof datosPrevios.fechaEvaluacionTipologia === 'string'
          ? datosPrevios.fechaEvaluacionTipologia
          : undefined);

      const tipologiaEvaluada =
        Boolean(datosPrevios.tipologiaEvaluada) ||
        Boolean(evalRemota?.tipologiaEvaluada) ||
        hitosTipologia.length > 0;

      const esReclasificacion = resolverEsReclasificacionHito(
        ultimoHitoTipologia,
        metadatosHito,
        datosPrevios
      );

      const reportesPrioridadLocales = Array.isArray(datosPrevios.reportesPrioridad)
        ? (
            datosPrevios.reportesPrioridad as Array<{
              sincronizado?: boolean;
            }>
          )
        : [];

      const reportesPrioridadLocalesPendientes = reportesPrioridadLocales.filter(
        (r) => r && r.sincronizado === false
      );

      const prioridadEvaluada =
        Boolean(datosPrevios.prioridadEvaluada) ||
        Boolean(evalRemota?.prioridadEvaluada) ||
        reportesPrioridadRemotos.length > 0 ||
        reportesPrioridadLocales.length > 0;

      const versionReportePrioridad =
        evalRemota?.versionReportePrioridad ??
        (typeof datosPrevios.versionReportePrioridad === 'number'
          ? datosPrevios.versionReportePrioridad
          : reportesPrioridadRemotos.length > 0
            ? reportesPrioridadRemotos.length
            : reportesPrioridadLocales.length > 0
              ? reportesPrioridadLocales.length
              : undefined);

      const ultimoReporteCierreRemoto = reportesCierreRemotos[reportesCierreRemotos.length - 1];
      const reporteVerificacionEnviado =
        Boolean(evalRemota?.reporteVerificacionEnviado) ||
        reportesCierreRemotos.length > 0 ||
        Boolean(datosPrevios.reporteVerificacionEnviado);

      const reportesCuadrillaRemotos = reportesRemotos.filter(
        (r) => r.tipoReporte === 'REPORTE_CUADRILLA'
      );
      const ultimoReporteCuadrillaRemoto =
        reportesCuadrillaRemotos[reportesCuadrillaRemotos.length - 1];
      const reporteCuadrillaEnviado =
        Boolean(evalRemota?.reporteCuadrillaEnviado) ||
        reportesCuadrillaRemotos.length > 0 ||
        Boolean(datosPrevios.reporteCuadrillaEnviado);

      const cuadrillaRecursosMapeados = Array.isArray(d.cuadrilla?.recursos)
        ? d.cuadrilla.recursos.map((r) => ({
            id: r.id,
            nombre: r.nombre,
            tipo: r.tipo,
            cantidadAsignada: Number(r.cantidadAsignada ?? 0),
            ...(r.esIndividual !== undefined ? { esIndividual: Boolean(r.esIndividual) } : {}),
            ...(r.unidad !== undefined ? { unidad: r.unidad ?? null } : {}),
          }))
        : Array.isArray(datosPrevios.cuadrillaRecursos)
          ? datosPrevios.cuadrillaRecursos
          : undefined;

      const datosBaseMision = {
        ...datosPrevios,
        trabajo:
          d.descripcion ||
          d.incidente?.descripcion ||
          'Sin instrucciones adicionales especificadas.',
        titulo: d.titulo,
        tipoMision: d.tipoMision,
        ...(!d.cuadrilla && d.tipoMision !== 'ATENCION_CUADRILLA'
          ? { estadoPatrulla: d.patrulla?.estado || 'EN_VERIFICACION' }
          : d.patrulla?.estado
            ? { estadoPatrulla: d.patrulla.estado }
            : {}),
        ...(d.cuadrilla?.estado ? { estadoCuadrilla: d.cuadrilla.estado } : {}),
        ...(cuadrillaRecursosMapeados !== undefined
          ? { cuadrillaRecursos: cuadrillaRecursosMapeados }
          : {}),
        fechaCierre:
          d.fechaCierre ??
          (datosPrevios.fechaCierre as string | null | undefined) ??
          null,
        estadoIncidente:
          d.incidente?.estado ||
          (d.cuadrilla || d.tipoMision === 'ATENCION_CUADRILLA'
            ? 'EN_ATENCION'
            : 'VERIFICANDO'),
        ...(hitoLlegadaRemoto ? { hitoLlegada: hitoLlegadaRemoto.descripcion } : {}),
        reporteTerrenoId:
          ultimoReporteCuadrillaRemoto?.id ??
          ultimoReporteCierreRemoto?.id ??
          (reportesRemotos.length > 0 ? reportesRemotos[0].id : undefined),
        adjuntos: adjuntosCombinados,
        reportesTerreno: reportesRemotos,
        ...(reportesPrioridadRemotos.length > 0
          ? { reportesPrioridad: reportesPrioridadLocalesPendientes }
          : reportesPrioridadLocales.length > 0
            ? { reportesPrioridad: reportesPrioridadLocales }
            : {}),
        tipologiaEvaluada,
        esReclasificacion,
        ...(evaluadorDesdeHito ? { evaluadorTipologia: evaluadorDesdeHito } : {}),
        ...(fechaEvaluacionTipologia ? { fechaEvaluacionTipologia } : {}),
        justificacionTipologia:
          justificacionDesdeHito ??
          (typeof datosPrevios.justificacionTipologia === 'string'
            ? datosPrevios.justificacionTipologia
            : undefined),
        prioridadEvaluada,
        ...(versionReportePrioridad !== undefined ? { versionReportePrioridad } : {}),
        ...(typeof evalRemota?.personasAfectadasPrevias === 'number'
          ? { personasAfectadasPrevias: evalRemota.personasAfectadasPrevias }
          : {}),
        reporteVerificacionEnviado,
        reporteVerificacionEnviadoEn:
          evalRemota?.reporteVerificacionEnviadoEn ??
          ultimoReporteCierreRemoto?.creadoEn ??
          (datosPrevios.reporteVerificacionEnviadoEn as string | null | undefined) ??
          null,
        dictamenVerificacion:
          evalRemota?.dictamenVerificacion ??
          ultimoReporteCierreRemoto?.dictamen ??
          (datosPrevios.dictamenVerificacion as string | null | undefined) ??
          null,
        reporteCuadrillaEnviado,
        reporteCuadrillaEnviadoEn:
          evalRemota?.reporteCuadrillaEnviadoEn ??
          ultimoReporteCuadrillaRemoto?.creadoEn ??
          (datosPrevios.reporteCuadrillaEnviadoEn as string | null | undefined) ??
          null,
      };

      const fechaLlegadaResuelta =
        hitoLlegadaRemoto?.timestamp ??
        (mantenerOptimista || d.estado === 'EN_CURSO' ? previaLocal?.fechaLlegada ?? null : null);

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
        estado: mantenerOptimista && previaLocal ? previaLocal.estado : d.estado,
        fechaDespacho: d.fechaInicio || d.creadoEn,
        fechaInicio:
          mantenerOptimista && previaLocal ? previaLocal.fechaInicio : d.fechaInicio || null,
        fechaLlegada: fechaLlegadaResuelta,
        sincronizacionPendiente: mantenerOptimista,
        bitacoraTiempos: bitacoraRemota.map((h) => {
          const hExtra = h as {
            id?: string;
            codigoHito?: string;
            latitud?: number | null;
            longitud?: number | null;
            registradoPorNombre?: string | null;
            registradoPor?: { nombre?: string | null } | null;
          };
          return {
            ...(hExtra.id ? { id: hExtra.id } : {}),
            hito: h.hito,
            ...(hExtra.codigoHito ? { codigoHito: hExtra.codigoHito } : {}),
            ...(h.descripcion ? { descripcion: h.descripcion } : {}),
            fecha: h.fecha,
            hora: h.hora,
            ...(h.timestamp ? { timestamp: h.timestamp } : {}),
            ...(typeof hExtra.latitud === 'number' ? { latitud: hExtra.latitud } : {}),
            ...(typeof hExtra.longitud === 'number' ? { longitud: hExtra.longitud } : {}),
            ...(hExtra.registradoPorNombre || hExtra.registradoPor?.nombre
              ? {
                  registradoPorNombre:
                    hExtra.registradoPorNombre ?? hExtra.registradoPor?.nombre ?? null,
                }
              : {}),
          };
        }),
        datosAdicionales:
          mantenerOptimista && previaLocal?.datosAdicionales
            ? { ...datosBaseMision, ...previaLocal.datosAdicionales }
            : datosBaseMision,
        actualizadoEn: d.actualizadoEn,
      };

      await guardarMisionLocal(misionLocal);
      return misionLocal;
    }
  } catch {
    // Continuar con búsqueda local si falla la red
  }

  const local = previaLocal ?? (await obtenerMisionLocalPorId(id));
  if (!local) return null;

  return typeof fusionarDatosAdicionalesMision === 'function'
    ? fusionarDatosAdicionalesMision(local, cachePrevia)
    : local;
}

export type RechazoMisionResultado = ResultadoRechazarMision;

/**
 * Confirma y acepta una misión asignada desde terreno (H36 Patrulla / H40 Cuadrilla).
 * - Invoca `POST /api/misiones/{id}/aceptar` con coordenadas GPS opcionales (timeout no bloqueante de 5s).
 * - Si hay conexión (`200 OK`), actualiza el estado local a `EN_CURSO` con la `fechaInicio` del servidor
 *   y los estados canónicos de patrulla o cuadrilla e incidente.
 * - Si el servidor responde `409 Conflict` con `/EN_CURSO/i` (idempotencia por doble clic o reintento),
 *   da la misión por aceptada (`EN_CURSO`) sin error bloqueante.
 * - Si hay corte de red / modo offline, actualiza el estado de forma optimista en IndexedDB y encola la mutación `ACEPTAR_MISION` en `outbox`.
 */
export async function aceptarMision(
  misionId: string,
  opciones?: OpcionesAceptarMision
): Promise<ResultadoAceptarMision> {
  const coordenadasRaw =
    opciones?.coordenadas !== undefined
      ? opciones.coordenadas
      : await obtenerCoordenadasOpcionales(opciones?.timeoutGpsMs ?? 5000);

  const payloadValidado: AceptarMisionPayload = validarPayloadAceptarMision(coordenadasRaw);

  const misionLocalPrevia = opciones?.misionActual || (await obtenerMisionLocalPorId(misionId));
  const esCuadrillaBase =
    opciones?.tipoUnidad === 'cuadrilla'
      ? true
      : opciones?.tipoUnidad === 'patrulla'
        ? false
        : (typeof misionLocalPrevia?.datosAdicionales?.tipoMision === 'string' &&
            misionLocalPrevia.datosAdicionales.tipoMision.toUpperCase() ===
              'ATENCION_CUADRILLA') ||
          Boolean(misionLocalPrevia?.datosAdicionales?.cuadrillaId);

  const misionBase: MisionLocal = misionLocalPrevia || {
    id: misionId,
    incidenteId: '',
    codigoIncidente: misionId,
    tipologia: esCuadrillaBase ? 'Atención de cuadrilla' : 'Verificación de terreno',
    direccion: 'Valdivia',
    prioridad: 'ALTA',
    estado: 'DESPACHADA',
    fechaDespacho: new Date().toISOString(),
    actualizadoEn: new Date().toISOString(),
  };

  const estaOffline =
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    navigator.onLine === false;

  if (!estaOffline) {
    try {
      const { data, error, response } = await apiClient.POST('/api/misiones/{id}/aceptar', {
        params: {
          path: { id: misionId },
        },
        body: payloadValidado,
      });

      if (!error && data && data.data) {
        const resData: AceptarMisionApiData['data'] = data.data;
        const esRespuestaCuadrilla =
          Boolean(resData.cuadrilla) ||
          resData.mision.tipoMision === 'ATENCION_CUADRILLA' ||
          esCuadrillaBase;

        const datosActualizados: Record<string, unknown> = {
          ...(misionBase.datosAdicionales || {}),
          ...(resData.mision.tipoMision ? { tipoMision: resData.mision.tipoMision } : {}),
          ...(esRespuestaCuadrilla
            ? {
                ...(resData.mision.cuadrillaId
                  ? { cuadrillaId: resData.mision.cuadrillaId }
                  : {}),
                estadoCuadrilla: resData.cuadrilla?.estado || 'EN_MISION',
                estadoIncidente: resData.incidente?.estado || 'EN_ATENCION',
                hitoAceptacion:
                  resData.hito?.descripcion || 'Asignación Aceptada por Cuadrilla',
              }
            : {
                estadoPatrulla: resData.patrulla?.estado || 'EN_VERIFICACION',
                estadoIncidente: resData.incidente?.estado || 'VERIFICANDO',
                hitoAceptacion:
                  resData.hito?.descripcion || 'Misión Aceptada por Patrulla',
              }),
        };

        const misionActualizada: MisionLocal = {
          ...misionBase,
          id: resData.mision.id || misionId,
          incidenteId: resData.mision.incidenteId || misionBase.incidenteId,
          codigoIncidente: resData.incidente?.codigo || misionBase.codigoIncidente,
          estado: resData.mision.estado || 'EN_CURSO',
          prioridad: resData.mision.prioridad || misionBase.prioridad,
          fechaDespacho: resData.mision.fechaInicio || misionBase.fechaDespacho,
          fechaInicio: resData.mision.fechaInicio,
          sincronizacionPendiente: false,
          datosAdicionales: datosActualizados,
          actualizadoEn: resData.mision.actualizadoEn || new Date().toISOString(),
        };

        await guardarMisionLocal(misionActualizada);

        return {
          mision: misionActualizada,
          enColaOffline: false,
          mensaje:
            data.message ||
            (esRespuestaCuadrilla
              ? 'Asignación de misión aceptada exitosamente. La cuadrilla inicia el desplazamiento y asume la atención del incidente.'
              : 'Misión aceptada exitosamente. La patrulla se encuentra en trayecto para iniciar la evaluación.'),
        };
      }

      const status = response?.status ?? 500;

      // Regla de idempotencia H36/H40: 409 Conflict indica que la misión ya estaba EN_CURSO
      // únicamente cuando el mensaje del servidor confirma dicho estado
      if (status === 409) {
        const msgConflict = (error as { message?: string } | undefined)?.message || '';
        if (!/EN_CURSO/i.test(msgConflict)) {
          try {
            await obtenerDetalleMision(misionId);
          } catch {
            // Ignorar fallo secundario al sincronizar estado real
          }
          throw new MisionServiceError(
            409,
            msgConflict ||
              'La misión no puede ser aceptada porque ya no se encuentra en estado DESPACHADA.'
          );
        }

        const ahoraIso = new Date().toISOString();
        const misionIdempotente: MisionLocal = {
          ...misionBase,
          estado: 'EN_CURSO',
          fechaInicio: misionBase.fechaInicio || ahoraIso,
          sincronizacionPendiente: false,
          datosAdicionales: {
            ...(misionBase.datosAdicionales || {}),
            ...(esCuadrillaBase
              ? {
                  estadoCuadrilla: 'EN_MISION',
                  estadoIncidente: 'EN_ATENCION',
                  hitoAceptacion: 'Asignación Aceptada por Cuadrilla',
                }
              : {
                  estadoPatrulla: 'EN_VERIFICACION',
                  estadoIncidente: 'VERIFICANDO',
                  hitoAceptacion: 'Misión Aceptada por Patrulla',
                }),
          },
          actualizadoEn: ahoraIso,
        };

        await guardarMisionLocal(misionIdempotente);

        return {
          mision: misionIdempotente,
          enColaOffline: false,
          yaAceptadaPreviamente: true,
          mensaje: esCuadrillaBase
            ? 'La asignación ya se encuentra en curso (Faena en Curso).'
            : 'La misión ya se encuentra en curso (En Trayecto / Evaluación).',
        };
      }

      // Errores de autorización o validación (400, 401, 403, 404, 422) no se encolan en outbox
      if (
        status === 400 ||
        status === 401 ||
        status === 403 ||
        status === 404 ||
        status === 422
      ) {
        const msgError =
          (error as { message?: string } | undefined)?.message ||
          (status === 401
            ? 'Sesión expirada o no autenticada.'
            : status === 403
              ? 'No cuenta con permisos para aceptar esta misión.'
              : status === 404
                ? 'La misión solicitada no fue encontrada.'
                : 'No fue posible procesar la aceptación de la misión.');
        throw new MisionServiceError(status, msgError);
      }
    } catch (err) {
      if (err instanceof MisionServiceError) {
        throw err;
      }
      // Si es falla de red / desconexión temporal, pasa al flujo optimista Offline-First
    }
  }

  // Flujo Optimista Offline-First: guardar en IndexedDB y encolar en outbox
  const ahoraOffline = new Date().toISOString();
  const misionOptimista: MisionLocal = {
    ...misionBase,
    estado: 'EN_CURSO',
    fechaInicio: misionBase.fechaInicio || ahoraOffline,
    sincronizacionPendiente: true,
    datosAdicionales: {
      ...(misionBase.datosAdicionales || {}),
      ...(esCuadrillaBase
        ? {
            estadoCuadrilla: 'EN_MISION',
            estadoIncidente: 'EN_ATENCION',
            hitoAceptacion:
              'Asignación Aceptada por Cuadrilla (Pendiente de sincronizar)',
          }
        : {
            estadoPatrulla: 'EN_VERIFICACION',
            estadoIncidente: 'VERIFICANDO',
            hitoAceptacion:
              'Misión Aceptada por Patrulla (Pendiente de sincronizar)',
          }),
    },
    actualizadoEn: ahoraOffline,
  };

  await guardarMisionLocal(misionOptimista);
  await encolarAccionOutbox({
    tipo: 'ACEPTAR_MISION',
    url: `/api/misiones/${misionId}/aceptar`,
    metodo: 'POST',
    payload: payloadValidado as Record<string, unknown>,
  });

  return {
    mision: misionOptimista,
    enColaOffline: true,
    mensaje: esCuadrillaBase
      ? 'Sin conexión: Asignación aceptada localmente y guardada en cola para sincronizar al recuperar señal.'
      : 'Sin conexión: Misión aceptada localmente y guardada en cola para sincronizar al recuperar señal.',
  };
}

/**
 * Alias retrocompatible para la confirmación de salida de Patrulla Verificadora (H36).
 */
export async function aceptarMisionPatrulla(
  misionId: string,
  opciones?: OpcionesAceptarMision
): Promise<ResultadoAceptarMision> {
  return aceptarMision(misionId, {
    ...opciones,
    tipoUnidad: opciones?.tipoUnidad ?? 'patrulla',
  });
}

type RechazarMisionApiData =
  paths['/api/misiones/{id}/rechazar']['post']['responses'][200]['content']['application/json'];

export interface ResultadoRechazarMision {
  exito: boolean;
  mensaje: string;
  modoOffline?: boolean;
  mision?: RechazarMisionApiData['data']['mision'] | {
    id: string;
    codigo: string;
    estado: string;
    justificacionRechazo: string;
  };
}

/**
 * Ejecuta el rechazo motivado de una misión asignada (H41 Cuadrilla / H69 Patrulla).
 * Valida la justificación (>= 5 chars) contra `rechazoMisionSchema` antes de enviar o encolar en IndexedDB.
 * Si no hay conexión o falla el transporte, encola en el outbox para sincronización automática.
 */
export async function rechazarMision(
  id: string,
  datos: RechazoMisionInput
): Promise<ResultadoRechazarMision> {
  const datosValidados = rechazoMisionSchema.parse(datos);

  const payloadApi: RechazarMisionPayload = {
    justificacion_rechazo: datosValidados.justificacion_rechazo,
    ...(datosValidados.latitud !== undefined && datosValidados.longitud !== undefined
      ? { latitud: datosValidados.latitud, longitud: datosValidados.longitud }
      : {}),
  };

  const estaOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  const persistirRechazoLocal = async (
    sincronizacionPendiente: boolean,
    actualizadoEn?: string
  ): Promise<MisionLocal | null> => {
    const local = await obtenerMisionLocalPorId(id);
    if (!local) return null;
    const actualizado: MisionLocal = {
      ...local,
      estado: 'RECHAZADA',
      sincronizacionPendiente,
      actualizadoEn: actualizadoEn || new Date().toISOString(),
      datosAdicionales: {
        ...local.datosAdicionales,
        justificacionRechazo: datosValidados.justificacion_rechazo,
      },
    };
    await guardarMisionLocal(actualizado);
    return actualizado;
  };

  if (estaOffline) {
    await encolarAccionOutbox({
      tipo: 'RECHAZAR_MISION',
      url: `/api/misiones/${id}/rechazar`,
      metodo: 'POST',
      payload: payloadApi as Record<string, unknown>,
    });

    const local = await persistirRechazoLocal(true);

    return {
      exito: true,
      mensaje:
        'Rechazo registrado localmente. Se sincronizará automáticamente al recuperar la conexión.',
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
      },
      body: payloadApi,
    });

    if (error || !response.ok) {
      const status = response?.status ?? 500;
      const errorMsg =
        (error as { message?: string } | undefined)?.message ||
        (status === 400
          ? 'Datos inválidos para el rechazo de la misión.'
          : status === 401
            ? 'Sesión expirada o no autenticada.'
            : status === 403
              ? 'No está autorizado para rechazar esta misión.'
              : status === 404
                ? 'La misión solicitada no fue encontrada.'
                : status === 409
                  ? 'La misión no se encuentra en estado DESPACHADA para ser rechazada.'
                  : `Error al rechazar la misión (${status}).`);
      throw new MisionServiceError(status, errorMsg);
    }

    await persistirRechazoLocal(false, data?.data?.mision?.actualizadoEn);

    return {
      exito: true,
      mensaje: data?.message || 'Misión rechazada exitosamente.',
      mision: data?.data?.mision,
    };
  } catch (err) {
    if (err instanceof MisionServiceError) {
      throw err;
    }

    // Falla de red / desconexión temporal: encolar en outbox
    await encolarAccionOutbox({
      tipo: 'RECHAZAR_MISION',
      url: `/api/misiones/${id}/rechazar`,
      metodo: 'POST',
      payload: payloadApi as Record<string, unknown>,
    });

    const local = await persistirRechazoLocal(true);

    return {
      exito: true,
      mensaje:
        'Rechazo registrado localmente. Se sincronizará automáticamente al recuperar la conexión.',
      modoOffline: true,
      mision: {
        id,
        codigo: local?.codigoIncidente || id,
        estado: 'RECHAZADA',
        justificacionRechazo: datosValidados.justificacion_rechazo,
      },
    };
  }
}
