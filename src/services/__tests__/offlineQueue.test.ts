import { describe, it, expect } from 'vitest';
import {
  guardarMisionesLocales,
  obtenerMisionesLocales,
  obtenerMisionLocalPorId,
  guardarMisionLocal,
  limpiarMisionesLocales,
  limpiarAlmacenamientoOffline,
  obtenerEvaluacionMisionCache,
  guardarCatalogoLocal,
  obtenerCatalogoLocal,
  encolarAccionOutbox,
  obtenerAccionesOutbox,
  eliminarAccionOutbox,
  contarAccionesPendientes,
  sincronizarColaOutbox,
} from '../offlineQueue';
import type { MisionLocal } from '@/types/offline';

describe('offlineQueue (IndexedDB Offline Store)', () => {
  const misionEjemplo: MisionLocal = {
    id: 'mision-01',
    incidenteId: 'inc-01',
    codigoIncidente: 'INC-2026-0001',
    tipologia: 'CAIDA_ARBOL',
    direccion: 'Av. Alemania 450, Valdivia',
    coordenadas: { lat: -39.81, lng: -73.24 },
    prioridad: 'ALTA',
    estado: 'ASIGNADA',
    fechaDespacho: '2026-10-27T10:00:00Z',
    actualizadoEn: '2026-10-27T10:00:00Z',
  };

  it('guarda y recupera misiones en IndexedDB', async () => {
    await guardarMisionesLocales([misionEjemplo]);
    const mision = await obtenerMisionLocalPorId('mision-01');
    expect(mision).toBeDefined();
    expect(mision?.codigoIncidente).toBe('INC-2026-0001');

    const lista = await obtenerMisionesLocales();
    expect(lista.length).toBeGreaterThanOrEqual(1);
  });

  it('guarda y recupera catálogos en IndexedDB', async () => {
    const tipologias = [
      { id: '1', nombre: 'Árbol Caído' },
      { id: '2', nombre: 'Inundación' },
    ];
    await guardarCatalogoLocal('tipologias', tipologias);

    const recuperadas = await obtenerCatalogoLocal('tipologias');
    expect(recuperadas).toEqual(tipologias);
  });

  it('encola acciones en outbox y reporta conteo de pendientes', async () => {
    const accion = await encolarAccionOutbox({
      tipo: 'ACEPTAR_MISION',
      url: '/api/misiones/mision-01/aceptar',
      metodo: 'POST',
      payload: { misionId: 'mision-01' },
    });

    expect(accion.id).toBeDefined();
    expect(accion.intentos).toBe(0);

    const pendientes = await contarAccionesPendientes();
    expect(pendientes).toBeGreaterThan(0);

    const listaOutbox = await obtenerAccionesOutbox();
    expect(listaOutbox.some((a) => a.id === accion.id)).toBe(true);

    await eliminarAccionOutbox(accion.id);
  });

  it('sincroniza cola procesando y eliminando mutaciones exitosas', async () => {
    const accion1 = await encolarAccionOutbox({
      tipo: 'REPORTAR_LLEGADA',
      url: '/api/misiones/mision-01/llegada',
      metodo: 'POST',
      payload: { lat: -39.81, lng: -73.24 },
    });

    const resultado = await sincronizarColaOutbox(async (item) => {
      return item.id === accion1.id;
    });

    expect(resultado.exitosas).toBeGreaterThanOrEqual(1);
    const listaActual = await obtenerAccionesOutbox();
    expect(listaActual.some((a) => a.id === accion1.id)).toBe(false);
  });

  it('preserva evaluaciones cacheadas de misión ante limpiarAlmacenamientoOffline y las refusiona al guardar misiones', async () => {
    const misionConEvaluaciones: MisionLocal = {
      ...misionEjemplo,
      id: 'mision-cambio-usuario',
      tipologia: 'Inundación',
      estado: 'EN_CURSO',
      datosAdicionales: {
        tipologiaEvaluada: true,
        esReclasificacion: true,
        justificacionTipologia: 'Desborde verificado en terreno.',
        evaluadorTipologia: {
          id: 'usr-patrulla-1',
          nombre: 'Patrulla Uno',
          email: 'patrulla@valdivia.cl',
        },
        prioridadEvaluada: true,
        versionReportePrioridad: 1,
      },
    };

    await guardarMisionLocal(misionConEvaluaciones);
    expect(obtenerEvaluacionMisionCache('mision-cambio-usuario')?.tipologiaEvaluada).toBe(true);

    // Simula logout() del primer usuario
    await limpiarAlmacenamientoOffline();
    expect(await obtenerMisionLocalPorId('mision-cambio-usuario')).toBeUndefined();
    expect(obtenerEvaluacionMisionCache('mision-cambio-usuario')?.prioridadEvaluada).toBe(true);

    // Simula login de patrulla2@valdivia.cl y sincronización resumida desde GET /api/misiones
    await guardarMisionesLocales([
      {
        ...misionEjemplo,
        id: 'mision-cambio-usuario',
        tipologia: 'Caída de árbol',
        estado: 'EN_CURSO',
      },
    ]);

    const restaurada = await obtenerMisionLocalPorId('mision-cambio-usuario');
    expect(restaurada?.tipologia).toBe('Inundación');
    expect(restaurada?.datosAdicionales?.tipologiaEvaluada).toBe(true);
    expect(restaurada?.datosAdicionales?.prioridadEvaluada).toBe(true);
    expect(restaurada?.datosAdicionales?.evaluadorTipologia).toEqual({
      id: 'usr-patrulla-1',
      nombre: 'Patrulla Uno',
      email: 'patrulla@valdivia.cl',
    });
  });

  it('deduplica acciones en outbox con mismo tipo y url (BUG-H36-PWA-04)', async () => {
    const primera = await encolarAccionOutbox({
      tipo: 'ACEPTAR_MISION',
      url: '/api/misiones/mision-dup/aceptar',
      metodo: 'POST',
      payload: { latitud: -39.81, longitud: -73.24 },
    });

    const segunda = await encolarAccionOutbox({
      tipo: 'ACEPTAR_MISION',
      url: '/api/misiones/mision-dup/aceptar',
      metodo: 'POST',
      payload: { latitud: -39.82, longitud: -73.25 },
    });

    expect(segunda.id).toBe(primera.id);
    const accionesMismoTipoUrl = (await obtenerAccionesOutbox()).filter(
      (a) => a.tipo === 'ACEPTAR_MISION' && a.url === '/api/misiones/mision-dup/aceptar'
    );
    expect(accionesMismoTipoUrl).toHaveLength(1);
    expect(accionesMismoTipoUrl[0].payload).toEqual({ latitud: -39.82, longitud: -73.25 });

    await eliminarAccionOutbox(primera.id);
  });

  it('limpia almacenamiento offline y misiones locales correctamente', async () => {
    await guardarMisionesLocales([misionEjemplo]);
    await encolarAccionOutbox({
      tipo: 'RECHAZAR_MISION',
      url: '/api/misiones/mision-01/rechazar',
      metodo: 'POST',
      payload: { justificacion_rechazo: 'Falla mecánica' },
    });

    await limpiarMisionesLocales();
    const misiones = await obtenerMisionesLocales();
    expect(misiones.length).toBe(0);

    await limpiarAlmacenamientoOffline();
    const pendientes = await contarAccionesPendientes();
    expect(pendientes).toBe(0);
  });

});
