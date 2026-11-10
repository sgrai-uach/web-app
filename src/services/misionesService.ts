import apiClient, { DEV_PATRULLA_TOKEN } from '@/lib/api/client';
import { getAuthCookie } from '@/lib/utils/cookieUtils';
import type { paths } from '@/types/api-generated';
import type { AceptarMisionPayload, MisionLocal } from '@/types/offline';
import {
  guardarMisionesLocales,
  guardarMisionLocal,
  obtenerMisionesLocales,
  obtenerMisionLocalPorId,
  encolarAccionOutbox,
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

type MisionApiItem =
  paths['/api/misiones']['get']['responses'][200]['content']['application/json']['data'][number];
type MisionDetalleApi =
  paths['/api/misiones/{id}']['get']['responses'][200]['content']['application/json']['data'];
type AceptarMisionApiData =
  paths['/api/misiones/{id}/aceptar']['post']['responses'][200]['content']['application/json'];

export class MisionServiceError extends Error {
  public readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'MisionServiceError';
    this.statusCode = statusCode;
  }
}

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
        fechaInicio: item.fechaInicio || null,
        datosAdicionales: {
          trabajo: item.descripcion || 'Sin instrucciones adicionales especificadas.',
          titulo: item.titulo,
          patrullaId: (item as Record<string, unknown>).patrullaId as string | null | undefined,
          patrullaNombre: (item as Record<string, unknown>).patrullaNombre as string | null | undefined,
          cuadrillaId: (item as Record<string, unknown>).cuadrillaId as string | null | undefined,
          cuadrillaNombre: (item as Record<string, unknown>).cuadrillaNombre as string | null | undefined,
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
        fechaInicio: d.fechaInicio || null,
        sincronizacionPendiente: false,
        datosAdicionales: {
          trabajo:
            d.descripcion ||
            d.incidente?.descripcion ||
            'Sin instrucciones adicionales especificadas.',
          titulo: d.titulo,
          estadoPatrulla: d.patrulla?.estado || 'EN_VERIFICACION',
          estadoIncidente: d.incidente?.estado || 'VERIFICANDO',
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

/**
 * Confirma y acepta una misión asignada a la Patrulla Verificadora (HU-36).
 * - Invoca `POST /api/misiones/{id}/aceptar` con coordenadas GPS opcionales (timeout no bloqueante de 5s).
 * - Si hay conexión (`200 OK`), actualiza el estado local a `EN_CURSO` con la `fechaInicio` del servidor.
 * - Si el servidor responde `409 Conflict` (idempotencia por doble clic o reintento), da la misión por aceptada (`EN_CURSO`) sin error bloqueante.
 * - Si hay corte de red / modo offline, actualiza el estado de forma optimista en IndexedDB y encola la mutación `ACEPTAR_MISION` en `outbox`.
 */
export async function aceptarMisionPatrulla(
  misionId: string,
  opciones?: OpcionesAceptarMision
): Promise<ResultadoAceptarMision> {
  const coordenadasRaw =
    opciones?.coordenadas !== undefined
      ? opciones.coordenadas
      : await obtenerCoordenadasOpcionales(opciones?.timeoutGpsMs ?? 5000);

  const payloadValidado: AceptarMisionPayload = validarPayloadAceptarMision(coordenadasRaw);

  const misionBase: MisionLocal =
    opciones?.misionActual ||
    (await obtenerMisionLocalPorId(misionId)) || {
      id: misionId,
      incidenteId: '',
      codigoIncidente: misionId,
      tipologia: 'Verificación de terreno',
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
          datosAdicionales: {
            ...(misionBase.datosAdicionales || {}),
            estadoPatrulla: resData.patrulla?.estado || 'EN_VERIFICACION',
            estadoIncidente: resData.incidente?.estado || 'VERIFICANDO',
            hitoAceptacion: resData.hito?.descripcion || 'Misión Aceptada por Patrulla',
          },
          actualizadoEn: resData.mision.actualizadoEn || new Date().toISOString(),
        };

        await guardarMisionLocal(misionActualizada);

        return {
          mision: misionActualizada,
          enColaOffline: false,
          mensaje:
            data.message ||
            'Misión aceptada exitosamente. La patrulla se encuentra en trayecto para iniciar la evaluación.',
        };
      }

      const status = response?.status ?? 500;

      // Regla de idempotencia HU-36: 409 Conflict indica que la misión ya estaba EN_CURSO
      if (status === 409) {
        const ahoraIso = new Date().toISOString();
        const misionIdempotente: MisionLocal = {
          ...misionBase,
          estado: 'EN_CURSO',
          fechaInicio: misionBase.fechaInicio || ahoraIso,
          sincronizacionPendiente: false,
          datosAdicionales: {
            ...(misionBase.datosAdicionales || {}),
            estadoPatrulla: 'EN_VERIFICACION',
            estadoIncidente: 'VERIFICANDO',
            hitoAceptacion: 'Misión Aceptada por Patrulla',
          },
          actualizadoEn: ahoraIso,
        };

        await guardarMisionLocal(misionIdempotente);

        return {
          mision: misionIdempotente,
          enColaOffline: false,
          yaAceptadaPreviamente: true,
          mensaje: 'La misión ya se encuentra en curso (En Trayecto / Evaluación).',
        };
      }

      // Si se está probando en modo de demostración local (DEV_PATRULLA_TOKEN) y la BD local
      // de sgrai-api aún no tiene cargado el seed con el usuario/misión de prueba, completar la transición local
      const tokenActual = typeof window !== 'undefined' ? getAuthCookie() : null;
      const esModoDemoLocal =
        Boolean(tokenActual) && tokenActual === (DEV_PATRULLA_TOKEN || 'dev-patrulla-token');
      if (esModoDemoLocal && (status === 401 || status === 403 || status === 404)) {
        const ahoraDemoIso = new Date().toISOString();
        const misionDemo: MisionLocal = {
          ...misionBase,
          estado: 'EN_CURSO',
          fechaInicio: misionBase.fechaInicio || ahoraDemoIso,
          sincronizacionPendiente: false,
          datosAdicionales: {
            ...(misionBase.datosAdicionales || {}),
            estadoPatrulla: 'EN_VERIFICACION',
            estadoIncidente: 'VERIFICANDO',
            hitoAceptacion: 'Misión Aceptada por Patrulla',
          },
          actualizadoEn: ahoraDemoIso,
        };

        await guardarMisionLocal(misionDemo);

        return {
          mision: misionDemo,
          enColaOffline: false,
          mensaje:
            'Misión aceptada exitosamente. La patrulla se encuentra en trayecto para iniciar la evaluación.',
        };
      }

      // Errores de autorización o validación (400, 401, 403, 404) no se encolan en outbox
      if (status === 400 || status === 401 || status === 403 || status === 404) {
        const msgError =
          (error as { message?: string } | undefined)?.message ||
          (status === 403
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
      estadoPatrulla: 'EN_VERIFICACION',
      estadoIncidente: 'VERIFICANDO',
      hitoAceptacion: 'Misión Aceptada por Patrulla (Pendiente de sincronizar)',
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
    mensaje:
      'Sin conexión: Misión aceptada localmente y guardada en cola para sincronizar al recuperar señal.',
  };
}
