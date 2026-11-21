import { getAuthCookie } from '@/lib/utils/cookieUtils';
import {
  DEV_PATRULLA_TOKEN,
  DEV_PATRULLA_USER_ID,
  handleUnauthorizedSession,
} from '@/lib/api/client';
import {
  encolarAccionOutbox,
  guardarMisionLocal,
} from '@/services/offlineQueue';
import { obtenerCoordenadasOpcionales } from '@/services/misionesService';
import {
  crearReporteVerificacionSchema,
  DICTAMENES_ATENCION,
  ESTADOS_TERRENO_VERIFICACION,
  type CrearReporteVerificacionInput,
} from '@/lib/validations/reporteVerificacion';
import type {
  AdjuntoReportePreliminar,
  DictamenAtencion,
  EstadoTerrenoVerificacion,
  EvaluadorReporteTerreno,
  MisionLocal,
  ReporteVerificacionTerrenoLocal,
} from '@/types/offline';

function resolveApiUrl(): string {
  if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
    return '';
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
}

function buildAuthHeaders(): Record<string, string> {
  const token = getAuthCookie();
  if (token === DEV_PATRULLA_TOKEN) {
    return { 'x-user-id': DEV_PATRULLA_USER_ID };
  }
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

function extraerEvaluadorDeObjeto(raw: unknown): EvaluadorReporteTerreno | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const ev = raw as Record<string, unknown>;
  const nombre = typeof ev.nombre === 'string' ? ev.nombre.trim() : '';
  if (!nombre) return undefined;
  return {
    id: typeof ev.id === 'string' ? ev.id : undefined,
    nombre,
    email: typeof ev.email === 'string' ? ev.email : undefined,
    rut: typeof ev.rut === 'string' ? ev.rut : null,
  };
}

function obtenerEvaluadorSesionLocal(): EvaluadorReporteTerreno | undefined {
  if (typeof window === 'undefined' || !window.sessionStorage) return undefined;
  try {
    const raw = window.sessionStorage.getItem('sgrai_usuario_sesion');
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return extraerEvaluadorDeObjeto(parsed);
  } catch {
    return undefined;
  }
}

function normalizarDictamen(val: unknown): DictamenAtencion | null {
  if (typeof val !== 'string') return null;
  const upper = val.toUpperCase();
  return (DICTAMENES_ATENCION as readonly string[]).includes(upper)
    ? (upper as DictamenAtencion)
    : null;
}

function normalizarEstadoTerreno(val: unknown): EstadoTerrenoVerificacion {
  if (typeof val === 'string') {
    const upper = val.toUpperCase();
    if ((ESTADOS_TERRENO_VERIFICACION as readonly string[]).includes(upper)) {
      return upper as EstadoTerrenoVerificacion;
    }
  }
  return 'ESTABLE';
}

/**
 * Extrae el informe técnico de verificación y cierre (HU-39) desde `mision.datosAdicionales`,
 * priorizando el registro oficial proveniente de `reportesTerreno` del servidor (que incluye
 * el reporte subido por cualquier miembro de la patrulla junto con su autor `evaluador`),
 * o recurriendo al registro local en cola offline si aún no se ha sincronizado.
 */
