import { getAuthCookie } from '@/lib/utils/cookieUtils';
import { extractUserIdFromJwt, handleUnauthorizedSession } from '@/lib/api/client';
import { prepararEvidenciaParaSubida } from '@/lib/utils/mediaUtils';
import { evidenciaOutboxPayloadSchema } from '@/lib/validations/evidencia';
import {
  agregarAdjuntoLocalAMision,
  encolarAccionOutbox,
  reemplazarAdjuntoLocalEnMision,
} from '@/services/offlineQueue';
import type { paths } from '@/types/api-generated';
import type { AdjuntoLocal, EvidenciaOutboxPayload } from '@/types/offline';

export const ENDPOINT_ADJUNTOS = '/api/evidencia/adjuntos';

export class EvidenciaServiceError extends Error {
  public readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'EvidenciaServiceError';
    this.statusCode = statusCode;
  }
}

export interface SubirEvidenciaParams {
  archivo: File;
  misionId: string;
  incidenteId?: string;
  reporteTerrenoId?: string;
  onProgress?: (porcentaje: number) => void;
}

export interface ResultadoSubidaEvidencia {
  adjunto: AdjuntoLocal;
  enColaOffline: boolean;
  mensaje: string;
}

export type AdjuntoCreadoOpenApi =
  paths['/api/evidencia/adjuntos']['post']['responses']['201']['content']['application/json'];

type ErrorHttpApi = {
  message?: string;
  error?: string;
};

type RespuestaAdjuntoApi = Partial<AdjuntoCreadoOpenApi> &
  ErrorHttpApi & {
    data?: Partial<AdjuntoCreadoOpenApi>;
  };

function resolveApiBaseUrl(): string {
  if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
    return '';
  }
  return process.env.NEXT_PUBLIC_API_URL || '';
}

