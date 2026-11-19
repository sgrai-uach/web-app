import { describe, it, expect, vi, beforeEach } from 'vitest';
import apiClient from '@/lib/api/client';
import {
  cerrarMisionCuadrilla,
  CierreCuadrillaServiceError,
  obtenerRecursosDisponiblesCuadrilla,
  obtenerReporteCierreCuadrillaMision,
} from '../cierreCuadrillaService';
import {
  encolarAccionOutbox,
  guardarCatalogoLocal,
  guardarMisionLocal,
  obtenerCatalogoLocal,
} from '../offlineQueue';
import type { MisionLocal } from '@/types/offline';

vi.mock('@/lib/api/client', () => ({
  default: {
    GET: vi.fn(),
    POST: vi.fn(),
  },
  handleUnauthorizedSession: vi.fn(),
}));

vi.mock('../offlineQueue', () => ({
  encolarAccionOutbox: vi.fn(),
  guardarCatalogoLocal: vi.fn(),
  guardarMisionLocal: vi.fn(),
  obtenerCatalogoLocal: vi.fn(),
  obtenerMisionLocalPorId: vi.fn(),
}));

vi.mock('../misionesService', () => ({
  obtenerCoordenadasOpcionales: vi.fn().mockResolvedValue({
    latitud: -39.817,
    longitud: -73.242,
  }),
  obtenerDetalleMision: vi.fn().mockResolvedValue(null),
}));

const misionMock: MisionLocal = {
  id: 'd1000000-0000-4000-8000-000000000002',
  incidenteId: 'a1000000-0000-4000-8000-000000000004',
  codigoIncidente: 'INC-2026-0004',
  tipologia: 'Anegamiento de calzada',
  direccion: 'Av. Alemania 780, Valdivia',
  prioridad: 'ALTA',
  estado: 'EN_CURSO',
  fechaDespacho: '2026-11-18T10:00:00.000Z',
  actualizadoEn: '2026-11-18T10:30:00.000Z',
  datosAdicionales: {
    cuadrillaRecursos: [
      {
        id: 'e1000000-0000-4000-8000-000000000004',
        nombre: 'Sacos de Arena de Contención Fluvial',
        tipo: 'GRUPAL',
        cantidadAsignada: 50,
        esIndividual: false,
        unidad: 'sacos',
      },
    ],
  },
};

