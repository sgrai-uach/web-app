import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sincronizarMisiones,
  obtenerDetalleMision,
  rechazarMision,
  aceptarMisionPatrulla,
  validarPayloadAceptarMision,
  obtenerCoordenadasOpcionales,
  MisionServiceError,
} from '../misionesService';
import apiClient from '@/lib/api/client';
import * as offlineQueue from '@/services/offlineQueue';

vi.mock('@/lib/api/client', () => ({
  default: {
    GET: vi.fn(),
    POST: vi.fn(),
  },
}));

vi.mock('@/services/offlineQueue', () => ({
  guardarMisionesLocales: vi.fn(),
  limpiarMisionesLocales: vi.fn(),
  guardarMisionLocal: vi.fn(),
  obtenerMisionesLocales: vi.fn(),
  obtenerMisionLocalPorId: vi.fn(),
  obtenerAccionesOutbox: vi.fn(),
  encolarAccionOutbox: vi.fn(),
}));

describe('misionesService — Sincronización remota y persistencia IndexedDB (Offline-First)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(offlineQueue.obtenerAccionesOutbox).mockResolvedValue([]);
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
    });
  });

  describe('sincronizarMisiones', () => {
    it('debe obtener misiones remotas desde la API y guardarlas en IndexedDB', async () => {
      const mockApiData = {
        message: 'Listado de misiones obtenido exitosamente',
        data: [
          {
            id: 'mis-001',
            codigo: 'MIS-2026-00312',
            titulo: 'Caída de árbol en tendido',
            descripcion: 'Av. Ramón Picarte 1520',
            tipoMision: 'VERIFICACION',
            estado: 'DESPACHADA',
            prioridad: 'ALTA',
            incidenteId: 'inc-001',
            incidenteCodigo: 'INC-2026-00312',
            cuadrillaId: null,
            cuadrillaNombre: null,
            patrullaId: 'pat-001',
            patrullaNombre: 'Patrulla Alpha',
            delegacionId: 'del-001',
            delegacionNombre: 'Norte',
            fechaInicio: '2026-10-30T04:00:00Z',
            fechaCierre: null,
            creadoEn: '2026-10-30T04:00:00Z',
            actualizadoEn: '2026-10-30T04:00:00Z',
          },
        ],
        meta: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };

      vi.mocked(apiClient.GET).mockResolvedValue({
        data: mockApiData,
        error: undefined,
        response: new Response(),
      } as never);

      const resultado = await sincronizarMisiones({ tipoMision: 'VERIFICACION' });

      expect(resultado).toHaveLength(1);
      expect(resultado[0].id).toBe('mis-001');
      expect(resultado[0].codigoIncidente).toBe('INC-2026-00312');
      expect(resultado[0].prioridad).toBe('ALTA');
      expect(resultado[0].estado).toBe('DESPACHADA');
      expect(offlineQueue.guardarMisionesLocales).toHaveBeenCalledWith(resultado);
    });

    it('debe recurrir a IndexedDB local si la llamada a la API falla (modo offline)', async () => {
      vi.mocked(apiClient.GET).mockRejectedValue(new Error('Network error'));
      const mockLocales = [
        {
          id: 'local-001',
          incidenteId: 'inc-local',
          codigoIncidente: 'INC-2026-LOCAL',
          tipologia: 'DESLIZAMIENTO',
          direccion: 'Niebla Km 2',
          prioridad: 'CRITICA',
          estado: 'ASIGNADA',
          fechaDespacho: '2026-10-30T01:00:00Z',
          actualizadoEn: '2026-10-30T01:00:00Z',
        },
      ];
      vi.mocked(offlineQueue.obtenerMisionesLocales).mockResolvedValue(mockLocales);

      const resultado = await sincronizarMisiones();

      expect(resultado).toEqual(mockLocales);
      expect(offlineQueue.obtenerMisionesLocales).toHaveBeenCalled();
      expect(offlineQueue.guardarMisionesLocales).not.toHaveBeenCalled();
    });

    it('preserva tipología reclasificada offline en misión EN_CURSO sin limpiar IndexedDB cuando existe ACTUALIZAR_TIPOLOGIA en outbox (BUG-H37-PWA-03)', async () => {
      const misionLocalPendiente = {
        id: '60000000-0000-4000-8000-000000000099',
        incidenteId: 'a0000000-0000-4000-8000-000000000099',
        codigoIncidente: 'INC-2026-00999',
        tipologia: 'Inundación',
        direccion: 'Av. Ramón Picarte 2000',
        prioridad: 'ALTA',
        estado: 'EN_CURSO',
        fechaDespacho: '2026-10-30T04:00:00Z',
        fechaInicio: '2026-10-30T04:10:00Z',
        sincronizacionPendiente: true,
        datosAdicionales: {
          tipologiaEvaluada: true,
          tipoIncidenteId: '40000000-0000-4000-8000-000000000001',
          justificacionTipologia: 'Desborde de cauce verificado en terreno',
        },
        actualizadoEn: '2026-10-30T04:15:00Z',
      };

      vi.mocked(offlineQueue.obtenerMisionesLocales)
        .mockResolvedValueOnce([misionLocalPendiente])
        .mockResolvedValueOnce([misionLocalPendiente]);
      vi.mocked(offlineQueue.obtenerAccionesOutbox).mockResolvedValueOnce([
        {
          id: 'outbox-tip-1',
          tipo: 'ACTUALIZAR_TIPOLOGIA',
          url: '/api/incidentes/a0000000-0000-4000-8000-000000000099/tipologia',
          metodo: 'PATCH',
          payload: {
            misionId: '60000000-0000-4000-8000-000000000099',
            tipoIncidenteId: '40000000-0000-4000-8000-000000000001',
            justificacion: 'Desborde de cauce verificado en terreno',
          },
          timestamp: '2026-10-30T04:15:00Z',
          intentos: 0,
        },
      ]);

      vi.mocked(apiClient.GET).mockResolvedValueOnce({
        data: {
          message: 'OK',
          data: [
            {
              id: '60000000-0000-4000-8000-000000000099',
              codigo: 'MIS-2026-00999',
              titulo: 'Caída de árbol',
              descripcion: 'Av. Ramón Picarte 2000',
              tipoMision: 'VERIFICACION',
              estado: 'EN_CURSO',
              prioridad: 'ALTA',
              incidenteId: 'a0000000-0000-4000-8000-000000000099',
              incidenteCodigo: 'INC-2026-00999',
              fechaInicio: '2026-10-30T04:10:00Z',
              creadoEn: '2026-10-30T04:00:00Z',
              actualizadoEn: '2026-10-30T04:10:00Z',
            },
          ],
        },
        error: undefined,
        response: new Response(),
      } as never);

      const resultado = await sincronizarMisiones({ tipoMision: 'VERIFICACION' });

      expect(offlineQueue.limpiarMisionesLocales).not.toHaveBeenCalled();
      expect(offlineQueue.guardarMisionesLocales).toHaveBeenCalledWith([
        expect.objectContaining({
          id: '60000000-0000-4000-8000-000000000099',
          tipologia: 'Inundación',
          estado: 'EN_CURSO',
          sincronizacionPendiente: true,
          datosAdicionales: expect.objectContaining({
            tipologiaEvaluada: true,
          }),
        }),
      ]);
      expect(resultado[0].tipologia).toBe('Inundación');
      expect(resultado[0].sincronizacionPendiente).toBe(true);
      expect(resultado[0].datosAdicionales?.tipologiaEvaluada).toBe(true);
    });
  });

  describe('obtenerDetalleMision', () => {
    it('debe obtener detalle remoto de la misión y actualizar IndexedDB localmente', async () => {
      const mockDetalle = {
        message: 'Detalle de misión obtenido',
        data: {
          id: 'mis-002',
          codigo: 'MIS-2026-00315',
          titulo: 'Evaluación de anegamiento',
          descripcion: 'Verificar sumideros',
          tipoMision: 'VERIFICACION',
          estado: 'EN_CURSO',
          prioridad: 'CRITICA',
          justificacionRechazo: null,
          fechaInicio: '2026-10-30T03:30:00Z',
          fechaCierre: null,
          creadoEn: '2026-10-30T04:00:00Z',
          actualizadoEn: '2026-10-30T04:00:00Z',
          creadoPor: null,
          encargado: null,
          incidente: {
            id: 'inc-002',
            codigo: 'INC-2026-00315',
            codigoSeguimiento: 'SEG-123',
            tipoAfectacion: 'ANEGAMIENTO',
            descripcion: 'Colapso de alcantarillas',
            direccion: 'Costanera Arturo Prat 420, Valdivia',
            latitud: -39.8123,
            longitud: -73.2467,
            estado: 'VERIFICANDO',
            prioridad: 'CRITICA',
            requiereAsistenciaSocial: false,
            delegacionNombre: 'Norte',
          },
          prevencion: null,
          cuadrilla: null,
          patrulla: null,
          bitacoraTiempos: [],
          reportesTerreno: [],
        },
      };

      vi.mocked(apiClient.GET).mockResolvedValue({
        data: mockDetalle,
        error: undefined,
        response: new Response(),
      } as never);

      const detalle = await obtenerDetalleMision('mis-002');

      expect(detalle).not.toBeNull();
      expect(detalle?.id).toBe('mis-002');
      expect(detalle?.direccion).toBe('Costanera Arturo Prat 420, Valdivia');
      expect(detalle?.coordenadas).toEqual({ lat: -39.8123, lng: -73.2467 });
      expect(detalle?.tipologia).toBe('Anegamiento');
      expect(offlineQueue.guardarMisionLocal).toHaveBeenCalled();
    });

    it('debe recurrir al registro local de IndexedDB si la API remota falla', async () => {
      vi.mocked(apiClient.GET).mockRejectedValue(new Error('Network error'));
      const mockLocal = {
        id: 'mis-fallback',
        incidenteId: 'inc-fb',
        codigoIncidente: 'INC-FB-01',
        tipologia: 'CAIDA_ARBOL',
        direccion: 'Av. Alemania 600',
        prioridad: 'ALTA',
        estado: 'FINALIZADA',
        fechaDespacho: '2026-10-18T11:00:00Z',
        actualizadoEn: '2026-10-18T11:45:00Z',
      };
      vi.mocked(offlineQueue.obtenerMisionLocalPorId).mockResolvedValue(mockLocal);

      const detalle = await obtenerDetalleMision('mis-fallback');

      expect(detalle).toEqual(mockLocal);
      expect(offlineQueue.obtenerMisionLocalPorId).toHaveBeenCalledWith('mis-fallback');
    });

    it('preserva tipología reclasificada offline en obtenerDetalleMision cuando la misión ya está EN_CURSO y hay ACTUALIZAR_TIPOLOGIA en outbox (BUG-H37-PWA-03)', async () => {
      vi.mocked(offlineQueue.obtenerMisionLocalPorId).mockResolvedValueOnce({
        id: '60000000-0000-4000-8000-000000000088',
        incidenteId: 'a0000000-0000-4000-8000-000000000088',
        codigoIncidente: 'INC-2026-00888',
        tipologia: 'Inundación',
        direccion: 'Costanera 420',
        prioridad: 'ALTA',
        estado: 'EN_CURSO',
        fechaDespacho: '2026-10-30T04:00:00Z',
        fechaInicio: '2026-10-30T04:05:00Z',
        sincronizacionPendiente: true,
        datosAdicionales: {
          tipologiaEvaluada: true,
          tipoIncidenteId: '40000000-0000-4000-8000-000000000001',
          justificacionTipologia: 'Anegamiento mayor constatado',
        },
        actualizadoEn: '2026-10-30T04:20:00Z',
      });

      vi.mocked(offlineQueue.obtenerAccionesOutbox).mockResolvedValueOnce([
        {
          id: 'outbox-tip-detalle',
          tipo: 'ACTUALIZAR_TIPOLOGIA',
          url: '/api/incidentes/a0000000-0000-4000-8000-000000000088/tipologia',
          metodo: 'PATCH',
          payload: {
            misionId: '60000000-0000-4000-8000-000000000088',
            tipoIncidenteId: '40000000-0000-4000-8000-000000000001',
            justificacion: 'Anegamiento mayor constatado',
          },
          timestamp: '2026-10-30T04:20:00Z',
          intentos: 0,
        },
      ]);

      vi.mocked(apiClient.GET).mockResolvedValueOnce({
        data: {
          message: 'OK',
          data: {
            id: '60000000-0000-4000-8000-000000000088',
            codigo: 'MIS-2026-00888',
            titulo: 'Caída de árbol',
            descripcion: 'Verificar emergencia',
            tipoMision: 'VERIFICACION',
            estado: 'EN_CURSO',
            prioridad: 'ALTA',
            justificacionRechazo: null,
            fechaInicio: '2026-10-30T04:05:00Z',
            fechaCierre: null,
            creadoEn: '2026-10-30T04:00:00Z',
            actualizadoEn: '2026-10-30T04:05:00Z',
            creadoPor: null,
            encargado: null,
            incidente: {
              id: 'a0000000-0000-4000-8000-000000000088',
              codigo: 'INC-2026-00888',
              codigoSeguimiento: 'SEG-888',
              tipoAfectacion: 'CAIDA_ARBOL',
              descripcion: 'Árbol en vía pública',
              direccion: 'Costanera 420',
              latitud: -39.8123,
              longitud: -73.2467,
              estado: 'VERIFICANDO',
              prioridad: 'ALTA',
              requiereAsistenciaSocial: false,
              delegacionNombre: 'Norte',
            },
            prevencion: null,
            cuadrilla: null,
            patrulla: null,
            bitacoraTiempos: [],
            reportesTerreno: [],
          },
        },
        error: undefined,
        response: new Response(),
      } as never);

      const detalle = await obtenerDetalleMision('60000000-0000-4000-8000-000000000088');

      expect(detalle?.estado).toBe('EN_CURSO');
      expect(detalle?.tipologia).toBe('Inundación');
      expect(detalle?.sincronizacionPendiente).toBe(true);
      expect(detalle?.datosAdicionales?.tipologiaEvaluada).toBe(true);
      expect(offlineQueue.guardarMisionLocal).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '60000000-0000-4000-8000-000000000088',
          tipologia: 'Inundación',
          sincronizacionPendiente: true,
        })
      );
    });
  });

  describe('rechazarMision (H41, H69 — Regla Crítica §3.3)', () => {
    it('debe arrojar error de validación si la justificación tiene menos de 5 caracteres', async () => {
      await expect(
        rechazarMision('mis-001', {
          justificacion_rechazo: '   ', // vacío tras trim
        })
      ).rejects.toThrow('al menos 5 caracteres');

      await expect(
        rechazarMision('mis-001', {
          justificacion_rechazo: ' abc ', // 3 caracteres tras trim
        })
      ).rejects.toThrow('al menos 5 caracteres');
    });

    it('debe enviar POST a /api/misiones/{id}/rechazar cuando hay conexión', async () => {
      const mockApiResponse = {
        data: {
          message: 'Misión rechazada exitosamente.',
          data: {
            mision: {
              id: 'mis-001',
              codigo: 'MIS-2026-8341',
              estado: 'RECHAZADA',
              justificacionRechazo: 'Desperfecto mecánico en vehículo',
              actualizadoEn: '2026-11-03T18:45:00.000Z',
            },
            patrulla: {
              id: 'pat-001',
              nombre: 'Patrulla 1',
              estado: 'DISPONIBLE',
            },
            incidente: {
              id: 'inc-001',
              codigo: 'INC-2026-1042',
              estado: 'REPORTADO',
            },
            hito: {
              id: 'hit-001',
              hito: 'RECHAZADA',
              descripcion: 'Misión rechazada por patrulla',
              creadoEn: '2026-11-03T18:45:00.000Z',
            },
          },
        },
        error: null,
        response: { ok: true, status: 200 } as Response,
      };

      vi.mocked(apiClient.POST).mockResolvedValue(mockApiResponse as never);
      vi.mocked(offlineQueue.obtenerMisionLocalPorId).mockResolvedValue({
        id: 'mis-001',
        incidenteId: 'inc-001',
        codigoIncidente: 'INC-2026-1042',
        tipologia: 'Caída de árbol',
        direccion: 'Av. Ramón Picarte',
        prioridad: 'ALTA',
        estado: 'DESPACHADA',
        fechaDespacho: '2026-11-03T18:00:00.000Z',
        actualizadoEn: '2026-11-03T18:00:00.000Z',
      });

      const res = await rechazarMision('mis-001', {
        justificacion_rechazo: 'Desperfecto mecánico en vehículo',
        latitud: -39.8142,
        longitud: -73.2458,
      });

      expect(res.exito).toBe(true);
      expect(apiClient.POST).toHaveBeenCalledWith(
        '/api/misiones/{id}/rechazar',
        expect.objectContaining({
          params: expect.objectContaining({
            path: { id: 'mis-001' },
          }),
          body: {
            justificacion_rechazo: 'Desperfecto mecánico en vehículo',
            latitud: -39.8142,
            longitud: -73.2458,
          },
        })
      );
      expect(offlineQueue.guardarMisionLocal).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'mis-001',
          estado: 'RECHAZADA',
        })
      );
    });

    it('debe arrojar error cuando el backend retorna 400 Bad Request o 409 Conflict', async () => {
      vi.mocked(apiClient.POST).mockResolvedValue({
        data: null,
        error: { message: 'La misión no se encuentra en estado DESPACHADA.' },
        response: { ok: false, status: 409 } as Response,
      } as never);

      await expect(
        rechazarMision('mis-001', {
          justificacion_rechazo: 'Emergencia prioritaria en otro sector',
        })
      ).rejects.toThrow('La misión no se encuentra en estado DESPACHADA.');
    });

    it('debe encolar en outbox y actualizar estado local cuando el dispositivo está offline', async () => {
      const originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      vi.mocked(offlineQueue.obtenerMisionLocalPorId).mockResolvedValue({
        id: 'mis-001',
        incidenteId: 'inc-001',
        codigoIncidente: 'INC-2026-1042',
        tipologia: 'Caída de árbol',
        direccion: 'Av. Ramón Picarte',
        prioridad: 'ALTA',
        estado: 'DESPACHADA',
        fechaDespacho: '2026-11-03T18:00:00.000Z',
        actualizadoEn: '2026-11-03T18:00:00.000Z',
      });

      const res = await rechazarMision('mis-001', {
        justificacion_rechazo: 'Corte de ruta total por derrumbe',
      });

      expect(res.exito).toBe(true);
      expect(res.modoOffline).toBe(true);
      expect(offlineQueue.encolarAccionOutbox).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'RECHAZAR_MISION',
          url: '/api/misiones/mis-001/rechazar',
          metodo: 'POST',
          payload: {
            justificacion_rechazo: 'Corte de ruta total por derrumbe',
            latitud: undefined,
            longitud: undefined,
          },
        })
      );
      expect(offlineQueue.guardarMisionLocal).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'mis-001',
          estado: 'RECHAZADA',
        })
      );

      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
    });

    it('debe encolar en outbox cuando fetch arroja TypeError Load failed (Safari/WebKit)', async () => {
      vi.mocked(apiClient.POST).mockRejectedValue(new TypeError('Load failed'));
      vi.mocked(offlineQueue.obtenerMisionLocalPorId).mockResolvedValue({
        id: 'mis-webkit',
        incidenteId: 'inc-001',
        codigoIncidente: 'INC-2026-1042',
        tipologia: 'Caída de árbol',
        direccion: 'Av. Ramón Picarte',
        prioridad: 'ALTA',
        estado: 'DESPACHADA',
        fechaDespacho: '2026-11-03T18:00:00.000Z',
        actualizadoEn: '2026-11-03T18:00:00.000Z',
      });

      const res = await rechazarMision('mis-webkit', {
        justificacion_rechazo: 'Falla de transmisión celular en terreno',
      });

      expect(res.exito).toBe(true);
      expect(res.modoOffline).toBe(true);
      expect(offlineQueue.encolarAccionOutbox).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'RECHAZAR_MISION',
          url: '/api/misiones/mis-webkit/rechazar',
        })
      );
      expect(offlineQueue.guardarMisionLocal).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'mis-webkit',
          estado: 'RECHAZADA',
          sincronizacionPendiente: true,
        })
      );
    });
  });

  describe('aceptarMisionPatrulla — Confirmación de salida de Patrulla Verificadora (HU-36)', () => {
    const misionDespachada = {
      id: '60000000-0000-4000-8000-000000000001',
      incidenteId: 'a0000000-0000-4000-8000-000000000001',
      codigoIncidente: 'INC-2026-0001',
      tipologia: 'Caída de árbol',
      direccion: 'Av. Ramón Picarte 1200, Valdivia',
      prioridad: 'ALTA',
      estado: 'DESPACHADA',
      fechaDespacho: '2026-11-01T20:45:00.000Z',
      actualizadoEn: '2026-11-01T20:45:00.000Z',
    };

    it('invoca POST /api/misiones/{id}/aceptar y actualiza la misión local a EN_CURSO cuando responde 200 OK', async () => {
      const mockRespuesta200 = {
        message:
          'Misión aceptada exitosamente. La patrulla se encuentra en trayecto para iniciar la evaluación.',
        data: {
          mision: {
            id: '60000000-0000-4000-8000-000000000001',
            codigo: 'MIS-2026-0001',
            titulo: 'Verificación de Incidente INC-2026-0001',
            descripcion: 'Evaluar caída de árbol',
            tipoMision: 'VERIFICACION',
            estado: 'EN_CURSO',
            prioridad: 'ALTA',
            incidenteId: 'a0000000-0000-4000-8000-000000000001',
            patrullaId: 'f1000000-0000-4000-8000-000000000001',
            fechaInicio: '2026-11-01T21:00:00.000Z',
            actualizadoEn: '2026-11-01T21:00:00.000Z',
          },
          patrulla: {
            id: 'f1000000-0000-4000-8000-000000000001',
            nombre: 'Patrulla Rápida Costa-1',
            estado: 'EN_VERIFICACION',
          },
          incidente: {
            id: 'a0000000-0000-4000-8000-000000000001',
            codigo: 'INC-2026-0001',
            estado: 'VERIFICANDO',
          },
          hito: {
            id: '70000000-0000-4000-8000-000000000001',
            misionId: '60000000-0000-4000-8000-000000000001',
            hito: 'MISION_ACEPTADA',
            descripcion: 'Misión Aceptada por Patrulla',
            registradoPorId: '00000000-0000-4000-8000-000000000004',
            latitud: -39.819588,
            longitud: -73.245209,
            creadoEn: '2026-11-01T21:00:00.000Z',
          },
        },
      };

      vi.mocked(apiClient.POST).mockResolvedValue({
        data: mockRespuesta200,
        error: undefined,
        response: new Response(null, { status: 200 }),
      } as never);

      const resultado = await aceptarMisionPatrulla(misionDespachada.id, {
        misionActual: misionDespachada,
        coordenadas: { latitud: -39.819588, longitud: -73.245209 },
      });

      expect(apiClient.POST).toHaveBeenCalledWith('/api/misiones/{id}/aceptar', {
        params: { path: { id: misionDespachada.id } },
        body: { latitud: -39.819588, longitud: -73.245209 },
      });
      expect(resultado.enColaOffline).toBe(false);
      expect(resultado.mision.estado).toBe('EN_CURSO');
      expect(resultado.mision.fechaInicio).toBe('2026-11-01T21:00:00.000Z');
      expect(resultado.mision.sincronizacionPendiente).toBe(false);
      expect(resultado.mision.datosAdicionales?.estadoPatrulla).toBe('EN_VERIFICACION');
      expect(resultado.mision.datosAdicionales?.estadoIncidente).toBe('VERIFICANDO');
      expect(offlineQueue.guardarMisionLocal).toHaveBeenCalledWith(resultado.mision);
      expect(offlineQueue.encolarAccionOutbox).not.toHaveBeenCalled();
    });

    it('maneja 409 Conflict de forma idempotente dejando la misión en EN_CURSO sin encolar error', async () => {
      vi.mocked(apiClient.POST).mockResolvedValue({
        data: undefined,
        error: { message: 'La misión ya se encuentra EN_CURSO' },
        response: new Response(null, { status: 409 }),
      } as never);

      const resultado = await aceptarMisionPatrulla(misionDespachada.id, {
        misionActual: misionDespachada,
        coordenadas: {},
      });

      expect(resultado.enColaOffline).toBe(false);
      expect(resultado.yaAceptadaPreviamente).toBe(true);
      expect(resultado.mision.estado).toBe('EN_CURSO');
      expect(resultado.mision.sincronizacionPendiente).toBe(false);
      expect(offlineQueue.guardarMisionLocal).toHaveBeenCalled();
      expect(offlineQueue.encolarAccionOutbox).not.toHaveBeenCalled();
    });

    it('encola ACEPTAR_MISION en IndexedDB outbox y aplica actualización optimista cuando no hay conexión', async () => {
      vi.mocked(apiClient.POST).mockRejectedValue(new TypeError('Failed to fetch'));

      const resultado = await aceptarMisionPatrulla(misionDespachada.id, {
        misionActual: misionDespachada,
        coordenadas: { latitud: -39.814, longitud: -73.245 },
      });

      expect(resultado.enColaOffline).toBe(true);
      expect(resultado.mision.estado).toBe('EN_CURSO');
      expect(resultado.mision.sincronizacionPendiente).toBe(true);
      expect(offlineQueue.guardarMisionLocal).toHaveBeenCalledWith(
        expect.objectContaining({
          id: misionDespachada.id,
          estado: 'EN_CURSO',
          sincronizacionPendiente: true,
        })
      );
      expect(offlineQueue.encolarAccionOutbox).toHaveBeenCalledWith({
        tipo: 'ACEPTAR_MISION',
        url: `/api/misiones/${misionDespachada.id}/aceptar`,
        metodo: 'POST',
        payload: { latitud: -39.814, longitud: -73.245 },
      });
    });

    it('lanza MisionServiceError en 409 Conflict cuando el estado remoto es CANCELADA y no fuerza EN_CURSO (BUG-H36-PWA-03)', async () => {
      vi.mocked(apiClient.POST).mockResolvedValue({
        data: undefined,
        error: {
          message:
            "La misión no puede ser aceptada porque su estado actual es 'CANCELADA'.",
        },
        response: new Response(null, { status: 409 }),
      } as never);

      await expect(
        aceptarMisionPatrulla(misionDespachada.id, {
          misionActual: misionDespachada,
          coordenadas: {},
        })
      ).rejects.toThrow(MisionServiceError);

      expect(offlineQueue.guardarMisionLocal).not.toHaveBeenCalled();
    });

    it('preserva el estado optimista EN_CURSO en obtenerDetalleMision cuando hay sincronizacionPendiente y el servidor responde DESPACHADA (BUG-H36-PWA-02)', async () => {
      vi.mocked(offlineQueue.obtenerMisionLocalPorId).mockResolvedValue({
        ...misionDespachada,
        estado: 'EN_CURSO',
        fechaInicio: '2026-11-01T21:05:00.000Z',
        sincronizacionPendiente: true,
        datosAdicionales: {
          hitoAceptacion: 'Misión Aceptada por Patrulla (Pendiente de sincronizar)',
        },
      });

      vi.mocked(apiClient.GET).mockResolvedValue({
        data: {
          message: 'OK',
          data: {
            id: misionDespachada.id,
            codigo: 'MIS-2026-0001',
            titulo: 'Verificación de Incidente',
            descripcion: 'Evaluar árbol',
            tipoMision: 'VERIFICACION',
            estado: 'DESPACHADA',
            prioridad: 'ALTA',
            justificacionRechazo: null,
            fechaInicio: null,
            fechaCierre: null,
            creadoEn: '2026-11-01T20:45:00.000Z',
            actualizadoEn: '2026-11-01T20:45:00.000Z',
            creadoPor: null,
            encargado: null,
            incidente: null,
            prevencion: null,
            cuadrilla: null,
            patrulla: null,
            bitacoraTiempos: [],
            reportesTerreno: [],
          },
        },
        error: undefined,
        response: new Response(),
      } as never);

      const detalle = await obtenerDetalleMision(misionDespachada.id);

      expect(detalle?.estado).toBe('EN_CURSO');
      expect(detalle?.sincronizacionPendiente).toBe(true);
      expect(detalle?.fechaInicio).toBe('2026-11-01T21:05:00.000Z');
    });

    it('lanza MisionServiceError en 403 Forbidden sin encolar en outbox', async () => {
      vi.mocked(apiClient.POST).mockResolvedValue({
        data: undefined,
        error: { message: 'No cuenta con el permiso misiones:terreno:verificar' },
        response: new Response(null, { status: 403 }),
      } as never);

      await expect(
        aceptarMisionPatrulla(misionDespachada.id, {
          misionActual: misionDespachada,
          coordenadas: {},
        })
      ).rejects.toThrow(MisionServiceError);

      expect(offlineQueue.encolarAccionOutbox).not.toHaveBeenCalled();
    });

    it('valida el payload contra rangos geográficos y envía {} si el GPS no responde a tiempo', async () => {
      expect(validarPayloadAceptarMision({ latitud: -39.81, longitud: -73.24 })).toEqual({
        latitud: -39.81,
        longitud: -73.24,
      });
      expect(validarPayloadAceptarMision({ latitud: 999, longitud: -73.24 })).toEqual({});

      const coordsSinGps = await obtenerCoordenadasOpcionales(10);
      expect(coordsSinGps).toEqual({});
    });
  });

  describe('Sincronización de tipología y estado de evaluaciones desde backend', () => {
    it('usa incidenteTipoAfectacion en sincronizarMisiones y deriva tipologiaEvaluada/prioridadEvaluada en obtenerDetalleMision', async () => {
      vi.mocked(offlineQueue.obtenerMisionLocalPorId).mockResolvedValue(undefined);
      vi.mocked(apiClient.GET).mockResolvedValueOnce({
        data: {
          message: 'OK',
          data: [
            {
              id: 'mis-7700',
              codigo: 'MIS-2026-7700',
              titulo: 'Verificación: Anegamiento - INC-592395-562',
              descripcion: 'Revisar corte de suministro',
              tipoMision: 'VERIFICACION',
              estado: 'EN_CURSO',
              prioridad: 'ALTA',
              incidenteId: 'inc-562',
              incidenteCodigo: 'INC-592395-562',
              incidenteTipoAfectacion: 'Corte de agua potable',
              cuadrillaId: null,
              cuadrillaNombre: null,
              patrullaId: 'pat-001',
              patrullaNombre: 'Patrulla 1',
              delegacionId: 'del-001',
              delegacionNombre: 'Norte',
              fechaInicio: '2026-10-30T04:00:00Z',
              fechaCierre: null,
              creadoEn: '2026-10-30T04:00:00Z',
              actualizadoEn: '2026-10-30T04:00:00Z',
            },
          ],
          meta: {
            total: 1,
            page: 1,
            limit: 20,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
        },
        error: undefined,
        response: new Response(),
      } as never);

      const lista = await sincronizarMisiones({ tipoMision: 'VERIFICACION' });
      expect(lista[0]?.tipologia).toBe('Corte de agua potable');

      vi.mocked(apiClient.GET).mockResolvedValueOnce({
        data: {
          message: 'OK',
          data: {
            id: 'mis-7700',
            codigo: 'MIS-2026-7700',
            titulo: 'Verificación: Corte de agua potable - INC-592395-562',
            descripcion: 'Revisar corte de suministro',
            tipoMision: 'VERIFICACION',
            estado: 'EN_CURSO',
            prioridad: 'ALTA',
            justificacionRechazo: null,
            fechaInicio: '2026-10-30T04:00:00Z',
            fechaCierre: null,
            creadoEn: '2026-10-30T04:00:00Z',
            actualizadoEn: '2026-10-30T05:00:00Z',
            creadoPor: null,
            encargado: null,
            incidente: {
              id: 'inc-562',
              codigo: 'INC-592395-562',
              codigoSeguimiento: 'SEG-562',
              tipoAfectacion: 'Corte de agua potable',
              descripcion: 'Sin suministro',
              direccion: 'Av. Alemania 500',
              latitud: -39.81,
              longitud: -73.24,
              estado: 'VERIFICANDO',
              prioridad: 'ALTA',
              requiereAsistenciaSocial: false,
              delegacionNombre: 'Norte',
            },
            prevencion: null,
            cuadrilla: null,
            patrulla: null,
            bitacoraTiempos: [
              {
                id: 'hito-1',
                hito: 'TIPOLOGIA_RECLASIFICADA',
                fecha: '2026-10-30',
                hora: '04:30:00',
                timestamp: '2026-10-30T04:30:00Z',
                descripcion: 'Reclasificado. Justificación: Matriz rota',
                metadatos: {
                  tipoAnterior: 'Anegamiento',
                  tipoNuevo: 'Corte de agua potable',
                  justificacion: 'Matriz rota',
                },
              },
            ],
            reportesTerreno: [{ id: 'rep-1', versionReporte: 1 }],
            evaluaciones: {
              tipologiaEvaluada: true,
              tipologiaEvaluadaEn: '2026-10-30T04:30:00Z',
              prioridadEvaluada: true,
              prioridadEvaluadaEn: '2026-10-30T04:45:00Z',
              versionReportePrioridad: 1,
            },
          },
        },
        error: undefined,
        response: new Response(),
      } as never);

      const detalle = await obtenerDetalleMision('mis-7700');
      expect(detalle?.tipologia).toBe('Corte de agua potable');
      expect(detalle?.datosAdicionales?.tipologiaEvaluada).toBe(true);
      expect(detalle?.datosAdicionales?.esReclasificacion).toBe(true);
      expect(detalle?.datosAdicionales?.justificacionTipologia).toBe('Matriz rota');
      expect(detalle?.datosAdicionales?.prioridadEvaluada).toBe(true);
      expect(detalle?.datosAdicionales?.versionReportePrioridad).toBe(1);
    });

    it('preserva prioridad optimista y estado RECHAZADA en sincronizarMisiones y obtenerDetalleMision cuando existen AJUSTAR_PRIORIDAD o RECHAZAR_MISION en outbox (BUG-INT-PWA-09)', async () => {
      const misionPrioridadLocal = {
        id: '60000000-0000-4000-8000-000000000808',
        incidenteId: 'a0000000-0000-4000-8000-000000000808',
        codigoIncidente: 'INC-2026-0808',
        tipologia: 'Inundación',
        direccion: 'Av. Picarte 808',
        prioridad: 'CRITICA',
        estado: 'EN_CURSO',
        fechaDespacho: '2026-11-24T10:00:00Z',
        fechaInicio: '2026-11-24T10:05:00Z',
        sincronizacionPendiente: false,
        datosAdicionales: {
          prioridadEvaluada: true,
          versionReportePrioridad: 1,
        },
        actualizadoEn: '2026-11-24T10:15:00Z',
      };

      const misionRechazoLocal = {
        id: '60000000-0000-4000-8000-000000000809',
        incidenteId: 'a0000000-0000-4000-8000-000000000809',
        codigoIncidente: 'INC-2026-0809',
        tipologia: 'Caída de árbol',
        direccion: 'Calle Bueras 100',
        prioridad: 'ALTA',
        estado: 'RECHAZADA',
        fechaDespacho: '2026-11-24T10:00:00Z',
        sincronizacionPendiente: false,
        datosAdicionales: {
          justificacionRechazo: 'Falla mecánica en móvil',
        },
        actualizadoEn: '2026-11-24T10:12:00Z',
      };

      vi.mocked(offlineQueue.obtenerMisionesLocales)
        .mockResolvedValueOnce([misionPrioridadLocal, misionRechazoLocal])
        .mockResolvedValueOnce([]);
      vi.mocked(offlineQueue.obtenerAccionesOutbox).mockResolvedValueOnce([
        {
          id: 'outbox-prio-808',
          tipo: 'AJUSTAR_PRIORIDAD',
          url: '/api/incidentes/a0000000-0000-4000-8000-000000000808/prioridad',
          metodo: 'PATCH',
          payload: {
            misionId: misionPrioridadLocal.id,
            prioridad: 'CRITICA',
          },
          timestamp: '2026-11-24T10:15:00Z',
          intentos: 0,
        },
        {
          id: 'outbox-rech-809',
          tipo: 'RECHAZAR_MISION',
          url: `/api/misiones/${misionRechazoLocal.id}/rechazar`,
          metodo: 'POST',
          payload: {
            justificacion_rechazo: 'Falla mecánica en móvil',
          },
          timestamp: '2026-11-24T10:12:00Z',
          intentos: 0,
        },
      ]);

      vi.mocked(apiClient.GET).mockResolvedValueOnce({
        data: {
          message: 'OK',
          data: [
            {
              id: misionPrioridadLocal.id,
              codigo: 'MIS-2026-0808',
              titulo: 'Verificación: Inundación',
              descripcion: 'Av. Picarte 808',
              tipoMision: 'VERIFICACION',
              estado: 'EN_CURSO',
              prioridad: 'MEDIA',
              incidenteId: misionPrioridadLocal.incidenteId,
              incidenteCodigo: 'INC-2026-0808',
              fechaInicio: '2026-11-24T10:05:00Z',
              creadoEn: '2026-11-24T10:00:00Z',
              actualizadoEn: '2026-11-24T10:05:00Z',
            },
            {
              id: misionRechazoLocal.id,
              codigo: 'MIS-2026-0809',
              titulo: 'Verificación: Caída de árbol',
              descripcion: 'Calle Bueras 100',
              tipoMision: 'VERIFICACION',
              estado: 'DESPACHADA',
              prioridad: 'ALTA',
              incidenteId: misionRechazoLocal.incidenteId,
              incidenteCodigo: 'INC-2026-0809',
              fechaInicio: null,
              creadoEn: '2026-11-24T10:00:00Z',
              actualizadoEn: '2026-11-24T10:00:00Z',
            },
          ],
        },
        error: undefined,
        response: new Response(),
      } as never);

      const lista = await sincronizarMisiones({ tipoMision: 'VERIFICACION' });
      expect(lista[0].prioridad).toBe('CRITICA');
      expect(lista[0].sincronizacionPendiente).toBe(true);
      expect(lista[1].estado).toBe('RECHAZADA');
      expect(lista[1].sincronizacionPendiente).toBe(true);

      vi.mocked(offlineQueue.obtenerMisionLocalPorId).mockResolvedValueOnce(misionPrioridadLocal);
      vi.mocked(offlineQueue.obtenerAccionesOutbox).mockResolvedValueOnce([
        {
          id: 'outbox-prio-808',
          tipo: 'AJUSTAR_PRIORIDAD',
          url: '/api/incidentes/a0000000-0000-4000-8000-000000000808/prioridad',
          metodo: 'PATCH',
          payload: {
            misionId: misionPrioridadLocal.id,
            prioridad: 'CRITICA',
          },
          timestamp: '2026-11-24T10:15:00Z',
          intentos: 0,
        },
      ]);
      vi.mocked(apiClient.GET).mockResolvedValueOnce({
        data: {
          message: 'OK',
          data: {
            id: misionPrioridadLocal.id,
            codigo: 'MIS-2026-0808',
            titulo: 'Verificación: Inundación',
            descripcion: 'Av. Picarte 808',
            tipoMision: 'VERIFICACION',
            estado: 'EN_CURSO',
            prioridad: 'MEDIA',
            justificacionRechazo: null,
            fechaInicio: '2026-11-24T10:05:00Z',
            fechaCierre: null,
            creadoEn: '2026-11-24T10:00:00Z',
            actualizadoEn: '2026-11-24T10:05:00Z',
            creadoPor: null,
            encargado: null,
            incidente: {
              id: misionPrioridadLocal.incidenteId,
              codigo: 'INC-2026-0808',
              codigoSeguimiento: 'SEG-808',
              tipoAfectacion: 'Inundación',
              descripcion: 'Agua en calzada',
              direccion: 'Av. Picarte 808',
              latitud: -39.81,
              longitud: -73.24,
              estado: 'VERIFICANDO',
              prioridad: 'MEDIA',
              requiereAsistenciaSocial: false,
              delegacionNombre: 'Centro',
            },
            prevencion: null,
            cuadrilla: null,
            patrulla: null,
            bitacoraTiempos: [],
            reportesTerreno: [],
          },
        },
        error: undefined,
        response: new Response(),
      } as never);

      const detalle = await obtenerDetalleMision(misionPrioridadLocal.id);
      expect(detalle?.prioridad).toBe('CRITICA');
      expect(detalle?.sincronizacionPendiente).toBe(true);
    });
  });
});
