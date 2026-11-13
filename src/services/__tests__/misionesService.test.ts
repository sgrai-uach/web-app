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
  guardarMisionLocal: vi.fn(),
  obtenerMisionesLocales: vi.fn(),
  obtenerMisionLocalPorId: vi.fn(),
  encolarAccionOutbox: vi.fn(),
}));

describe('misionesService — Sincronización remota y persistencia IndexedDB (Offline-First)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