describe('cierreCuadrillaService (H68)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window.navigator, 'onLine', {
      value: true,
      configurable: true,
    });
  });

  it('envía POST /api/misiones/{id}/cerrar con materiales consumidos y actualiza caché local', async () => {
    vi.mocked(obtenerCatalogoLocal).mockResolvedValueOnce([
      {
        id: 'e1000000-0000-4000-8000-000000000004',
        nombre: 'Sacos de Arena de Contención Fluvial',
        cantidadInventario: 250,
        cantidadEnUso: 50,
        estado: 'DISPONIBLE',
      },
    ]);

    vi.mocked(apiClient.POST).mockResolvedValueOnce({
      data: {
        message: 'Misión cerrada exitosamente.',
        data: {
          reporteTerreno: {
            id: 'f0000000-0000-4000-8000-000000000099',
            creadoEn: '2026-11-18T12:00:00.000Z',
            evaluador: {
              id: '00000000-0000-4000-8000-000000000005',
              nombre: 'Carlos Delegado',
              email: 'delegado@valdivia.cl',
            },
            materialesConsumidos: [
              {
                recursoId: 'e1000000-0000-4000-8000-000000000004',
                nombre: 'Sacos de Arena de Contención Fluvial',
                cantidad: 20,
                unidad: 'sacos',
              },
            ],
          },
          mision: {
            id: misionMock.id,
            estado: 'COMPLETADA',
            fechaCierre: '2026-11-18T12:00:00.000Z',
            actualizadoEn: '2026-11-18T12:00:00.000Z',
          },
          cuadrilla: {
            id: 'c1000000-0000-4000-8000-000000000001',
            estado: 'DISPONIBLE',
          },
          incidente: {
            id: misionMock.incidenteId,
            estado: 'EN_ATENCION',
          },
          recursosActualizados: [
            {
              id: 'e1000000-0000-4000-8000-000000000004',
              nombre: 'Sacos de Arena de Contención Fluvial',
              cantidadConsumida: 20,
              cantidadInventarioAnterior: 250,
              cantidadInventarioActual: 230,
              cantidadEnUsoActual: 30,
              estado: 'DISPONIBLE',
            },
          ],
        },
      },
      error: undefined,
      response: new Response(null, { status: 201 }),
    } as never);

    const res = await cerrarMisionCuadrilla(
      misionMock.id,
      {
        resumen_faenas:
          'Desagüe completo de sumideros en Av. Alemania y contención con sacos.',
        horas_hombre: 6,
        estado_terreno: 'FINALIZADO',
        materiales_consumidos: [
          {
            recurso_id: 'e1000000-0000-4000-8000-000000000004',
            cantidad: 20,
            unidad: 'sacos',
          },
        ],
        adjunto_ids: [
          'a0000000-0000-4000-8000-000000000001',
          'local-temp-123',
        ],
      },
      misionMock
    );

    expect(res.ok).toBe(true);
    expect(res.offline).toBe(false);
    expect(res.mision?.estado).toBe('COMPLETADA');
    expect(res.mision?.datosAdicionales?.estadoCuadrilla).toBe('DISPONIBLE');
    expect(guardarMisionLocal).toHaveBeenCalled();
    expect(guardarCatalogoLocal).toHaveBeenCalled();
    expect(encolarAccionOutbox).not.toHaveBeenCalled();
  });

  it('arroja CierreCuadrillaServiceError sin encolar en outbox ante errores cliente 403 o 409', async () => {
    vi.mocked(apiClient.POST).mockResolvedValueOnce({
      data: undefined,
      error: { message: 'Stock insuficiente para el recurso.' },
      response: new Response(null, { status: 409 }),
    } as never);

    await expect(
      cerrarMisionCuadrilla(
        misionMock.id,
        {
          resumen_faenas:
            'Desagüe completo de sumideros en Av. Alemania y contención con sacos.',
          horas_hombre: 4,
          estado_terreno: 'CONTROLADO',
        },
        misionMock
      )
    ).rejects.toThrow(CierreCuadrillaServiceError);

    expect(encolarAccionOutbox).not.toHaveBeenCalled();
  });

  it('encola CERRAR_FAENA en outbox cuando el dispositivo está offline', async () => {
    Object.defineProperty(window.navigator, 'onLine', {
      value: false,
      configurable: true,
    });

    const res = await cerrarMisionCuadrilla(
      misionMock.id,
      {
        resumen_faenas:
          'Limpieza de colectores pluviales y retiro de residuos sólidos en terreno.',
        horas_hombre: 3.5,
        estado_terreno: 'ESTABLE',
      },
      misionMock,
      ['local-evidencia-1']
    );

    expect(res.ok).toBe(true);
    expect(res.offline).toBe(true);
    expect(res.mision?.estado).toBe('COMPLETADA');
    expect(res.mision?.sincronizacionPendiente).toBe(true);
    expect(encolarAccionOutbox).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'CERRAR_FAENA',
        url: `/api/misiones/${misionMock.id}/cerrar`,
        metodo: 'POST',
      })
    );
  });

  it('combina cuadrillaRecursos con GET /api/recursos y extrae reporte REPORTE_CUADRILLA', async () => {
    vi.mocked(apiClient.GET).mockResolvedValueOnce({
      data: {
        data: [
          {
            id: 'e1000000-0000-4000-8000-000000000009',
            nombre: 'Estacas de Madera',
            esIndividual: false,
            cantidadDisponible: 80,
          },
        ],
      },
      error: undefined,
    } as never);

    const recursos = await obtenerRecursosDisponiblesCuadrilla(misionMock);
    expect(recursos).toHaveLength(2);
    expect(recursos[0].asignadoACuadrilla).toBe(true);

    const misionConReporte: MisionLocal = {
      ...misionMock,
      estado: 'COMPLETADA',
      datosAdicionales: {
        reportesTerreno: [
          {
            id: 'rep-1',
            tipoReporte: 'REPORTE_CUADRILLA',
            resumenTecnico: 'Faena finalizada sin novedades.',
            horasHombre: 5,
            estadoTerreno: 'FINALIZADO',
            materialesConsumidos: [],
            creadoEn: '2026-11-18T14:00:00.000Z',
          },
        ],
      },
    };

    const extraido = obtenerReporteCierreCuadrillaMision(misionConReporte);
    expect(extraido?.resumen_faenas).toBe('Faena finalizada sin novedades.');
    expect(extraido?.horas_hombre).toBe(5);
  });
});