export function obtenerReporteVerificacionMision(
  mision?: MisionLocal | null
): ReporteVerificacionTerrenoLocal | null {
  if (!mision?.datosAdicionales) return null;

  const remotos = mision.datosAdicionales.reportesTerreno;
  if (Array.isArray(remotos) && remotos.length > 0) {
    const reportesCierre = remotos
      .map((raw) => (raw || {}) as Record<string, unknown>)
      .filter(
        (r) =>
          r.tipoReporte === 'VERIFICACION_CIERRE' ||
          normalizarDictamen(r.dictamen) !== null
      )
      .sort(
        (a, b) =>
          new Date(String(b.creadoEn || 0)).getTime() -
          new Date(String(a.creadoEn || 0)).getTime()
      );

    const cierreRemoto = reportesCierre[0];
    if (cierreRemoto) {
      const dictamen = normalizarDictamen(cierreRemoto.dictamen) ?? 'REQUIERE_CUADRILLA';
      const evaluador = extraerEvaluadorDeObjeto(cierreRemoto.evaluador);
      const adjuntosRaw = Array.isArray(cierreRemoto.adjuntos)
        ? (cierreRemoto.adjuntos as Record<string, unknown>[])
        : [];
      const adjuntos: AdjuntoReportePreliminar[] = adjuntosRaw.map((adj) => ({
        id: typeof adj.id === 'string' ? adj.id : undefined,
        nombreArchivo:
          typeof adj.nombreArchivo === 'string' ? adj.nombreArchivo : undefined,
        url: typeof adj.url === 'string' ? adj.url : undefined,
        tipoMime: typeof adj.tipoMime === 'string' ? adj.tipoMime : undefined,
        tamanoBytes:
          typeof adj.tamanoBytes === 'number' ? adj.tamanoBytes : undefined,
      }));

      return {
        id: typeof cierreRemoto.id === 'string' ? cierreRemoto.id : undefined,
        misionId: mision.id,
        dictamen,
        motivo_no_abordable:
          typeof cierreRemoto.motivoNoAbordable === 'string'
            ? cierreRemoto.motivoNoAbordable
            : '',
        resumen_tecnico:
          typeof cierreRemoto.resumenTecnico === 'string'
            ? cierreRemoto.resumenTecnico
            : '',
        estado_terreno: normalizarEstadoTerreno(cierreRemoto.estadoTerreno),
        personas_afectadas:
          typeof cierreRemoto.personasAfectadas === 'number'
            ? cierreRemoto.personasAfectadas
            : 0,
        danos_estimados:
          typeof cierreRemoto.danosEstimados === 'string'
            ? cierreRemoto.danosEstimados
            : '',
        observaciones:
          typeof cierreRemoto.observaciones === 'string'
            ? cierreRemoto.observaciones
            : '',
        requiere_asistencia_social: Boolean(
          cierreRemoto.requiereAsistenciaSocial
        ),
        adjuntoIds: adjuntos
          .map((a) => a.id)
          .filter((id): id is string => typeof id === 'string'),
        adjuntos,
        ...(evaluador ? { evaluador } : {}),
        creadoEn:
          typeof cierreRemoto.creadoEn === 'string'
            ? cierreRemoto.creadoEn
            : mision.actualizadoEn || new Date().toISOString(),
        sincronizado: true,
      };
    }
  }

  const local = mision.datosAdicionales.reporteVerificacion;
  if (local && typeof local === 'object') {
    return local as ReporteVerificacionTerrenoLocal;
  }

  return null;
}

export interface ResultadoEnvioReporteVerificacion {
  ok: boolean;
  offline: boolean;
  mensaje: string;
  reporte: ReporteVerificacionTerrenoLocal;
  mision?: MisionLocal;
  data?: unknown;
}

/**
 * Envía el informe técnico consolidado de verificación en terreno y cierra la misión
 * inicial de patrullaje (HU-39 / HU-86).
 * - Valida exhaustivamente el payload mediante Zod (`crearReporteVerificacionSchema`).
 * - Adjunta coordenadas GPS opcionales de forma no bloqueante.
 * - En modo online invoca `POST /api/misiones/{id}/reporte` (`201 Created`).
 * - En modo offline o caída de red encola la mutación `ENVIAR_REPORTE` en IndexedDB (`outbox`).
 */
