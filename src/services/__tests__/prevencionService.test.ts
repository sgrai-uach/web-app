import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CLAVE_CACHE_EVENTO_PREFIJO,
  extraerCoordenadasGeoJson,
  filtrarRecursosDeMision,
  normalizarRecursosPrevencion,
  obtenerContextoPrevencionMision,
  obtenerDetalleEventoPrevencion,
} from '../prevencionService';
import type { EventoPrevencionDetalleApi, MisionLocal } from '@/types/offline';

const { getMock, handleUnauthorizedSessionMock, guardarCatalogoMock, obtenerCatalogoMock } =
  vi.hoisted(() => ({
    getMock: vi.fn(),
    handleUnauthorizedSessionMock: vi.fn(),
    guardarCatalogoMock: vi.fn(),
    obtenerCatalogoMock: vi.fn(),
  }));

vi.mock('@/lib/api/client', () => ({
  default: {
    GET: getMock,
  },
  handleUnauthorizedSession: handleUnauthorizedSessionMock,
}));

vi.mock('@/services/offlineQueue', () => ({
  guardarCatalogoLocal: guardarCatalogoMock,
  obtenerCatalogoLocal: obtenerCatalogoMock,
}));

describe('prevencionService (HU-33)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
    });
  });

  describe('extraerCoordenadasGeoJson', () => {
    it('extrae lat/lng desde un objeto Point GeoJSON válido', () => {
      const coords = extraerCoordenadasGeoJson({
        type: 'Point',
        coordinates: [-73.2459, -39.8142],
      });
      expect(coords).toEqual({ lat: -39.8142, lng: -73.2459 });
    });

    it('extrae lat/lng desde una cadena JSON serializada de Point GeoJSON', () => {
      const coords = extraerCoordenadasGeoJson(
        JSON.stringify({ type: 'Point', coordinates: [-73.21, -39.82] })
      );
      expect(coords).toEqual({ lat: -39.82, lng: -73.21 });
    });

    it('retorna undefined ante geometrías inválidas o fuera de rango WGS84', () => {
      expect(extraerCoordenadasGeoJson(null)).toBeUndefined();
      expect(extraerCoordenadasGeoJson('{invalido')).toBeUndefined();
      expect(
        extraerCoordenadasGeoJson({ type: 'Polygon', coordinates: [] })
      ).toBeUndefined();
      expect(
        extraerCoordenadasGeoJson({ type: 'Point', coordinates: [-200, -39.8] })
      ).toBeUndefined();
    });
  });

  describe('normalizarRecursosPrevencion y filtrarRecursosDeMision', () => {
    it('separa recursos propios vinculados por misionId de los de otras misiones del evento', () => {
      const normalizados = normalizarRecursosPrevencion([
        {
          id: 'epr-1',
          recursoId: 'rec-1',
          nombre: 'Sacos de arena',
          esIndividual: false,
          cantidadAsignada: 50,
          misionId: 'mis-1',
        },
        {
          id: 'epr-2',
          recursoId: 'rec-2',
          nombre: 'Motobomba Honda',
          esIndividual: true,
          cantidadAsignada: 1,
          misionId: 'mis-2',
        },
      ]);

      const { propios, otrosEvento } = filtrarRecursosDeMision(normalizados, 'mis-1', 2);
      expect(propios).toHaveLength(1);
      expect(propios[0].nombre).toBe('Sacos de arena');
      expect(otrosEvento).toHaveLength(1);
      expect(otrosEvento[0].nombre).toBe('Motobomba Honda');
    });

    it('atribuye recursos sin misionId explícito cuando el evento tiene una sola misión', () => {
      const normalizados = normalizarRecursosPrevencion([
        {
          recursoId: 'rec-10',
          nombre: 'Generador portátil',
          esIndividual: true,
          cantidadAsignada: 1,
          misionId: null,
        },
      ]);

      const { propios, otrosEvento } = filtrarRecursosDeMision(normalizados, 'mis-1', 1);
      expect(propios).toHaveLength(1);
      expect(otrosEvento).toHaveLength(0);
    });
  });

  describe('obtenerDetalleEventoPrevencion', () => {
    const detalleMock: EventoPrevencionDetalleApi = {
      id: 'ev-100',
      codigo: 'EVP-2026-01',
      nombre: 'Despliegue preventivo Las Ánimas',
      descripcion: 'Despeje de canaletas y monitoreo preventivo.',
      sector: 'Las Ánimas',
      direccionTexto: 'Av. Pedro Aguirre Cerda 500',
      prioridad: 'ALTA',
      estado: 'EN_CURSO',
      latitud: -39.805,
      longitud: -73.225,
      puntoCritico: {
        id: 'pc-1',
        codigo: 'PC-01',
        nombre: 'Canal Las Ánimas',
        descripcion: 'Zona de acumulación histórica de aguas lluvias.',
        tipoRiesgo: 'Anegamiento',
        prioridad: 'ALTA',
        latitud: -39.805,
        longitud: -73.225,
      },
      delegacion: null,
      misiones: [],
      recursosAsignados: [],
      creadoPorId: 'usr-enc-1',
      creadoEn: '2026-11-19T12:00:00Z',
      actualizadoEn: '2026-11-19T12:00:00Z',
    };

    it('consulta GET /api/eventos-atp/prevencion/{id} y cachea en IndexedDB al responder 200', async () => {
      getMock.mockResolvedValue({
        data: { data: detalleMock },
        error: undefined,
        response: { status: 200 },
      });

      const res = await obtenerDetalleEventoPrevencion('ev-100');

      expect(getMock).toHaveBeenCalledWith('/api/eventos-atp/prevencion/{id}', {
        params: { path: { id: 'ev-100' } },
      });
      expect(guardarCatalogoMock).toHaveBeenCalledWith(
        `${CLAVE_CACHE_EVENTO_PREFIJO}ev-100`,
        [detalleMock]
      );
      expect(res).toEqual(detalleMock);
    });

    it('dispara handleUnauthorizedSession y retorna null ante 401', async () => {
      getMock.mockResolvedValue({
        data: undefined,
        error: { message: 'No autorizado' },
        response: { status: 401 },
      });

      const res = await obtenerDetalleEventoPrevencion('ev-100');

      expect(handleUnauthorizedSessionMock).toHaveBeenCalledTimes(1);
      expect(res).toBeNull();
    });

    it('degrada silenciosamente a caché IndexedDB si responde 403 RBAC', async () => {
      getMock.mockResolvedValue({
        data: undefined,
        error: { message: 'Sin permiso' },
        response: { status: 403 },
      });
      obtenerCatalogoMock.mockResolvedValue([detalleMock]);

      const res = await obtenerDetalleEventoPrevencion('ev-100');

      expect(handleUnauthorizedSessionMock).not.toHaveBeenCalled();
      expect(obtenerCatalogoMock).toHaveBeenCalledWith(
        `${CLAVE_CACHE_EVENTO_PREFIJO}ev-100`
      );
      expect(res).toEqual(detalleMock);
    });

    it('retorna caché IndexedDB directamente cuando está offline sin llamar a la API', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true,
      });
      obtenerCatalogoMock.mockResolvedValue([detalleMock]);

      const res = await obtenerDetalleEventoPrevencion('ev-100');

      expect(getMock).not.toHaveBeenCalled();
      expect(res).toEqual(detalleMock);
    });
  });

  describe('obtenerContextoPrevencionMision', () => {
    it('extrae evento, punto crítico y recursos desde mision.datosAdicionales', () => {
      const mision: MisionLocal = {
        id: 'mis-p1',
        incidenteId: '',
        codigoIncidente: 'MIS-PREV-01',
        tipoMision: 'PREVENCION',
        tipologia: 'Mitigación invernal',
        prioridad: 'ALTA',
        estado: 'DESPACHADA',
        direccion: 'Sector Collico',
        fechaDespacho: '2026-11-19T12:00:00Z',
        actualizadoEn: '2026-11-19T12:00:00Z',
        sincronizacionPendiente: false,
        datosAdicionales: {
          eventoPrevencion: {
            id: 'ev-1',
            codigo: 'EVP-01',
            nombre: 'Limpieza preventiva',
            estado: 'EN_EJECUCION',
          },
          puntoCritico: {
            id: 'pc-1',
            codigo: 'PC-09',
            nombre: 'Estero Collico',
            tipoRiesgo: 'Anegamiento',
          },
          recursosPrevencion: [
            {
              recursoId: 'rec-1',
              nombre: 'Botas de agua',
              esIndividual: false,
              cantidadAsignada: 4,
              misionId: 'mis-p1',
            },
          ],
          recursosEventoPrevencion: [
            {
              recursoId: 'rec-2',
              nombre: 'Camión aljibe',
              esIndividual: true,
              cantidadAsignada: 1,
              misionId: 'mis-p2',
            },
          ],
        },
      };

      const contexto = obtenerContextoPrevencionMision(mision);
      expect(contexto.eventoPrevencion?.codigo).toBe('EVP-01');
      expect(contexto.puntoCritico?.nombre).toBe('Estero Collico');
      expect(contexto.recursosMision).toHaveLength(1);
      expect(contexto.recursosOtrosEvento).toHaveLength(1);
    });
  });
});