function generarIdLocal(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `local-${crypto.randomUUID()}`;
  }
  return `local-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

async function registrarBackgroundSync(): Promise<void> {
  if (
    typeof navigator === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !navigator.serviceWorker?.ready
  ) {
    return;
  }
  try {
    const registration = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration & {
      sync?: { register: (tag: string) => Promise<void> };
    };
    if (registration.sync && typeof registration.sync.register === 'function') {
      await registration.sync.register('sync-offline-queue');
    }
  } catch {
    // Background Sync no soportado o denegado; el polling de useConnectivity reintentará
  }
}

export function construirFormDataEvidencia(
  blob: Blob,
  nombreArchivo: string,
  incidenteId?: string,
  reporteTerrenoId?: string
): FormData {
  const formData = new FormData();
  formData.append('file', blob, nombreArchivo);
  if (incidenteId) {
    formData.append('incidente_id', incidenteId);
  }
  if (reporteTerrenoId) {
    formData.append('reporte_terreno_id', reporteTerrenoId);
  }
  return formData;
}

export function extraerMensajeErrorHttp(status: number, fallbackMsg?: string): string {
  if (status === 403) {
    return 'No cuenta con el permiso reportes:crear para adjuntar evidencia.';
  }
  if (status === 404) {
    return 'El incidente o reporte de terreno asociado no fue encontrado.';
  }
  if (status === 409) {
    return (
      fallbackMsg ||
      'No se puede adjuntar evidencia porque el incidente o reporte ya se encuentra cerrado o no coincide.'
    );
  }
  if (status === 413) {
    return 'El archivo excede el tamaño máximo de 10 MB permitido por el servidor.';
  }
  if (status === 415) {
    return 'Formato de archivo inválido o no soportado por el servidor.';
  }
  if (status === 400) {
    return fallbackMsg || 'Faltan identificadores requeridos para asociar la evidencia.';
  }
  return fallbackMsg || `Error del servidor al subir evidencia (HTTP ${status}).`;
}

export function parsearAdjuntoDesdeRespuesta(
  json: RespuestaAdjuntoApi | null | undefined,
  fallback: AdjuntoLocal
): AdjuntoLocal {
  const src = json?.data && typeof json.data === 'object' ? json.data : json;
  return {
    id: src?.id || fallback.id,
    nombreArchivo: src?.nombreArchivo || fallback.nombreArchivo,
    url: src?.url || fallback.url,
    tipoMime: src?.tipoMime || fallback.tipoMime,
    tamanoBytes:
      typeof src?.tamanoBytes === 'number' ? src.tamanoBytes : fallback.tamanoBytes,
    creadoEn: src?.creadoEn || fallback.creadoEn,
    sincronizacionPendiente: false,
  };
}

/**
 * Valida, comprime (si es imagen) y sube un archivo multimedia al backend.
 * Si no hay conectividad o falla la red, lo persiste en IndexedDB (outbox SUBIR_EVIDENCIA).
 */
export async function subirEvidenciaMultimedia({
  archivo,
  misionId,
  incidenteId,
  reporteTerrenoId,
  onProgress,
}: SubirEvidenciaParams): Promise<ResultadoSubidaEvidencia> {
  onProgress?.(10);
  const incidenteIdLimpio = incidenteId?.trim() || undefined;
  const reporteTerrenoIdLimpio = reporteTerrenoId?.trim() || undefined;
  const preparada = await prepararEvidenciaParaSubida(archivo);
  onProgress?.(35);

  const adjuntoLocalId = generarIdLocal();
  const payloadValidado = evidenciaOutboxPayloadSchema.parse({
    adjuntoLocalId,
    misionId,
    incidente_id: incidenteIdLimpio,
    reporte_terreno_id: reporteTerrenoIdLimpio,
    nombreArchivo: preparada.nombreArchivo,
    tipoMime: preparada.tipoMime,
    tamanoBytes: preparada.tamanoFinalBytes,
    dataUrl: preparada.dataUrl,
  });

  const adjuntoTemporal: AdjuntoLocal = {
    id: adjuntoLocalId,
    nombreArchivo: payloadValidado.nombreArchivo,
    url: payloadValidado.dataUrl,
    tipoMime: payloadValidado.tipoMime,
    tamanoBytes: payloadValidado.tamanoBytes,
    creadoEn: new Date().toISOString(),
    sincronizacionPendiente: true,
  };

  const encolarOffline = async (): Promise<ResultadoSubidaEvidencia> => {
    const outboxPayload: EvidenciaOutboxPayload = {
      ...payloadValidado,
    };
    await encolarAccionOutbox({
      tipo: 'SUBIR_EVIDENCIA',
      url: ENDPOINT_ADJUNTOS,
      metodo: 'POST',
      payload: outboxPayload,
    });
    await agregarAdjuntoLocalAMision(misionId, adjuntoTemporal);
    await registrarBackgroundSync();
    onProgress?.(100);

    return {
      adjunto: adjuntoTemporal,
      enColaOffline: true,
      mensaje:
        'Sin conexión. Evidencia guardada localmente y encolada para sincronización automática.',
    };
  };

  const estaOnline =
    typeof navigator === 'undefined' ? true : navigator.onLine !== false;

  if (!estaOnline) {
    return encolarOffline();
  }

  try {
    onProgress?.(60);
    const token = getAuthCookie();
    const formData = construirFormDataEvidencia(
      preparada.blob,
      preparada.nombreArchivo,
      incidenteIdLimpio,
      reporteTerrenoIdLimpio
    );

    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      const userId = extractUserIdFromJwt(token);
      if (userId) {
        headers['x-user-id'] = userId;
      }
    }

    const res = await fetch(`${resolveApiBaseUrl()}${ENDPOINT_ADJUNTOS}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (res.status === 401) {
      handleUnauthorizedSession();
      throw new EvidenciaServiceError(401, 'Sesión expirada. Inicie sesión nuevamente.');
    }

    if (!res.ok) {
      let bodyErr: RespuestaAdjuntoApi | undefined;
      try {
        bodyErr = (await res.json()) as RespuestaAdjuntoApi;
      } catch {
        // Sin cuerpo JSON
      }
      const msg = extraerMensajeErrorHttp(
        res.status,
        bodyErr?.message || bodyErr?.error
      );

      // Errores 5xx se reintentan vía cola offline; errores 4xx de validación/permiso se informan al usuario
      if (res.status >= 500) {
        return encolarOffline();
      }
      throw new EvidenciaServiceError(res.status, msg);
    }

    const bodyOk = (await res.json()) as RespuestaAdjuntoApi;
    const adjuntoDefinitivo = parsearAdjuntoDesdeRespuesta(bodyOk, {
      ...adjuntoTemporal,
      sincronizacionPendiente: false,
    });

    await reemplazarAdjuntoLocalEnMision(misionId, adjuntoLocalId, adjuntoDefinitivo);
    onProgress?.(100);

    return {
      adjunto: adjuntoDefinitivo,
      enColaOffline: false,
      mensaje: 'Evidencia multimedia cargada y asociada a la misión.',
    };
  } catch (err) {
    if (err instanceof EvidenciaServiceError) {
      throw err;
    }
    return encolarOffline();
  }
}