export async function enviarReporteVerificacionTerreno(
  misionId: string,
  input: CrearReporteVerificacionInput,
  misionActual?: MisionLocal
): Promise<ResultadoEnvioReporteVerificacion> {
  const validado = crearReporteVerificacionSchema.parse(input);
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  let latitud = validado.latitud;
  let longitud = validado.longitud;
  if (latitud === undefined || longitud === undefined) {
    const coords = await obtenerCoordenadasOpcionales(3000);
    latitud = coords.latitud;
    longitud = coords.longitud;
  }

  const motivoLimpio =
    validado.dictamen === 'NO_ABORDABLE'
      ? validado.motivo_no_abordable.trim()
      : null;
  const danosLimpio = validado.danos_estimados?.trim() || null;
  const observacionesLimpio = validado.observaciones?.trim() || null;

  const payloadMutacion: Record<string, unknown> = {
    dictamen: validado.dictamen,
    motivo_no_abordable: motivoLimpio,
    motivoNoAbordable: motivoLimpio,
    resumen_tecnico: validado.resumen_tecnico.trim(),
    resumenTecnico: validado.resumen_tecnico.trim(),
    ...(validado.estado_terreno
      ? {
          estado_terreno: validado.estado_terreno,
          estadoTerreno: validado.estado_terreno,
        }
      : {}),
    personas_afectadas: validado.personas_afectadas,
    personasAfectadas: validado.personas_afectadas,
    danos_estimados: danosLimpio,
    danosEstimados: danosLimpio,
    observaciones: observacionesLimpio,
    requiere_asistencia_social: validado.requiere_asistencia_social,
    requiereAsistenciaSocial: validado.requiere_asistencia_social,
    adjuntoIds: validado.adjuntoIds || [],
    adjuntos: validado.adjuntos || [],
    ...(validado.familias && validado.familias.length > 0
      ? { familias: validado.familias }
      : {}),
    ...(typeof latitud === 'number' ? { latitud } : {}),
    ...(typeof longitud === 'number' ? { longitud } : {}),
  };

  const ahoraIso = new Date().toISOString();
  const evaluadorSesion = obtenerEvaluadorSesionLocal();

  const construirReporteLocal = (
    sincronizado: boolean,
    idRemoto?: string,
    evaluadorRemoto?: EvaluadorReporteTerreno,
    creadoEnServidor?: string
  ): ReporteVerificacionTerrenoLocal => {
    const evaluadorFinal = evaluadorRemoto ?? evaluadorSesion;
    return {
      id: idRemoto || `rep-cierre-${Date.now()}`,
      misionId,
      dictamen: validado.dictamen,
      motivo_no_abordable: motivoLimpio || '',
      resumen_tecnico: validado.resumen_tecnico.trim(),
      ...(validado.estado_terreno ? { estado_terreno: validado.estado_terreno } : {}),
      personas_afectadas: validado.personas_afectadas,
      danos_estimados: danosLimpio || '',
      observaciones: observacionesLimpio || '',
      requiere_asistencia_social: validado.requiere_asistencia_social,
      familias: validado.familias || [],
      adjuntoIds: validado.adjuntoIds || [],
      adjuntos: validado.adjuntos || [],
      ...(evaluadorFinal ? { evaluador: evaluadorFinal } : {}),
      creadoEn: creadoEnServidor || ahoraIso,
      sincronizado,
    };
  };

  const actualizarMisionLocal = async (
    reporte: ReporteVerificacionTerrenoLocal,
    pendienteSync: boolean,
    fechaServidor?: string
  ): Promise<MisionLocal | undefined> => {
    if (!misionActual) return undefined;

    const reportesTerrenoPrevios = Array.isArray(
      misionActual.datosAdicionales?.reportesTerreno
    )
      ? (misionActual.datosAdicionales.reportesTerreno as Record<string, unknown>[])
      : [];

    const reporteTerrenoRegistro: Record<string, unknown> = {
      id: reporte.id,
      misionId,
      tipoReporte: 'VERIFICACION_CIERRE',
      dictamen: reporte.dictamen,
      motivoNoAbordable: reporte.motivo_no_abordable || null,
      requiereAsistenciaSocial: reporte.requiere_asistencia_social,
      resumenTecnico: reporte.resumen_tecnico,
      ...(reporte.estado_terreno ? { estadoTerreno: reporte.estado_terreno } : {}),
      personasAfectadas: reporte.personas_afectadas,
      danosEstimados: reporte.danos_estimados || null,
      observaciones: reporte.observaciones || null,
      adjuntos: reporte.adjuntos,
      ...(reporte.evaluador ? { evaluador: reporte.evaluador } : {}),
      creadoEn: reporte.creadoEn,
    };

    const misionActualizada: MisionLocal = {
      ...misionActual,
      estado: 'COMPLETADA',
      sincronizacionPendiente: pendienteSync,
      actualizadoEn: fechaServidor || ahoraIso,
      datosAdicionales: {
        ...misionActual.datosAdicionales,
        estadoPatrulla: 'DISPONIBLE',
        estadoIncidente:
          validado.dictamen === 'NO_ABORDABLE' ? 'NO_ABORDABLE' : 'VERIFICANDO',
        reporteVerificacionEnviado: true,
        reporteVerificacionEnviadoEn: reporte.creadoEn,
        dictamenVerificacion: validado.dictamen,
        reporteVerificacion: reporte,
        reportesTerreno: [
          ...reportesTerrenoPrevios.filter(
            (r) => r.tipoReporte !== 'VERIFICACION_CIERRE'
          ),
          reporteTerrenoRegistro,
        ],
      },
    };

    await guardarMisionLocal(misionActualizada);
    return misionActualizada;
  };

  if (!isOnline) {
    await encolarAccionOutbox({
      tipo: 'ENVIAR_REPORTE',
      url: `/api/misiones/${misionId}/reporte`,
      metodo: 'POST',
      payload: payloadMutacion,
    });

    const reporteOffline = construirReporteLocal(false);
    const misionActualizada = await actualizarMisionLocal(reporteOffline, true);

    return {
      ok: true,
      offline: true,
      reporte: reporteOffline,
      mision: misionActualizada,
      mensaje:
        'Sin conexión: Informe técnico guardado localmente y encolado para cerrar la misión automáticamente al recuperar señal.',
    };
  }

  try {
    const apiUrl = resolveApiUrl();
    const res = await fetch(`${apiUrl}/api/misiones/${misionId}/reporte`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...buildAuthHeaders(),
      },
      body: JSON.stringify(payloadMutacion),
    });

    const body = (await res.json().catch(() => ({}))) as {
      message?: string;
      data?: {
        reporteTerreno?: {
          id?: string;
          creadoEn?: string;
          evaluador?: unknown;
        };
        mision?: {
          id?: string;
          estado?: string;
          fechaCierre?: string;
          actualizadoEn?: string;
        };
        patrulla?: {
          id?: string;
          estado?: string;
        } | null;
        incidente?: {
          id?: string;
          estado?: string;
        } | null;
      };
    };

    if (res.ok) {
      const reporteRemoto = body?.data?.reporteTerreno;
      const evaluadorRemoto = extraerEvaluadorDeObjeto(reporteRemoto?.evaluador);
      const reporteOnline = construirReporteLocal(
        true,
        reporteRemoto?.id,
        evaluadorRemoto,
        reporteRemoto?.creadoEn
      );
      const misionActualizada = await actualizarMisionLocal(
        reporteOnline,
        false,
        body?.data?.mision?.actualizadoEn
      );

      const mensajeDefecto =
        validado.dictamen === 'NO_ABORDABLE'
          ? 'Informe técnico registrado, misión cerrada e incidente marcado como no abordable. Patrulla disponible.'
          : 'Informe técnico de verificación enviado y misión cerrada exitosamente. Patrulla disponible para nuevas asignaciones.';

      return {
        ok: true,
        offline: false,
        reporte: reporteOnline,
        mision: misionActualizada,
        data: body?.data,
        mensaje: body?.message || mensajeDefecto,
      };
    }

    const tokenActual = typeof window !== 'undefined' ? getAuthCookie() : null;
    const esModoDemoLocal =
      Boolean(tokenActual) && tokenActual === (DEV_PATRULLA_TOKEN || 'dev-patrulla-token');
    if (
      esModoDemoLocal &&
      (res.status === 401 || res.status === 403 || res.status === 404)
    ) {
      const reporteDemo = construirReporteLocal(true);
      const misionActualizada = await actualizarMisionLocal(reporteDemo, false);
      return {
        ok: true,
        offline: false,
        reporte: reporteDemo,
        mision: misionActualizada,
        mensaje:
          validado.dictamen === 'NO_ABORDABLE'
            ? 'Informe técnico registrado, misión cerrada e incidente marcado como no abordable.'
            : 'Informe técnico de verificación enviado y misión cerrada exitosamente.',
      };
    }

    if (res.status === 401) {
      handleUnauthorizedSession();
      throw new Error('Sesión expirada o no autorizada.');
    }

    if (res.status === 403) {
      throw new Error(
        body?.message ||
          'No posee los permisos requeridos (reportes:crear) o la misión pertenece a otra patrulla.'
      );
    }

    if (res.status === 409) {
      throw new Error(
        body?.message ||
          'La misión debe estar en estado EN_CURSO para enviar el informe técnico y cerrar la tarea.'
      );
    }

    throw new Error(
      body?.message ||
        `Error del servidor (${res.status}) al enviar el informe técnico de verificación.`
    );
  } catch (err) {
    if (
      err instanceof TypeError ||
      (err instanceof Error && err.message.includes('fetch'))
    ) {
      await encolarAccionOutbox({
        tipo: 'ENVIAR_REPORTE',
        url: `/api/misiones/${misionId}/reporte`,
        metodo: 'POST',
        payload: payloadMutacion,
      });

      const reporteOffline = construirReporteLocal(false);
      const misionActualizada = await actualizarMisionLocal(reporteOffline, true);

      return {
        ok: true,
        offline: true,
        reporte: reporteOffline,
        mision: misionActualizada,
        mensaje:
          'Fallo de conexión: Informe técnico guardado localmente. Se sincronizará al recuperar señal.',
      };
    }

    throw err;
  }
}
