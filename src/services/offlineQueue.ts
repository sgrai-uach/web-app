import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AccionOutbox, MisionLocal, CatalogoLocal } from '@/types/offline';

const DB_NAME = 'sgrai_terreno_offline_db';
const DB_VERSION = 2;

export interface NotificacionLocal {
  notificacionId: string;
  misionId: string;
  estado: 'RECIBIDA' | 'LEIDA';
  procesadoEn: string;
}

interface SgraiDB extends DBSchema {
  misiones: {
    key: string;
    value: MisionLocal;
  };
  catalogos: {
    key: string;
    value: CatalogoLocal;
  };
  outbox: {
    key: string;
    value: AccionOutbox;
    indexes: { 'por-timestamp': string };
  };
  notificaciones: {
    key: string;
    value: NotificacionLocal;
  };
}

let dbPromise: Promise<IDBPDatabase<SgraiDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<SgraiDB>> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB no está disponible en este entorno.'));
  }

  if (!dbPromise) {
    dbPromise = openDB<SgraiDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('misiones')) {
          db.createObjectStore('misiones', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('catalogos')) {
          db.createObjectStore('catalogos', { keyPath: 'clave' });
        }
        if (!db.objectStoreNames.contains('outbox')) {
          const outboxStore = db.createObjectStore('outbox', { keyPath: 'id' });
          outboxStore.createIndex('por-timestamp', 'timestamp');
        }
        if (!db.objectStoreNames.contains('notificaciones')) {
          db.createObjectStore('notificaciones', { keyPath: 'notificacionId' });
        }
      },
    });
  }

  return dbPromise;
}

// ==========================================
// MISIONES
// ==========================================

