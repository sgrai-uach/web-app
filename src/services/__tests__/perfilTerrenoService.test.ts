import { describe, it, expect, vi, beforeEach } from 'vitest';
import { obtenerMetricasPerfil } from '../perfilTerrenoService';
import * as misionesService from '../misionesService';
import type { MisionLocal } from '@/types/offline';

vi.mock('../misionesService');

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
});
