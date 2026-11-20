import apiClient from '@/lib/api/client';
import {
  guardarNotificacionLocal,
  obtenerNotificacionLocal,
  guardarMisionLocal,
  encolarAccionOutbox,
} from '@/services/offlineQueue';
import { emitirAckNotificacionSocket } from '@/lib/socket/socketClient';
import { normalizarRecursosPrevencion } from '@/services/prevencionService';
import type {
  MisionAsignadaAlerta,
  MisionPendienteTerreno,
  PrevencionActualizadaPayload,
} from '@/types/notificaciones';
import type {
  EventoPrevencionResumenLocal,
  MisionLocal,
} from '@/types/offline';

function esAlertaSinteticaPrevencion(notificacionId?: string | null): boolean {
  return typeof notificacionId === 'string' && notificacionId.startsWith('prev-');
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
  const esPrevencion = alerta.tipoMision?.toUpperCase() === 'PREVENCION';
  const eventoResumen: EventoPrevencionResumenLocal | undefined =
    alerta.eventoPrevencionId || alerta.eventoPrevencionNombre
      ? {
          id: alerta.eventoPrevencionId || '',
          codigo: alerta.eventoPrevencionCodigo || alerta.codigo,
          nombre:
            alerta.eventoPrevencionNombre ||
            alerta.tipoAfectacion ||
            `Misión ${alerta.codigo}`,
        }
      : undefined;

  return {
    id: alerta.misionId,
    incidenteId: alerta.incidenteId || '',
    codigoIncidente:
      alerta.incidenteCodigo || alerta.eventoPrevencionCodigo || alerta.codigo,
    tipoMision: alerta.tipoMision,
    tipologia:
      alerta.tipoAfectacion ||
      alerta.eventoPrevencionNombre ||
      (esPrevencion ? 'Prevención territorial' : 'Verificación de Incidente'),
    direccion: alerta.direccion || 'Comuna de Valdivia',
    prioridad: alerta.prioridad,
    estado: 'DESPACHADA',
    fechaDespacho: alerta.asignadoEn,
    fechaInicio: null,
    sincronizacionPendiente: false,
    datosAdicionales: {
      titulo:
        alerta.eventoPrevencionNombre ||
        alerta.tipoAfectacion ||
        `Misión ${alerta.codigo}`,
      incidenteFolio: alerta.incidenteFolio,
      notificacionId: alerta.notificacionId,
      tipoMision: alerta.tipoMision,
      patrullaId: alerta.patrullaId,
      ...(esPrevencion ? { estadoPatrulla: 'EN_PREVENCION' } : {}),
      ...(alerta.eventoPrevencionId
        ? { eventoPrevencionId: alerta.eventoPrevencionId }
        : {}),
      ...(eventoResumen ? { eventoPrevencion: eventoResumen } : {}),
      ...(Array.isArray(alerta.recursosAsignados)
        ? { recursosPrevencion: alerta.recursosAsignados }
        : {}),
    },
    actualizadoEn: new Date().toISOString(),
  };
}

/**
 * Convierte el payload del evento WebSocket `prevencion:actualizada` (HU-33)
 * en una alerta operativa de terreno con clave de deduplicación determinista.
 */
export function mapearPrevencionAAlerta(
  payload: PrevencionActualizadaPayload,
  fallbackPatrullaId = ''
): MisionAsignadaAlerta | null {
  if (!payload?.mision?.id) return null;

  const eventoId = payload.evento?.id ?? payload.id ?? null;
  const eventoCodigo = payload.evento?.codigo ?? payload.codigo ?? null;
  const eventoNombre =
    payload.evento?.nombre ?? payload.nombre ?? payload.mision.titulo;
  const recursos = normalizarRecursosPrevencion(
    payload.recursos,
    payload.mision.id
  );
  const direccion =
    payload.evento?.direccionTexto ||
    payload.evento?.sector ||
    payload.evento?.delegacionNombre ||
    'Comuna de Valdivia';

  return {
    notificacionId: `prev-${payload.mision.id}`,
    misionId: payload.mision.id,
    codigo: payload.mision.codigo,
    tipoMision: payload.mision.tipoMision || 'PREVENCION',
    patrullaId: payload.patrulla?.id || fallbackPatrullaId,
    incidenteId: null,
    incidenteCodigo: eventoCodigo,
    incidenteFolio: null,
    tipoAfectacion: eventoNombre,
    direccion,
    prioridad: payload.mision.prioridad || payload.evento?.prioridad || 'MEDIA',
    asignadoEn: payload.asignadoEn || new Date().toISOString(),
    eventoPrevencionId: eventoId,
    eventoPrevencionCodigo: eventoCodigo,
    eventoPrevencionNombre: eventoNombre,
    recursosAsignados: recursos,
    esEventoSinteticoPrevencion: true,
  };
}

