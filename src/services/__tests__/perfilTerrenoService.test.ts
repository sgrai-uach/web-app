import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  obtenerMetricasPerfil,
  registrarPatrullaEnHistorial,
  obtenerHistorialUnidades,
} from '../perfilTerrenoService';
import * as misionesService from '../misionesService';
import * as offlineQueue from '../offlineQueue';
import type { MisionLocal } from '@/types/offline';
import type { UsuarioPerfilSesion } from '@/types/seguridad';

vi.mock('../misionesService');
vi.mock('../offlineQueue', () => ({
  guardarCatalogoLocal: vi.fn(),
  obtenerCatalogoLocal: vi.fn(),
}));

describe('perfilTerrenoService — Estadísticas y especialidad del operador', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calcula métricas de misiones atendidas, en curso y pendientes en patrulla', async () => {
    const mockMisiones: Partial<MisionLocal>[] = [
      { id: '1', estado: 'FINALIZADA' },
      { id: '2', estado: 'COMPLETADA' },
      { id: '3', estado: 'EN_CURSO' },
      { id: '4', estado: 'DESPACHADA' },
    ];

    vi.mocked(misionesService.sincronizarMisiones).mockResolvedValue(
      mockMisiones as MisionLocal[]
    );

    const metricas = await obtenerMetricasPerfil(null, false);

    expect(metricas.misionesAtendidas).toBe(2);
    expect(metricas.misionesEnCurso).toBe(1);
    expect(metricas.misionesPendientes).toBe(1);
    expect(metricas.totalMisiones).toBe(4);
    expect(metricas.especialidad).toBe('Operaciones de Terreno y Triage Primario');
  });

  it('determina la especialidad de cuadrilla correctamente', async () => {
    vi.mocked(misionesService.sincronizarMisiones).mockResolvedValue([]);

    const metricas = await obtenerMetricasPerfil(null, true);

    expect(metricas.especialidad).toBe('Cuadrilla de Respuesta Operativa y Despeje');
  });

  describe('Historial de Patrullas del Funcionario (H85)', () => {
    it('no registra nada si el usuario no tiene unidad asignada', async () => {
      const usuarioSinUnidad: Partial<UsuarioPerfilSesion> = {
        id: 'u-1',
        unidadId: null,
        unidadNombre: null,
      };

      await registrarPatrullaEnHistorial(usuarioSinUnidad as UsuarioPerfilSesion);

      expect(offlineQueue.guardarCatalogoLocal).not.toHaveBeenCalled();
    });

    it('registra una nueva patrulla en el historial local', async () => {
      vi.mocked(offlineQueue.obtenerCatalogoLocal).mockResolvedValue(null);

      const usuarioConPatrulla: Partial<UsuarioPerfilSesion> = {
        id: 'u-1',
        unidadId: 'pat-1',
        unidadNombre: 'Patrulla Móvil 01',
        rolCodigo: 'PATRULLA_VERIFICADORA',
        unidadActiva: true,
      };

      await registrarPatrullaEnHistorial(usuarioConPatrulla as UsuarioPerfilSesion);

      expect(offlineQueue.guardarCatalogoLocal).toHaveBeenCalledWith(
        'historial_unidades_u-1',
        expect.arrayContaining([
          expect.objectContaining({
            unidadId: 'pat-1',
            nombre: 'Patrulla Móvil 01',
            tipoUnidad: 'PATRULLA',
            estadoAlMomento: 'ACTIVA',
          }),
        ])
      );
    });

    it('actualiza el estado de una patrulla existente en el historial si pasa a desactivada', async () => {
      vi.mocked(offlineQueue.obtenerCatalogoLocal).mockResolvedValue([
        {
          unidadId: 'pat-1',
          nombre: 'Patrulla Móvil 01',
          tipoUnidad: 'PATRULLA',
          fechaPrimerRegistro: '2026-10-01T10:00:00Z',
          ultimaVezVisto: '2026-10-01T10:00:00Z',
          estadoAlMomento: 'ACTIVA',
        },
      ]);

      const usuarioPatrullaInactiva: Partial<UsuarioPerfilSesion> = {
        id: 'u-1',
        unidadId: 'pat-1',
        unidadNombre: 'Patrulla Móvil 01',
        rolCodigo: 'PATRULLA_VERIFICADORA',
        unidadActiva: false,
      };

      await registrarPatrullaEnHistorial(usuarioPatrullaInactiva as UsuarioPerfilSesion);

      expect(offlineQueue.guardarCatalogoLocal).toHaveBeenCalledWith(
        'historial_unidades_u-1',
        expect.arrayContaining([
          expect.objectContaining({
            unidadId: 'pat-1',
            nombre: 'Patrulla Móvil 01',
            estadoAlMomento: 'DESACTIVADA',
          }),
        ])
      );
    });

    it('retorna el historial ordenado de forma descendente por última vez visto', async () => {
      vi.mocked(offlineQueue.obtenerCatalogoLocal).mockResolvedValue([
        {
          unidadId: 'pat-antigua',
          nombre: 'Patrulla Antíguo Turno',
          tipoUnidad: 'PATRULLA',
          fechaPrimerRegistro: '2026-09-01T08:00:00Z',
          ultimaVezVisto: '2026-09-15T18:00:00Z',
          estadoAlMomento: 'DESACTIVADA',
        },
        {
          unidadId: 'pat-reciente',
          nombre: 'Patrulla Reciente',
          tipoUnidad: 'PATRULLA',
          fechaPrimerRegistro: '2026-10-01T08:00:00Z',
          ultimaVezVisto: '2026-10-20T18:00:00Z',
          estadoAlMomento: 'ACTIVA',
        },
      ]);

      const historial = await obtenerHistorialUnidades('u-1');

      expect(historial).toHaveLength(2);
      expect(historial[0].unidadId).toBe('pat-reciente');
      expect(historial[1].unidadId).toBe('pat-antigua');
    });
  });
});
