import apiClient, { handleUnauthorizedSession } from '@/lib/api/client';
import {
  encolarAccionOutbox,
  guardarMisionLocal,
  obtenerMisionLocalPorId,
} from '@/services/offlineQueue';
import {
  validarPayloadSolicitudApoyo,
  type SolicitudApoyoInput,
} from '@/lib/validations/solicitudApoyo';
import type {
  EvaluadorReporteTerreno,
  MisionLocal,
  SolicitudApoyoLocal,
} from '@/types/offline';

export class SolicitarApoyoServiceError extends Error {
  public readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'SolicitarApoyoServiceError';
    this.statusCode = statusCode;
  }
}

export interface ResultadoSolicitudApoyo {
  solicitud: SolicitudApoyoLocal;
  mision?: MisionLocal;
  enColaOffline: boolean;
  mensaje: string;
}

export interface OpcionesSolicitarApoyo {
  misionActual?: MisionLocal | null;
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

function normalizarSolicitudDesdeRegistro(
  raw: Record<string, unknown>,
  misionId: string,
  sincronizadoPorDefecto: boolean
): SolicitudApoyoLocal | null {
  const requiere = Boolean(
    raw.requiereApoyoAdicional ?? raw.requiere_apoyo_adicional ?? false
  );
  const detalle = String(
    raw.detalleApoyoRequerido ?? raw.detalle_apoyo_requerido ?? ''
  ).trim();

  if (!requiere || !detalle) {
    return null;
  }

  const resumen = String(
    raw.resumenTecnico ?? raw.resumen_tecnico ?? ''
  ).trim();
  const observaciones = String(raw.observaciones ?? '').trim();
  const id = typeof raw.id === 'string' ? raw.id : undefined;
  const localId = typeof raw.localId === 'string' ? raw.localId : undefined;
  const creadoEn =
    typeof raw.creadoEn === 'string' && raw.creadoEn.trim()
      ? raw.creadoEn
      : new Date().toISOString();
  const evaluador = extraerEvaluadorDeObjeto(raw.evaluador);

  return {
    ...(id ? { id } : {}),
    ...(localId ? { localId } : {}),
    misionId,
    requiereApoyoAdicional: true,
    detalleApoyoRequerido: detalle,
    resumenTecnico: resumen,
    observaciones,
    ...(evaluador ? { evaluador } : {}),
    creadoEn,
    sincronizado:
      typeof raw.sincronizado === 'boolean'
        ? raw.sincronizado
        : sincronizadoPorDefecto,
  };
}

/**
 * Consolida todas las solicitudes de apoyo adicional registradas en la misión (HU-44),
 * combinando registros remotos de `reportesTerreno` y solicitudes locales pendientes/sincronizadas,
 * ordenadas de la más reciente a la más antigua.
 */
export function obtenerSolicitudesApoyoMision(
  mision?: MisionLocal | null
): SolicitudApoyoLocal[] {
  if (!mision?.datosAdicionales) return [];

  const porClave = new Map<string, SolicitudApoyoLocal>();

  const remotos = mision.datosAdicionales.reportesTerreno;
  if (Array.isArray(remotos)) {
    for (const item of remotos) {
      if (!item || typeof item !== 'object') continue;
      const normalizado = normalizarSolicitudDesdeRegistro(
        item as Record<string, unknown>,
        mision.id,
        true
      );
      if (!normalizado) continue;
      const clave =
        normalizado.id ||
        normalizado.localId ||
        `${normalizado.creadoEn}-${normalizado.detalleApoyoRequerido}`;
      porClave.set(clave, normalizado);
    }
  }

  const locales = mision.datosAdicionales.solicitudesApoyoLocales;
  if (Array.isArray(locales)) {
    for (const item of locales) {
      if (!item || typeof item !== 'object') continue;
      const normalizado = normalizarSolicitudDesdeRegistro(
        item as Record<string, unknown>,
        mision.id,
        false
      );
      if (!normalizado) continue;
      const clave =
        normalizado.id ||
        normalizado.localId ||
        `${normalizado.creadoEn}-${normalizado.detalleApoyoRequerido}`;
      if (!porClave.has(clave)) {
        porClave.set(clave, normalizado);
      }
    }
  }

  return Array.from(porClave.values()).sort(
    (a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime()
  );
}

function extraerMensajeErrorApi(errObj: unknown, status: number): string {
  if (errObj && typeof errObj === 'object') {
    const record = errObj as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message.trim();
    }
    if (typeof record.error === 'string' && record.error.trim()) {
      return record.error.trim();
    }
  }

  if (status === 400) {
    return 'Los datos de la solicitud de apoyo son inválidos. Verifique el detalle ingresado.';
  }
  if (status === 401) {
    return 'Su sesión ha expirado. Inicie sesión nuevamente.';
  }
  if (status === 403) {
    return 'No cuenta con permiso (reportes:crear) o no pertenece a la cuadrilla asignada.';
  }
  if (status === 404) {
    return 'La misión solicitada no fue encontrada en el servidor.';
  }
  if (status === 409) {
    return 'La misión debe estar en estado EN_CURSO para solicitar apoyo adicional.';
  }
  return 'No fue posible enviar la solicitud de apoyo adicional.';
}

/**
 * Envía una solicitud de apoyo adicional en terreno para una misión EN_CURSO de cuadrilla (HU-44).
 * - Valida con `solicitudApoyoSchema` (Zod) antes de enviar o encolar en IndexedDB.
 * - Online: invoca `POST /api/misiones/{id}/apoyo` y emite alerta hacia la sala `encargado`.
 * - Errores terminales (400, 401, 403, 404, 409): lanza `SolicitarApoyoServiceError` sin encolar.
 * - Offline o falla de red / 5xx: guarda localmente con `sincronizado: false` y encola `SOLICITAR_APOYO` en `outbox`.
 */
export async function solicitarApoyoAdicional(
  misionId: string,
  input: SolicitudApoyoInput,
  opciones?: OpcionesSolicitarApoyo
): Promise<ResultadoSolicitudApoyo> {
  const payloadValidado = validarPayloadSolicitudApoyo(input);
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const ahoraIso = new Date().toISOString();
  const evaluadorSesion = obtenerEvaluadorSesionLocal();
  const localId = `apoyo-local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const persistirEnMisionLocal = async (
    solicitud: SolicitudApoyoLocal,
    pendienteSync: boolean
  ): Promise<MisionLocal | undefined> => {
    const base =
      opciones?.misionActual ?? (await obtenerMisionLocalPorId(misionId));
    if (!base) return undefined;

    const prevLocales = Array.isArray(
      base.datosAdicionales?.solicitudesApoyoLocales
    )
      ? (base.datosAdicionales.solicitudesApoyoLocales as SolicitudApoyoLocal[])
      : [];

    const actualizadas = [
      solicitud,
      ...prevLocales.filter(
        (item) =>
          (!solicitud.id || item.id !== solicitud.id) &&
          (!solicitud.localId || item.localId !== solicitud.localId)
      ),
    ];

    const misionActualizada: MisionLocal = {
      ...base,
      sincronizacionPendiente: pendienteSync || Boolean(base.sincronizacionPendiente),
      actualizadoEn: ahoraIso,
      datosAdicionales: {
        ...(base.datosAdicionales || {}),
        requiereApoyoAdicional: true,
        ultimoDetalleApoyoRequerido: solicitud.detalleApoyoRequerido,
        solicitudesApoyoLocales: actualizadas,
      },
    };

    await guardarMisionLocal(misionActualizada);
    return misionActualizada;
  };

  if (isOnline) {
    try {
      const { data, error, response } = await apiClient.POST(
        '/api/misiones/{id}/apoyo',
        {
          params: { path: { id: misionId } },
          body: payloadValidado,
        }
      );

      if (!error && response?.ok) {
        const reporteRemoto =
          data?.data?.reporteTerreno ?? data?.data?.reporte ?? undefined;
        const evaluadorRemoto = extraerEvaluadorDeObjeto(reporteRemoto?.evaluador);
        const solicitud: SolicitudApoyoLocal = {
          id: reporteRemoto?.id || `apoyo-${Date.now()}`,
          misionId,
          requiereApoyoAdicional: true,
          detalleApoyoRequerido:
            (reporteRemoto?.detalleApoyoRequerido ??
              reporteRemoto?.detalle_apoyo_requerido ??
              payloadValidado.detalleApoyoRequerido) ||
            '',
          resumenTecnico:
            reporteRemoto?.resumenTecnico ??
            payloadValidado.resumenTecnico ??
            '',
          observaciones:
            reporteRemoto?.observaciones ??
            payloadValidado.observaciones ??
            '',
          ...(evaluadorRemoto || evaluadorSesion
            ? { evaluador: evaluadorRemoto ?? evaluadorSesion }
            : {}),
          creadoEn: reporteRemoto?.creadoEn || ahoraIso,
          sincronizado: true,
        };

        const misionActualizada = await persistirEnMisionLocal(solicitud, false);
        return {
          solicitud,
          mision: misionActualizada,
          enColaOffline: false,
          mensaje:
            'Solicitud de apoyo enviada. La central logística y de operaciones ha sido alertada.',
        };
      }

      const status = response?.status ?? 500;
      if (status === 401) {
        handleUnauthorizedSession();
        throw new SolicitarApoyoServiceError(
          401,
          extraerMensajeErrorApi(error, 401)
        );
      }

      if (status >= 400 && status < 500) {
        throw new SolicitarApoyoServiceError(
          status,
          extraerMensajeErrorApi(error, status)
        );
      }
      // 5xx cae al flujo Offline-First
    } catch (err) {
      if (err instanceof SolicitarApoyoServiceError) {
        throw err;
      }
      // Error de red / timeout cae al flujo Offline-First
    }
  }

  // Flujo Offline-First
  const solicitudOffline: SolicitudApoyoLocal = {
    localId,
    misionId,
    requiereApoyoAdicional: true,
    detalleApoyoRequerido: payloadValidado.detalleApoyoRequerido || '',
    resumenTecnico: payloadValidado.resumenTecnico || '',
    observaciones: payloadValidado.observaciones || '',
    ...(evaluadorSesion ? { evaluador: evaluadorSesion } : {}),
    creadoEn: ahoraIso,
    sincronizado: false,
  };

  const misionActualizada = await persistirEnMisionLocal(solicitudOffline, true);

  await encolarAccionOutbox({
    tipo: 'SOLICITAR_APOYO',
    url: `/api/misiones/${misionId}/apoyo`,
    metodo: 'POST',
    payload: {
      ...payloadValidado,
      _localId: localId,
    },
  });

  return {
    solicitud: solicitudOffline,
    mision: misionActualizada,
    enColaOffline: true,
    mensaje:
      'Sin conexión. La solicitud de apoyo fue guardada localmente y alertará a la central al recuperar señal.',
  };
}
