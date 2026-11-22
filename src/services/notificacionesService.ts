import apiClient from '@/lib/api/client';
import {
  guardarNotificacionLocal,
  obtenerNotificacionLocal,
  guardarMisionLocal,
  encolarAccionOutbox,
} from '@/services/offlineQueue';
import { emitirAckNotificacionSocket } from '@/lib/socket/socketClient';
import type {
  MisionAsignadaAlerta,
  MisionPendienteTerreno,
} from '@/types/notificaciones';
import type { MisionLocal } from '@/types/offline';

// Memoria volátil para deduplicación ultra-rápida síncrona
const notificacionesProcesadasMemoria = new Set<string>();

/**
 * Limpia la memoria de notificaciones procesadas (útil para pruebas unitarias).
 */
export function limpiarCacheNotificacionesMemoria(): void {
  notificacionesProcesadasMemoria.clear();
}

/**
 * Consulta si una notificación ya fue procesada previamente por el dispositivo (Deduplicación CP-H35-PWA-06).
 */
export async function esNotificacionDuplicada(notificacionId: string): Promise<boolean> {
  if (!notificacionId) return false;
  if (notificacionesProcesadasMemoria.has(notificacionId)) {
    return true;
  }

  try {
    const registro = await obtenerNotificacionLocal(notificacionId);
    if (registro) {
      notificacionesProcesadasMemoria.add(notificacionId);
      return true;
    }
  } catch {
    // Si falla el acceso a IndexedDB, confiar en la memoria volátil
  }

  return false;
}

/**
 * Convierte una orden de misión a la estructura MisionLocal para su persistencia en terreno.
 */
export function mapearAlertaAMisionLocal(alerta: MisionAsignadaAlerta): MisionLocal {
  return {
    id: alerta.misionId,
    incidenteId: alerta.incidenteId || '',
    codigoIncidente: alerta.incidenteCodigo || alerta.codigo,
    tipologia: alerta.tipoAfectacion || 'Verificación de Incidente',
    direccion: alerta.direccion || 'Comuna de Valdivia',
    prioridad: alerta.prioridad,
    estado: 'DESPACHADA',
    fechaDespacho: alerta.asignadoEn,
    fechaInicio: null,
    sincronizacionPendiente: false,
    datosAdicionales: {
      titulo: alerta.tipoAfectacion || `Misión ${alerta.codigo}`,
      incidenteFolio: alerta.incidenteFolio,
      notificacionId: alerta.notificacionId,
      tipoMision: alerta.tipoMision,
      patrullaId: alerta.patrullaId,
    },
    actualizadoEn: new Date().toISOString(),
  };
}

/**
 * Envía el acuse de recibo o lectura vía REST como fallback idempontente (HU-35 §2.2).
 */
export async function enviarAckHttp(
  notificacionId: string,
  estado: 'RECIBIDA' | 'LEIDA'
): Promise<boolean> {
  try {
    const { response, error } = await apiClient.PATCH(
      '/api/terreno/notificaciones/{id}/estado',
      {
        params: {
          path: { id: notificacionId },
        },
        body: {
          estado,
        },
      }
    );

    if (error || !response.ok) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Procesa la asignación de misión entrante:
 * 1. Deduplica la notificación (CP-H35-PWA-06).
 * 2. Emite de forma inmediata el acuse técnico automático ('RECIBIDA') (CP-H35-PWA-04).
 * 3. Persiste la misión en IndexedDB para disponibilidad offline.
 */
export async function procesarMisionAsignada(
  alerta: MisionAsignadaAlerta
): Promise<{ esDuplicado: boolean; mision: MisionLocal }> {
  const duplicado = await esNotificacionDuplicada(alerta.notificacionId);
  const mision = mapearAlertaAMisionLocal(alerta);

  if (duplicado) {
    return { esDuplicado: true, mision };
  }

  // Registrar en deduplicación
  notificacionesProcesadasMemoria.add(alerta.notificacionId);

  // Persistir en base de datos local (IndexedDB)
  try {
    await guardarNotificacionLocal({
      notificacionId: alerta.notificacionId,
      misionId: alerta.misionId,
      estado: 'RECIBIDA',
      procesadoEn: new Date().toISOString(),
    });
    await guardarMisionLocal(mision);
  } catch {
    // Si IndexedDB falla, continuar con emisión de ACK
  }

  // Emitir acuse técnico automático 'RECIBIDA' (WebSocket -> REST -> Outbox)
  await emitirAckRecibida(alerta.notificacionId);

  return { esDuplicado: false, mision };
}

/**
 * Emite el acuse técnico 'RECIBIDA' con estrategia híbrida: WebSocket -> REST -> Outbox Offline (HU-35 §3.2).
 */
export async function emitirAckRecibida(notificacionId: string): Promise<void> {
  // 1. Intento por WebSocket nativo
  const resSocket = await emitirAckNotificacionSocket(notificacionId, 'RECIBIDA');
  if (resSocket.ok) {
    return;
  }

  // 2. Intento por REST API
  const okHttp = await enviarAckHttp(notificacionId, 'RECIBIDA');
  if (okHttp) {
    return;
  }

  // 3. Fallback a cola offline (Outbox) si no hay conectividad
  try {
    await encolarAccionOutbox({
      tipo: 'ACK_NOTIFICACION',
      url: `/api/terreno/notificaciones/${notificacionId}/estado`,
      metodo: 'PATCH',
      payload: { estado: 'RECIBIDA' },
    });
  } catch {
    // Silenciar error en entorno sin persistencia
  }
}

/**
 * Emite el acuse de lectura operativa 'LEIDA' al interactuar con el banner o misión (HU-35 §3.4).
 */
export async function emitirAckLectura(
  notificacionId: string,
  misionId?: string
): Promise<void> {
  // Actualizar registro local
  try {
    await guardarNotificacionLocal({
      notificacionId,
      misionId: misionId || '',
      estado: 'LEIDA',
      procesadoEn: new Date().toISOString(),
    });
  } catch {
    // Silenciar
  }

  // 1. Intento por WebSocket
  const resSocket = await emitirAckNotificacionSocket(notificacionId, 'LEIDA');
  if (resSocket.ok) {
    return;
  }

  // 2. Fallback REST
  const okHttp = await enviarAckHttp(notificacionId, 'LEIDA');
  if (okHttp) {
    return;
  }

  // 3. Fallback a cola offline
  try {
    await encolarAccionOutbox({
      tipo: 'ACK_NOTIFICACION',
      url: `/api/terreno/notificaciones/${notificacionId}/estado`,
      metodo: 'PATCH',
      payload: { estado: 'LEIDA' },
    });
  } catch {
    // Silenciar
  }
}

/**
 * Consulta órdenes de misión despachadas pendientes de confirmación en el servidor (HU-35 §2.2 B).
 */
export async function consultarMisionesPendientes(
  patrullaId?: string
): Promise<MisionPendienteTerreno[]> {
  try {
    const { data, error } = await apiClient.GET('/api/terreno/misiones/pendientes', {
      params: {
        query: {
          patrullaId,
        },
      },
    });

    if (error || !data || !Array.isArray(data.data)) {
      return [];
    }

    return data.data;
  } catch {
    return [];
  }
}
