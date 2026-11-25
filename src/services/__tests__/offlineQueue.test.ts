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

  it('preserva misión EN_CURSO con ACTUALIZAR_TIPOLOGIA en outbox y elimina obsoletas sin pendientes en guardarMisionesLocales (BUG-H37-PWA-03)', async () => {
    const misionObsoleta: MisionLocal = {
      ...misionEjemplo,
      id: 'mision-obsoleta-01',
      incidenteId: 'inc-obsoleto-01',
      estado: 'FINALIZADA',
      sincronizacionPendiente: false,
    };
    const misionEnCursoPendiente: MisionLocal = {
      ...misionEjemplo,
      id: 'mision-en-curso-tip-01',
      incidenteId: 'inc-en-curso-tip-01',
      estado: 'EN_CURSO',
      tipologia: 'Inundación',
      sincronizacionPendiente: true,
      datosAdicionales: { tipologiaEvaluada: true },
    };

    await guardarMisionesLocales([misionObsoleta, misionEnCursoPendiente]);
    const accion = await encolarAccionOutbox({
      tipo: 'ACTUALIZAR_TIPOLOGIA',
      url: '/api/incidentes/inc-en-curso-tip-01/tipologia',
      metodo: 'PATCH',
      payload: {
        misionId: 'mision-en-curso-tip-01',
        tipoIncidenteId: '40000000-0000-4000-8000-000000000001',
        justificacion: 'Inundación constatada en terreno',
      },
    });

    // Sincronización trae versión remota desactualizada y ya no incluye misionObsoleta
    await guardarMisionesLocales([
      {
        ...misionEnCursoPendiente,
        tipologia: 'Caída de árbol',
        sincronizacionPendiente: false,
        datosAdicionales: { trabajo: 'Remoto' },
      },
    ]);

    const obsoleta = await obtenerMisionLocalPorId('mision-obsoleta-01');
    const preservada = await obtenerMisionLocalPorId('mision-en-curso-tip-01');

    expect(obsoleta).toBeUndefined();
    expect(preservada?.estado).toBe('EN_CURSO');
    expect(preservada?.tipologia).toBe('Inundación');
    expect(preservada?.sincronizacionPendiente).toBe(true);
    expect(preservada?.datosAdicionales?.tipologiaEvaluada).toBe(true);

    await eliminarAccionOutbox(accion.id);
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

  it('preserva prioridad optimista y reportes locales en guardarMisionesLocales si existe AJUSTAR_PRIORIDAD en outbox (BUG-INT-PWA-09)', async () => {
    const misionPrioridadPendiente: MisionLocal = {
      ...misionEjemplo,
      id: 'mision-prio-pendiente-01',
      incidenteId: 'inc-prio-pendiente-01',
      estado: 'EN_CURSO',
      prioridad: 'CRITICA',
      sincronizacionPendiente: true,
      datosAdicionales: {
        prioridadEvaluada: true,
        versionReportePrioridad: 1,
        reportesPrioridad: [{ versionReporte: 1, prioridadAsignada: 'CRITICA', sincronizado: false }],
      },
    };

    await guardarMisionesLocales([misionPrioridadPendiente]);
    const accion = await encolarAccionOutbox({
      tipo: 'AJUSTAR_PRIORIDAD',
      url: '/api/incidentes/inc-prio-pendiente-01/prioridad',
      metodo: 'PATCH',
      payload: {
        misionId: 'mision-prio-pendiente-01',
        prioridad: 'CRITICA',
      },
    });

    await guardarMisionesLocales([
      {
        ...misionPrioridadPendiente,
        prioridad: 'MEDIA',
        sincronizacionPendiente: false,
        datosAdicionales: { trabajo: 'Remoto desactualizado' },
      },
    ]);

    const recuperada = await obtenerMisionLocalPorId('mision-prio-pendiente-01');
    expect(recuperada?.prioridad).toBe('CRITICA');
    expect(recuperada?.sincronizacionPendiente).toBe(true);
    expect(recuperada?.datosAdicionales?.prioridadEvaluada).toBe(true);

    await eliminarAccionOutbox(accion.id);
  });

  it('garantiza orden causal FIFO determinista en outbox aunque se encolen múltiples mutaciones en el mismo milisegundo (BUG-INT-PWA-12)', async () => {
    const misionId = 'mision-fifo-01';
    const a1 = await encolarAccionOutbox({
      tipo: 'ACEPTAR_MISION',
      url: `/api/misiones/${misionId}/aceptar`,
      metodo: 'POST',
      payload: { misionId },
    });
    const a2 = await encolarAccionOutbox({
      tipo: 'ACTUALIZAR_TIPOLOGIA',
      url: '/api/incidentes/inc-fifo-01/tipologia',
      metodo: 'PATCH',
      payload: { misionId },
    });
    const a3 = await encolarAccionOutbox({
      tipo: 'AJUSTAR_PRIORIDAD',
      url: '/api/incidentes/inc-fifo-01/prioridad',
      metodo: 'PATCH',
      payload: { misionId, prioridad: 'CRITICA' },
    });

    const ordenadas = (await obtenerAccionesOutbox()).filter((a) =>
      [a1.id, a2.id, a3.id].includes(a.id)
    );
    expect(ordenadas.map((a) => a.tipo)).toEqual([
      'ACEPTAR_MISION',
      'ACTUALIZAR_TIPOLOGIA',
      'AJUSTAR_PRIORIDAD',
    ]);
    expect(Date.parse(a1.timestamp)).toBeLessThan(Date.parse(a2.timestamp));
    expect(Date.parse(a2.timestamp)).toBeLessThan(Date.parse(a3.timestamp));

    await eliminarAccionOutbox(a1.id);
    await eliminarAccionOutbox(a2.id);
    await eliminarAccionOutbox(a3.id);
  });

});
