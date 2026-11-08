import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sincronizarMisiones,
  obtenerDetalleMision,
  reportarLlegadaCuadrilla,
  validarPayloadLlegadaMision,
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
            estado: 'EN_PROCESO',
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

  describe('validarPayloadLlegadaMision', () => {
    it('debe aceptar coordenadas válidas dentro del rango geográfico', () => {
      const payload = validarPayloadLlegadaMision({
        latitud: -39.81422,
        longitud: -73.24591,
        observaciones: '  Equipo en terreno  ',
      });

      expect(payload.latitud).toBe(-39.81422);
      expect(payload.longitud).toBe(-73.24591);
      expect(payload.observaciones).toBe('Equipo en terreno');
    });

    it('debe arrojar MisionServiceError si la latitud está fuera de rango', () => {
      expect(() =>
        validarPayloadLlegadaMision({ latitud: -95, longitud: -73.24591 })
      ).toThrow(MisionServiceError);
    });

    it('debe arrojar MisionServiceError si la longitud está fuera de rango', () => {
      expect(() =>
        validarPayloadLlegadaMision({ latitud: -39.8, longitud: 200 })
      ).toThrow(MisionServiceError);
    });
  });

  describe('reportarLlegadaCuadrilla (H42)', () => {
    const mockMisionBase = {
      id: 'mis-cuadrilla-01',
      incidenteId: 'inc-01',
      codigoIncidente: 'INC-2026-001',
      tipologia: 'Caída de árbol',
      direccion: 'Av. Ramón Picarte 1100',
      coordenadas: { lat: -39.81422, lng: -73.24591 },
      prioridad: 'ALTA',
      estado: 'DESPACHADA',
      fechaDespacho: '2026-11-08T19:00:00Z',
      actualizadoEn: '2026-11-08T19:00:00Z',
    };

    it('debe reportar llegada exitosamente con 201 Created y actualizar a EN_CURSO', async () => {
      const mockApiResponse = {
        message: 'Llegada a terreno reportada exitosamente.',
        data: {
          hitoId: 'hito-001',
          misionId: 'mis-cuadrilla-01',
          codigoMision: 'MIS-2026-001',
          hito: 'LLEGADA_TERRENO',
          descripcion: 'Llegada a terreno reportada.',
          latitud: -39.81422,
          longitud: -73.24591,
          registradoEn: '2026-11-08T19:30:00.000Z',
          registradoPor: {
            id: 'user-05',
            nombre: 'Pedro Delegado',
          },
          estadoMision: 'EN_CURSO',
          miembrosActualizados: 4,
        },
      };

      vi.mocked(apiClient.POST).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
        response: new Response('', { status: 201 }),
      } as never);

      const resultado = await reportarLlegadaCuadrilla('mis-cuadrilla-01', {
        misionActual: mockMisionBase,
        coordenadas: { latitud: -39.81422, longitud: -73.24591 },
      });

      expect(resultado.enColaOffline).toBe(false);
      expect(resultado.mision.estado).toBe('EN_CURSO');
      expect(resultado.mision.fechaLlegada).toBe('2026-11-08T19:30:00.000Z');
      expect(offlineQueue.guardarMisionLocal).toHaveBeenCalled();
    });

    it('debe manejar idempotencia ante respuesta 409 Conflict fijando estado EN_CURSO', async () => {
      vi.mocked(apiClient.POST).mockResolvedValue({
        data: undefined,
        error: { message: 'La llegada a terreno ya fue reportada' },
        response: new Response('', { status: 409 }),
      } as never);

      const resultado = await reportarLlegadaCuadrilla('mis-cuadrilla-01', {
        misionActual: mockMisionBase,
        coordenadas: { latitud: -39.81422, longitud: -73.24591 },
      });

      expect(resultado.yaReportadaPreviamente).toBe(true);
      expect(resultado.mision.estado).toBe('EN_CURSO');
      expect(resultado.enColaOffline).toBe(false);
      expect(offlineQueue.guardarMisionLocal).toHaveBeenCalled();
    });

    it('debe lanzar MisionServiceError con 403 si el usuario no tiene permisos o no es el delegado', async () => {
      vi.mocked(apiClient.POST).mockResolvedValue({
        data: undefined,
        error: { message: 'No es el delegado asignado' },
        response: new Response('', { status: 403 }),
      } as never);

      await expect(
        reportarLlegadaCuadrilla('mis-cuadrilla-01', {
          misionActual: mockMisionBase,
          coordenadas: { latitud: -39.81422, longitud: -73.24591 },
        })
      ).rejects.toThrow(MisionServiceError);
    });

    it('debe usar coordenadas de la misión si se activa usarUbicacionMision', async () => {
      const mockApiResponse = {
        message: 'Llegada exitosa',
        data: {
          hitoId: 'hito-002',
          misionId: 'mis-cuadrilla-01',
          codigoMision: 'MIS-2026-001',
          hito: 'LLEGADA_TERRENO',
          descripcion: 'Llegada reportada con contingencia.',
          latitud: -39.81422,
          longitud: -73.24591,
          registradoEn: '2026-11-08T19:35:00.000Z',
          registradoPor: { id: 'user-05', nombre: 'Pedro Delegado' },
          estadoMision: 'EN_CURSO',
          miembrosActualizados: 4,
        },
      };

      vi.mocked(apiClient.POST).mockResolvedValue({
        data: mockApiResponse,
        error: undefined,
        response: new Response('', { status: 201 }),
      } as never);

      const resultado = await reportarLlegadaCuadrilla('mis-cuadrilla-01', {
        misionActual: mockMisionBase,
        usarUbicacionMision: true,
      });

      expect(resultado.mision.estado).toBe('EN_CURSO');
      expect(apiClient.POST).toHaveBeenCalledWith(
        '/api/misiones/{id}/llegada',
        expect.objectContaining({
          body: {
            latitud: -39.81422,
            longitud: -73.24591,
          },
        })
      );
    });

    it('debe encolar en outbox y guardar optimistamente en IndexedDB en modo offline', async () => {
      const onlineSpy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

      const resultado = await reportarLlegadaCuadrilla('mis-cuadrilla-01', {
        misionActual: mockMisionBase,
        coordenadas: { latitud: -39.81422, longitud: -73.24591 },
      });

      expect(resultado.enColaOffline).toBe(true);
      expect(resultado.mision.estado).toBe('EN_CURSO');
      expect(resultado.mision.sincronizacionPendiente).toBe(true);
      expect(offlineQueue.encolarAccionOutbox).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'REPORTAR_LLEGADA',
          url: '/api/misiones/mis-cuadrilla-01/llegada',
          metodo: 'POST',
        })
      );

      onlineSpy.mockRestore();
    });
  });
});
