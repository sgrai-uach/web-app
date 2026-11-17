import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AccionOutbox, MisionLocal, CatalogoLocal } from '@/types/offline';

const DB_NAME = 'sgrai_terreno_offline_db';
const DB_VERSION = 1;
const CLAVE_CACHE_EVALUACIONES_MISION = 'sgrai_evaluaciones_mision_v1';

const CLAVES_EVALUACION_CACHEABLES = [
  'tipologiaConstatada',
  'tipologiaEvaluada',
  'tipoIncidenteId',
  'justificacionTipologia',
  'fechaEvaluacionTipologia',
  'esReclasificacion',
  'evaluadorTipologia',
  'hitoReclasificacion',
  'prioridadEvaluada',
  'prioridadSugerida',
  'justificacionPrioridad',
  'versionReportePrioridad',
  'ultimoReportePrioridad',
  'reportesPrioridad',
  'reportesTerreno',
  'personasAfectadasPrevias',
  'reporteVerificacion',
  'reporteVerificacionEnviado',
  'reporteVerificacionEnviadoEn',
  'dictamenVerificacion',
] as const;

function leerMapaCacheEvaluaciones(): Record<string, Record<string, unknown>> {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(CLAVE_CACHE_EVALUACIONES_MISION);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, Record<string, unknown>>;
    }
  } catch {
    // Ignorar fallo de lectura/parseo en localStorage
  }
  return {};
}

function escribirMapaCacheEvaluaciones(
  mapa: Record<string, Record<string, unknown>>
): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(CLAVE_CACHE_EVALUACIONES_MISION, JSON.stringify(mapa));
  } catch {
    // Ignorar error de almacenamiento si localStorage no permite escritura
  }
}

function tieneDatosEvaluacion(datos?: Record<string, unknown>): boolean {
  if (!datos) return false;
  return Boolean(
    datos.tipologiaEvaluada ||
      datos.prioridadEvaluada ||
      datos.reporteVerificacionEnviado ||
      datos.reporteVerificacion ||
      datos.ultimoReportePrioridad ||
      (Array.isArray(datos.reportesPrioridad) && datos.reportesPrioridad.length > 0) ||
      (Array.isArray(datos.reportesTerreno) && datos.reportesTerreno.length > 0)
  );
}

/**
 * Persiste en almacenamiento ligero (`localStorage`) los metadatos de evaluación de una misión
 * (categorización HU-37, prioridad HU-38 y cierre HU-39) para sobrevivir cambios de usuario.
 */
export function guardarEvaluacionMisionCache(
  misionId: string,
  datosAdicionales?: Record<string, unknown>
): void {
  if (!misionId || !tieneDatosEvaluacion(datosAdicionales)) return;
  const mapa = leerMapaCacheEvaluaciones();
  const previo = mapa[misionId] || {};
  const extracto: Record<string, unknown> = { ...previo };

  for (const clave of CLAVES_EVALUACION_CACHEABLES) {
    const valor = datosAdicionales?.[clave];
    if (valor !== undefined) {
      if (
        (clave === 'reportesPrioridad' || clave === 'reportesTerreno') &&
        Array.isArray(valor) &&
        valor.length === 0 &&
        Array.isArray(previo[clave]) &&
        (previo[clave] as unknown[]).length > 0
      ) {
        continue;
      }
      extracto[clave] = valor;
    }
  }

  mapa[misionId] = extracto;
  escribirMapaCacheEvaluaciones(mapa);
}

/**
 * Recupera los metadatos de evaluación cacheados para una misión específica.
 */
export function obtenerEvaluacionMisionCache(
  misionId: string
): Record<string, unknown> | undefined {
  if (!misionId) return undefined;
  const mapa = leerMapaCacheEvaluaciones();
  const entrada = mapa[misionId];
  return entrada && typeof entrada === 'object' ? { ...entrada } : undefined;
}

/**
 * Fusiona los metadatos de evaluación previos (IndexedDB y/o caché ligero) sobre una `MisionLocal`
 * sin sobrescribir información autoritativa más reciente ya presente en la misión entrante.
 */