/**
 * Procesa el evento WebSocket `prevencion:actualizada` (HU-33):
 * 1. Deduplica por misión (`prev-${mision.id}`).
 * 2. Persiste misión `PREVENCION` y recursos asignados en IndexedDB para uso offline.
 * 3. No emite ACK HTTP remoto porque el evento no porta UUID de `notificacion_terreno`.
 */
export async function procesarPrevencionActualizada(
  payload: PrevencionActualizadaPayload,
  fallbackPatrullaId = ''
): Promise<{
  esDuplicado: boolean;
  alerta: MisionAsignadaAlerta;
  mision: MisionLocal;
} | null> {
  const alerta = mapearPrevencionAAlerta(payload, fallbackPatrullaId);
  if (!alerta) return null;

  const duplicado = await esNotificacionDuplicada(alerta.notificacionId);
  const baseMision = mapearAlertaAMisionLocal(alerta);

  const eventoCompleto: EventoPrevencionResumenLocal | undefined = payload.evento
    ? {
        id: payload.evento.id,
        codigo: payload.evento.codigo,
        nombre: payload.evento.nombre,
        descripcion: payload.evento.descripcion ?? null,
        sector: payload.evento.sector ?? null,
        direccionTexto: payload.evento.direccionTexto ?? null,
        estado: payload.evento.estado ?? null,
        prioridad: payload.evento.prioridad ?? null,
        latitud: payload.evento.latitud ?? null,
        longitud: payload.evento.longitud ?? null,
        delegacionNombre: payload.evento.delegacionNombre ?? null,
      }
    : (baseMision.datosAdicionales?.eventoPrevencion as
        | EventoPrevencionResumenLocal
        | undefined);

  const mision: MisionLocal = {
    ...baseMision,
    ...(payload.evento?.latitud != null && payload.evento?.longitud != null
      ? {
          coordenadas: {
            lat: payload.evento.latitud,
            lng: payload.evento.longitud,
          },
        }
      : {}),
    datosAdicionales: {
      ...baseMision.datosAdicionales,
      estadoPatrulla: payload.patrulla?.estado || 'EN_PREVENCION',
      ...(payload.evento?.estado
        ? { estadoEventoPrevencion: payload.evento.estado }
        : {}),
      ...(eventoCompleto ? { eventoPrevencion: eventoCompleto } : {}),
      trabajo:
        payload.evento?.descripcion ||
        payload.mision?.descripcion ||
        alerta.tipoAfectacion ||
        'Operación preventiva comunal.',
    },
  };

  if (duplicado) {
    return { esDuplicado: true, alerta, mision };
  }

  notificacionesProcesadasMemoria.add(alerta.notificacionId);

  try {
    await guardarNotificacionLocal({
      notificacionId: alerta.notificacionId,
      misionId: alerta.misionId,
      estado: 'RECIBIDA',
      procesadoEn: new Date().toISOString(),
    });
    await guardarMisionLocal(mision);
  } catch {
    // Ignorar fallo secundario en entorno sin IndexedDB
  }

  return { esDuplicado: false, alerta, mision };
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
  if (esAlertaSinteticaPrevencion(notificacionId)) {
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

  if (esAlertaSinteticaPrevencion(notificacionId)) {
    return;
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
