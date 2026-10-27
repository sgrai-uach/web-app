import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AccionOutbox, MisionLocal, CatalogoLocal } from '@/types/offline';

const DB_NAME = 'sgrai_terreno_offline_db';
const DB_VERSION = 1;

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
  const tx = db.transaction('misiones', 'readwrite');
  for (const mision of misiones) {
    await tx.store.put(mision);
  }
  await tx.done;
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

/**
 * Procesa y sincroniza la cola de acciones pendientes con el servidor.
 */
export async function sincronizarColaOutbox(
  ejecutorHttp: (accion: AccionOutbox) => Promise<boolean>
): Promise<{ total: number; exitosas: number; fallidas: number }> {
  const acciones = await obtenerAccionesOutbox();
  let exitosas = 0;
  let fallidas = 0;

  for (const accion of acciones) {
    try {
      const ok = await ejecutorHttp(accion);
      if (ok) {
        await eliminarAccionOutbox(accion.id);
        exitosas += 1;
      } else {
        await incrementarIntentoOutbox(accion.id, 'Respuesta HTTP no exitosa');
        fallidas += 1;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido al enviar mutación';
      await incrementarIntentoOutbox(accion.id, errorMsg);
      fallidas += 1;
    }
  }

  return { total: acciones.length, exitosas, fallidas };
}
