import apiClient from '@/lib/api/client';
import {
  guardarNotificacionLocal,
  obtenerNotificacionLocal,
  obtenerNotificacionLocalPorMisionId,
  guardarMisionLocal,
  encolarAccionOutbox,
} from '@/services/offlineQueue';
import { emitirAckNotificacionSocket } from '@/lib/socket/socketClient';
import type {
  MisionAsignadaAlerta,
  MisionPendienteTerreno,
} from '@/types/notificaciones';
import type { MisionLocal } from '@/types/offline';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Valida que el identificador de notificación corresponda a un UUID real emitido por el backend.
 */
export function esUuidNotificacionValido(id?: string | null): id is string {
  return typeof id === 'string' && UUID_REGEX.test(id.trim());
}

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
  const esCuadrilla = alerta.tipoMision === 'ATENCION_CUADRILLA';
  return {
    id: alerta.misionId,
    incidenteId: alerta.incidenteId || '',
    codigoIncidente: alerta.incidenteCodigo || alerta.codigo,
    tipologia:
      alerta.tipoAfectacion ||
      (esCuadrilla ? 'Atención de Cuadrilla' : 'Verificación de Incidente'),
    direccion: alerta.direccion || 'Comuna de Valdivia',
    prioridad: alerta.prioridad,
    estado: 'DESPACHADA',
    fechaDespacho: alerta.asignadoEn,
    fechaInicio: null,
    sincronizacionPendiente: false,
    datosAdicionales: {
      titulo: alerta.tipoAfectacion || `Misión ${alerta.codigo}`,
      codigoMision: alerta.codigo,
      incidenteFolio: alerta.incidenteFolio,
      notificacionId: alerta.notificacionId,
      tipoMision: alerta.tipoMision,
      patrullaId: alerta.patrullaId ?? null,
      cuadrillaId: alerta.cuadrillaId ?? null,
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
  if (!esUuidNotificacionValido(notificacionId)) {
    return false;
  }

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
  const tieneUuidValido = esUuidNotificacionValido(alerta.notificacionId);
  const duplicado = tieneUuidValido
    ? await esNotificacionDuplicada(alerta.notificacionId)
    : false;
  const mision = mapearAlertaAMisionLocal(alerta);

  if (duplicado) {
    return { esDuplicado: true, mision };
  }

  if (tieneUuidValido) {
    notificacionesProcesadasMemoria.add(alerta.notificacionId);
  }

  // Persistir en base de datos local (IndexedDB)
  try {
    if (tieneUuidValido) {
      await guardarNotificacionLocal({
        notificacionId: alerta.notificacionId,
        misionId: alerta.misionId,
        estado: 'RECIBIDA',
        procesadoEn: new Date().toISOString(),
      });
    }
    await guardarMisionLocal(mision);
  } catch {
    // Si IndexedDB falla, continuar con emisión de ACK
  }

  // Emitir acuse técnico automático 'RECIBIDA' solo si el ID es un UUID real del backend
  if (tieneUuidValido) {
    await emitirAckRecibida(alerta.notificacionId);
  }

  return { esDuplicado: false, mision };
}

/**
 * Emite el acuse técnico 'RECIBIDA' con estrategia híbrida: WebSocket -> REST -> Outbox Offline (HU-35 §3.2).
 */
export async function emitirAckRecibida(notificacionId: string): Promise<void> {
  if (!esUuidNotificacionValido(notificacionId)) {
    return;
  }

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
 * Emite el acuse de lectura operativa 'LEIDA' al abrir la misión o interactuar con la alerta (HU-35 §3.4).
 */
export async function emitirAckLectura(
  notificacionId: string,
  misionId?: string
): Promise<void> {
  if (!esUuidNotificacionValido(notificacionId)) {
    return;
  }

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

export interface ConsultaMisionesPendientesFiltro {
  patrullaId?: string;
  cuadrillaId?: string;
}

/**
 * Consulta órdenes de misión despachadas pendientes de confirmación en el servidor (HU-35 §2.2 B).
 */
export async function consultarMisionesPendientes(
  filtro?: string | ConsultaMisionesPendientesFiltro
): Promise<MisionPendienteTerreno[]> {
  try {
    const query =
      typeof filtro === 'string'
        ? { patrullaId: filtro }
        : {
            ...(filtro?.patrullaId ? { patrullaId: filtro.patrullaId } : {}),
            ...(filtro?.cuadrillaId ? { cuadrillaId: filtro.cuadrillaId } : {}),
          };

    const { data, error } = await apiClient.GET('/api/terreno/misiones/pendientes', {
      params: {
        query,
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

export interface ConfirmarLecturaMisionParams {
  misionId: string;
  notificacionId?: string | null;
  unidadId?: string | null;
  esCuadrilla?: boolean;
  trazabilidadNotificacion?: string | null;
}

/**
 * Confirma automáticamente la lectura ('LEIDA') cuando el operador de terreno abre el detalle de la misión.
 * Resuelve el UUID real de notificación en este orden:
 * 1) `notificacionId` proveniente del detalle o caché local de misión;
 * 2) Tabla `notificaciones` en IndexedDB;
 * 3) Reconciliación remota vía GET `/api/terreno/misiones/pendientes`.
 */
export async function confirmarLecturaMisionAbierta(
  params: ConfirmarLecturaMisionParams
): Promise<boolean> {
  const { misionId, notificacionId, unidadId, esCuadrilla, trazabilidadNotificacion } = params;
  if (!misionId) return false;

  if (trazabilidadNotificacion === 'LEIDA') {
    return false;
  }

  try {
    const registroLocal = await obtenerNotificacionLocalPorMisionId(misionId);
    if (registroLocal?.estado === 'LEIDA') {
      return false;
    }

    let idObjetivo: string | null = esUuidNotificacionValido(notificacionId)
      ? notificacionId
      : registroLocal && esUuidNotificacionValido(registroLocal.notificacionId)
        ? registroLocal.notificacionId
        : null;

    if (!idObjetivo && unidadId) {
      const pendientes = await consultarMisionesPendientes(
        esCuadrilla ? { cuadrillaId: unidadId } : { patrullaId: unidadId }
      );
      const match = pendientes.find((p) => p.misionId === misionId);
      if (match && esUuidNotificacionValido(match.notificacionId)) {
        idObjetivo = match.notificacionId;
      }
    }

    if (!idObjetivo) {
      return false;
    }

    await emitirAckLectura(idObjetivo, misionId);
    return true;
  } catch {
    return false;
  }
}
