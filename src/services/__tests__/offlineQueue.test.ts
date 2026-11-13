import { describe, it, expect } from 'vitest';
import {
  guardarMisionesLocales,
  obtenerMisionesLocales,
  obtenerMisionLocalPorId,
  limpiarMisionesLocales,
  limpiarAlmacenamientoOffline,
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
