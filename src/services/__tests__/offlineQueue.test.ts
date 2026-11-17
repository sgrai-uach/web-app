import { describe, it, expect } from 'vitest';
import {
  guardarMisionesLocales,
  obtenerMisionesLocales,
  obtenerMisionLocalPorId,
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

  it('respeta el orden causal por misión en sincronizarColaOutbox si una acción previa falla', async () => {
    const misionId = 'mision-causal-01';
    const aceptar = await encolarAccionOutbox({
      tipo: 'ACEPTAR_MISION',
      url: `/api/misiones/${misionId}/aceptar`,
      metodo: 'POST',
      payload: { misionId },
    });
    const tipificar = await encolarAccionOutbox({
      tipo: 'ACTUALIZAR_TIPOLOGIA',
      url: '/api/incidentes/inc-causal-01/tipologia',
      metodo: 'PATCH',
      payload: {
        misionId,
        tipoIncidenteId: '40000000-0000-4000-8000-000000000001',
        justificacion: 'Cambio tras llegada',
      },
    });

    const ejecutadas: string[] = [];
    await sincronizarColaOutbox(async (accion) => {
      ejecutadas.push(accion.id);
      return accion.id !== aceptar.id;
    });

    expect(ejecutadas).toContain(aceptar.id);
    expect(ejecutadas).not.toContain(tipificar.id);

    await eliminarAccionOutbox(aceptar.id);
    await eliminarAccionOutbox(tipificar.id);
  });

  it('preserva cambios locales pendientes en guardarMisionesLocales si hay acciones en outbox', async () => {
    const misionLocalPendiente: MisionLocal = {
      ...misionEjemplo,
      id: 'mision-pendiente-01',
      incidenteId: 'inc-pendiente-01',
      tipologia: 'Inundación',
      sincronizacionPendiente: true,
      datosAdicionales: { tipologiaEvaluada: true },
    };
    await guardarMisionesLocales([misionLocalPendiente]);
    const accion = await encolarAccionOutbox({
      tipo: 'ACTUALIZAR_TIPOLOGIA',
      url: '/api/incidentes/inc-pendiente-01/tipologia',
      metodo: 'PATCH',
      payload: { misionId: 'mision-pendiente-01' },
    });

    await guardarMisionesLocales([
      {
        ...misionLocalPendiente,
        tipologia: 'Caída de árbol',
        sincronizacionPendiente: false,
        datosAdicionales: { trabajo: 'Remoto' },
      },
    ]);

    const recuperada = await obtenerMisionLocalPorId('mision-pendiente-01');
    expect(recuperada?.tipologia).toBe('Inundación');
    expect(recuperada?.sincronizacionPendiente).toBe(true);
    expect(recuperada?.datosAdicionales?.tipologiaEvaluada).toBe(true);

    await eliminarAccionOutbox(accion.id);
  });
});