export function fusionarDatosAdicionalesMision(
  mision: MisionLocal,
  previos?: Record<string, unknown>
): MisionLocal {
  const desdeCache = obtenerEvaluacionMisionCache(mision.id);
  const combinadosPrevios: Record<string, unknown> = {
    ...(desdeCache || {}),
    ...(previos || {}),
  };

  if (Object.keys(combinadosPrevios).length === 0) {
    return mision;
  }

  const actuales = (mision.datosAdicionales || {}) as Record<string, unknown>;
  const fusionados: Record<string, unknown> = {
    ...combinadosPrevios,
    ...actuales,
  };

  for (const claveLista of ['reportesPrioridad', 'reportesTerreno'] as const) {
    const listaActual = actuales[claveLista];
    const listaPrevia = combinadosPrevios[claveLista];
    if (
      (!Array.isArray(listaActual) || listaActual.length === 0) &&
      Array.isArray(listaPrevia) &&
      listaPrevia.length > 0
    ) {
      fusionados[claveLista] = listaPrevia;
    }
  }

  if (combinadosPrevios.tipologiaEvaluada === true && actuales.tipologiaEvaluada === undefined) {
    fusionados.tipologiaEvaluada = true;
  }
  if (combinadosPrevios.prioridadEvaluada === true && actuales.prioridadEvaluada === undefined) {
    fusionados.prioridadEvaluada = true;
  }
  if (
    combinadosPrevios.reporteVerificacionEnviado === true &&
    actuales.reporteVerificacionEnviado === undefined
  ) {
    fusionados.reporteVerificacionEnviado = true;
  }

  const tipologiaConstatada =
    typeof combinadosPrevios.tipologiaConstatada === 'string'
      ? combinadosPrevios.tipologiaConstatada
      : undefined;

  const tipologiaFinal =
    actuales.tipologiaEvaluada === true
      ? mision.tipologia
      : combinadosPrevios.tipologiaEvaluada === true && tipologiaConstatada
        ? tipologiaConstatada
        : mision.tipologia;

  return {
    ...mision,
    tipologia: tipologiaFinal,
    datosAdicionales: fusionados,
  };
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
    const previa = await tx.store.get(mision.id);
    const fusionada = fusionarDatosAdicionalesMision(mision, previa?.datosAdicionales);
    if (tieneDatosEvaluacion(fusionada.datosAdicionales)) {
      guardarEvaluacionMisionCache(fusionada.id, {
        ...fusionada.datosAdicionales,
        ...(fusionada.datosAdicionales?.tipologiaEvaluada && fusionada.tipologia
          ? { tipologiaConstatada: fusionada.tipologia }
          : {}),
      });
    }
    await tx.store.put(fusionada);
  }
  await tx.done;
}

export async function limpiarMisionesLocales(): Promise<void> {
  const db = await getDB();
  await db.clear('misiones');
}

export async function limpiarAlmacenamientoOffline(): Promise<void> {
  const db = await getDB();
  try {
    const misionesActuales = await db.getAll('misiones');
    for (const m of misionesActuales) {
      if (m.datosAdicionales && tieneDatosEvaluacion(m.datosAdicionales)) {
        guardarEvaluacionMisionCache(m.id, {
          ...m.datosAdicionales,
          ...(m.datosAdicionales.tipologiaEvaluada && m.tipologia
            ? { tipologiaConstatada: m.tipologia }
            : {}),
        });
      }
    }
  } catch {
    // Ignorar fallo al respaldar evaluaciones locales antes de limpiar la sesión
  }
  await db.clear('misiones');
  await db.clear('outbox');
}

export async function guardarMisionLocal(mision: MisionLocal): Promise<void> {
  const db = await getDB();
  if (tieneDatosEvaluacion(mision.datosAdicionales)) {
    guardarEvaluacionMisionCache(mision.id, {
      ...mision.datosAdicionales,
      ...(mision.datosAdicionales?.tipologiaEvaluada && mision.tipologia
        ? { tipologiaConstatada: mision.tipologia }
        : {}),
    });
  }
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