export async function guardarMisionesLocales(misiones: MisionLocal[]): Promise<void> {
  const db = await getDB();
  const [existentes, outbox] = await Promise.all([
    db.getAll('misiones'),
    db.getAll('outbox'),
  ]);

  const existentesPorId = new Map<string, MisionLocal>(
    existentes.map((m) => [m.id, m])
  );

  const misionesConOutbox = new Set<string>();
  const incidentesConOutbox = new Set<string>();
  for (const accion of outbox) {
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

  const idsEntrantes = new Set(misiones.map((m) => m.id));
  const tx = db.transaction('misiones', 'readwrite');
  for (const existente of existentes) {
    if (idsEntrantes.has(existente.id)) continue;
    const tienePendienteExistente =
      Boolean(existente.sincronizacionPendiente) ||
      misionesConOutbox.has(existente.id) ||
      (Boolean(existente.incidenteId) && incidentesConOutbox.has(existente.incidenteId));
    if (!tienePendienteExistente) {
      await tx.store.delete(existente.id);
    }
  }

  for (const mision of misiones) {
    const local = existentesPorId.get(mision.id);
    const tienePendiente =
      Boolean(local?.sincronizacionPendiente) ||
      misionesConOutbox.has(mision.id) ||
      (Boolean(mision.incidenteId) && incidentesConOutbox.has(mision.incidenteId));

    if (local && tienePendiente) {
      await tx.store.put({
        ...mision,
        tipologia: local.tipologia || mision.tipologia,
        estado: local.estado || mision.estado,
        fechaInicio: local.fechaInicio ?? mision.fechaInicio,
        sincronizacionPendiente: true,
        datosAdicionales: {
          ...mision.datosAdicionales,
          ...local.datosAdicionales,
        },
        actualizadoEn: local.actualizadoEn || mision.actualizadoEn,
      });
    } else {
      await tx.store.put(mision);
    }
  }
  await tx.done;
}

export async function limpiarMisionesLocales(): Promise<void> {
  const db = await getDB();
  await db.clear('misiones');
}

export async function limpiarAlmacenamientoOffline(): Promise<void> {
  const db = await getDB();
  await db.clear('misiones');
  await db.clear('outbox');
}

export async function guardarMisionLocal(mision: MisionLocal): Promise<void> {
  const db = await getDB();
  await db.put('misiones', mision);
}

export async function obtenerMisionesLocales(): Promise<MisionLocal[]> {
  const db = await getDB();
  return db.getAll('misiones');
}

export async function obtenerMisionLocalPorId(id: string): Promise<MisionLocal | undefined> {
  const db = await getDB();
  return db.get('misiones', id);
}

// ==========================================
// CATÁLOGOS
// ==========================================

export async function guardarCatalogoLocal(clave: string, datos: unknown[]): Promise<void> {
  const db = await getDB();
  await db.put('catalogos', {
    clave,
    datos,
    actualizadoEn: new Date().toISOString(),
  });
}

export async function obtenerCatalogoLocal<T = unknown>(clave: string): Promise<T[] | null> {
  const db = await getDB();
  const item = await db.get('catalogos', clave);
  return item ? (item.datos as T[]) : null;
}

// ==========================================
// COLA OUTBOX (MUTACIONES OFFLINE)
// ==========================================

export async function encolarAccionOutbox(
  accion: Omit<AccionOutbox, 'id' | 'timestamp' | 'intentos'>
): Promise<AccionOutbox> {
  const db = await getDB();
  const existentes = await obtenerAccionesOutbox();
  const duplicada = existentes.find(
    (item) => item.tipo === accion.tipo && item.url === accion.url
  );

  if (duplicada) {
    const actualizada: AccionOutbox = {
      ...duplicada,
      payload: accion.payload,
      timestamp: new Date().toISOString(),
    };
    await db.put('outbox', actualizada);
    return actualizada;
  }

  const nuevaAccion: AccionOutbox = {
    ...accion,
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `outbox-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    intentos: 0,
  };

  await db.put('outbox', nuevaAccion);
  return nuevaAccion;
}

export async function obtenerAccionesOutbox(): Promise<AccionOutbox[]> {
  const db = await getDB();
  return db.getAllFromIndex('outbox', 'por-timestamp');
}

export async function eliminarAccionOutbox(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('outbox', id);
}

export async function incrementarIntentoOutbox(id: string, errorMensaje?: string): Promise<void> {
  const db = await getDB();
  const accion = await db.get('outbox', id);
  if (accion) {
    accion.intentos += 1;
    accion.errorUltimoIntento = errorMensaje;
    await db.put('outbox', accion);
  }
}

export async function contarAccionesPendientes(): Promise<number> {
  try {
    const db = await getDB();
    return db.count('outbox');
  } catch {
    return 0;
  }
}

function obtenerClaveCausalAccion(accion: AccionOutbox): string | null {
  const payloadMisionId = accion.payload?.misionId;
  if (typeof payloadMisionId === 'string' && payloadMisionId) {
    return `mision:${payloadMisionId}`;
  }
  const matchMision = accion.url.match(/\/api\/misiones\/([^/]+)/);
  if (matchMision?.[1]) {
    return `mision:${matchMision[1]}`;
  }
  const matchIncidente = accion.url.match(/\/api\/incidentes\/([^/]+)/);
  if (matchIncidente?.[1]) {
    return `incidente:${matchIncidente[1]}`;
  }
  return null;
}

/**
 * Procesa y sincroniza la cola de acciones pendientes con el servidor,
 * respetando el orden causal por misión para evitar ejecutar acciones dependientes
 * cuando una mutación previa falla.
 */
export async function sincronizarColaOutbox(
  ejecutorHttp: (accion: AccionOutbox) => Promise<boolean>
): Promise<{ total: number; exitosas: number; fallidas: number }> {
  const acciones = await obtenerAccionesOutbox();
  let exitosas = 0;
  let fallidas = 0;
  const clavesBloqueadas = new Set<string>();

  for (const accion of acciones) {
    const claveCausal = obtenerClaveCausalAccion(accion);
    if (claveCausal && clavesBloqueadas.has(claveCausal)) {
      fallidas += 1;
      continue;
    }

    try {
      const ok = await ejecutorHttp(accion);
      if (ok) {
        await eliminarAccionOutbox(accion.id);
        exitosas += 1;
      } else {
        if (claveCausal) clavesBloqueadas.add(claveCausal);
        await incrementarIntentoOutbox(accion.id, 'Respuesta HTTP no exitosa');
        fallidas += 1;
      }
    } catch (err) {
      if (claveCausal) clavesBloqueadas.add(claveCausal);
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido al enviar mutación';
      await incrementarIntentoOutbox(accion.id, errorMsg);
      fallidas += 1;
    }
  }

  return { total: acciones.length, exitosas, fallidas };
}

// ==========================================
// NOTIFICACIONES Y ACKS
// ==========================================

export async function guardarNotificacionLocal(notificacion: NotificacionLocal): Promise<void> {
  const db = await getDB();
  await db.put('notificaciones', notificacion);
}

export async function obtenerNotificacionLocal(
  notificacionId: string
): Promise<NotificacionLocal | undefined> {
  const db = await getDB();
  return db.get('notificaciones', notificacionId);
}

export async function obtenerNotificacionesLocales(): Promise<NotificacionLocal[]> {
  const db = await getDB();
  return db.getAll('notificaciones');
}

