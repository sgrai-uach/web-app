import apiClient from '@/lib/api/client';
import type { paths } from '@/types/api-generated';
import type { AceptarMisionPayload, MisionLocal } from '@/types/offline';
import {
  guardarMisionesLocales,
  guardarMisionLocal,
  obtenerMisionesLocales,
  obtenerMisionLocalPorId,
  obtenerAccionesOutbox,
  encolarAccionOutbox,
  obtenerEvaluacionMisionCache,
  fusionarDatosAdicionalesMision,
} from '@/services/offlineQueue';
import { limpiarTituloMision, formatearTipologia } from '@/lib/utils/formatters';
import { obtenerCatalogoTiposIncidente } from '@/services/tipologiaService';
import { getAuthCookie } from '@/lib/utils/cookieUtils';
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
 * Identifica las misiones e incidentes que mantienen mutaciones pendientes
 * (`ACEPTAR_MISION` o `ACTUALIZAR_TIPOLOGIA`) en la cola local `outbox` para
 * evitar sobreescribir su estado optimista al refrescar desde la API.
 */
async function obtenerReferenciasOutboxPendientes(): Promise<{
  misionesConOutbox: Set<string>;
  incidentesConOutbox: Set<string>;
}> {
  const misionesConOutbox = new Set<string>();
  const incidentesConOutbox = new Set<string>();

  try {
    if (typeof obtenerAccionesOutbox !== 'function') {
      return { misionesConOutbox, incidentesConOutbox };
    }

    const acciones = (await obtenerAccionesOutbox()) || [];
    for (const accion of acciones) {
      if (
        accion.tipo !== 'ACEPTAR_MISION' &&
        accion.tipo !== 'ACTUALIZAR_TIPOLOGIA'
      ) {
        continue;
      }

      const payloadMisionId = accion.payload?.misionId;
      if (typeof payloadMisionId === 'string' && payloadMisionId) {
        misionesConOutbox.add(payloadMisionId);
      }

      const matchMision = accion.url.match(/\/api\/misiones\/([^/]+)/);
      if (matchMision?.[1]) {
        misionesConOutbox.add(matchMision[1]);
      }

      const matchIncidente = accion.url.match(/\/api\/incidentes\/([^/]+)/);
      if (matchIncidente?.[1]) {
        incidentesConOutbox.add(matchIncidente[1]);
      }
    }
  } catch {
    // Ignorar fallos de lectura de outbox en entornos sin IndexedDB
  }

  return { misionesConOutbox, incidentesConOutbox };
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
      let localesPreviasRaw: MisionLocal[] = [];
      try {
        localesPreviasRaw = (await obtenerMisionesLocales()) || [];
      } catch {
        localesPreviasRaw = [];
      }
      const { misionesConOutbox, incidentesConOutbox } =
        await obtenerReferenciasOutboxPendientes();
      const localesPreviasMap = new Map(localesPreviasRaw.map((m) => [m.id, m]));

      const remotas: MisionLocal[] = data.data.map((item: MisionApiItem) => {
        const previa = localesPreviasMap.get(item.id);
        const incidenteId = item.incidenteId || '';
        const tieneOutboxPendiente =
          misionesConOutbox.has(item.id) ||
          (Boolean(incidenteId) && incidentesConOutbox.has(incidenteId));
        const estadoPermiteOptimista =
          item.estado === 'DESPACHADA' || item.estado === 'EN_CURSO';
        const mantenerOptimista = Boolean(
          previa &&
            (previa.sincronizacionPendiente || tieneOutboxPendiente) &&
            estadoPermiteOptimista
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
          mantenerOptimista && previa?.tipologia
            ? previa.tipologia
            : previa?.sincronizacionPendiente &&
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
          estado: mantenerOptimista && previa?.estado ? previa.estado : item.estado,
          fechaDespacho: item.fechaInicio || item.creadoEn,
          fechaInicio:
            mantenerOptimista && previa
              ? (previa.fechaInicio ?? item.fechaInicio ?? null)
              : item.fechaInicio || null,
          sincronizacionPendiente: mantenerOptimista
            ? true
            : Boolean(previa?.sincronizacionPendiente),
          datosAdicionales: {
            ...datosPrevios,
            trabajo: item.descripcion || 'Sin instrucciones adicionales especificadas.',
            titulo: item.titulo,
            patrullaId: (item as Record<string, unknown>).patrullaId as string | null | undefined,
            patrullaNombre: (item as Record<string, unknown>).patrullaNombre as string | null | undefined,
            cuadrillaId: (item as Record<string, unknown>).cuadrillaId as string | null | undefined,
            cuadrillaNombre: (item as Record<string, unknown>).cuadrillaNombre as string | null | undefined,
          },
          actualizadoEn: item.actualizadoEn,
        };
      });

      if (remotas.length > 0) {
        await guardarMisionesLocales(remotas);
        void obtenerCatalogoTiposIncidente().catch(() => {
          // Precarga silenciosa del catálogo oficial para uso offline
        });
        const locales = await obtenerMisionesLocales();
        if (Array.isArray(locales) && locales.length > 0) {
          const localesPorId = new Map(locales.map((m) => [m.id, m]));
          return remotas.map((r) => localesPorId.get(r.id) ?? r);
        }
        return remotas;
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
      const previa = previaLocal;
      const { misionesConOutbox, incidentesConOutbox } =
        await obtenerReferenciasOutboxPendientes();
      const incidenteIdRemoto = d.incidente?.id || previa?.incidenteId || '';
      const tieneOutboxPendiente =
        misionesConOutbox.has(d.id) ||
        (Boolean(incidenteIdRemoto) && incidentesConOutbox.has(incidenteIdRemoto));
      const estadoPermiteOptimista =
        d.estado === 'DESPACHADA' || d.estado === 'EN_CURSO';

      const mantenerOptimista = Boolean(
        previa &&
          (previa.sincronizacionPendiente || tieneOutboxPendiente) &&
          estadoPermiteOptimista
      );

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

      const datosBaseMision = {
        ...datosPrevios,
        trabajo:
          d.descripcion ||
          d.incidente?.descripcion ||
          'Sin instrucciones adicionales especificadas.',
        titulo: d.titulo,
        estadoPatrulla: d.patrulla?.estado || 'EN_VERIFICACION',
        estadoIncidente: d.incidente?.estado || 'VERIFICANDO',
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
      };

      const misionLocal: MisionLocal = {
        id: d.id,
        incidenteId: incidenteIdRemoto,
        codigoIncidente: d.incidente?.codigo || d.codigo,
        tipologia:
          mantenerOptimista && previa?.tipologia
            ? previa.tipologia
            : d.incidente?.tipoAfectacion
              ? formatearTipologia(d.incidente.tipoAfectacion)
              : limpiarTituloMision(d.titulo),
        direccion: d.incidente?.direccion || d.descripcion || 'Valdivia',
        coordenadas:
          d.incidente?.latitud && d.incidente?.longitud
            ? { lat: d.incidente.latitud, lng: d.incidente.longitud }
            : undefined,
        prioridad: d.prioridad,
        estado: mantenerOptimista && previa?.estado ? previa.estado : d.estado,
        fechaDespacho: d.fechaInicio || d.creadoEn,
        fechaInicio:
          mantenerOptimista && previa
            ? (previa.fechaInicio ?? d.fechaInicio ?? null)
            : d.fechaInicio || null,
        sincronizacionPendiente: mantenerOptimista,
        datosAdicionales:
          mantenerOptimista && previa?.datosAdicionales
            ? { ...datosBaseMision, ...previa.datosAdicionales }
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
        sincronizacionPendiente: true,
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
      },
      body: payloadApi,
    });

    if (error || !response.ok) {
      const status = response?.status ?? 500;
      const errorMsg =
        (error as unknown as { message?: string })?.message ||
        (status === 403
          ? 'No cuenta con permisos para rechazar esta misión.'
          : status === 404
            ? 'La misión solicitada no fue encontrada.'
            : status === 409
              ? 'La misión ya no se encuentra en un estado que permita su rechazo.'
              : `Error al rechazar la misión (${status}).`);
      throw new MisionServiceError(status, errorMsg);
    }

    const local = await obtenerMisionLocalPorId(id);
    if (local) {
      await guardarMisionLocal({
        ...local,
        estado: 'RECHAZADA',
        sincronizacionPendiente: false,
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
    if (err instanceof MisionServiceError) {
      throw err;
    }

    // Falla de red, corte de conexión o error de transporte (WebKit/Fetch/AbortError)
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
        sincronizacionPendiente: true,
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
