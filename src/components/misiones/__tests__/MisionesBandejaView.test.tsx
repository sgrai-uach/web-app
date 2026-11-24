import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MisionesBandejaView } from '../MisionesBandejaView';
import * as AuthContextModule from '@/context/AuthContext';
import * as misionesService from '@/services/misionesService';
import * as socketHook from '@/hooks/useMisionesSocket';

vi.mock('@/context/AuthContext');
vi.mock('@/services/misionesService');
vi.mock('@/hooks/useMisionesSocket');

describe('MisionesBandejaView — Bandeja Unificada Patrulla / Cuadrilla', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(socketHook.useMisionesSocket).mockReturnValue({ conectado: true });
  });

  it('muestra el código de misión en cuadrilla para distinguir reasignación sobre el mismo incidente y refresca ante eventos', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      usuario: {
        id: 'u-cuad-1',
        rut: '15.333.444-5',
        nombre: 'Delegado Sur',
        email: 'cuad@valdivia.cl',
        rolId: 'r-cuad',
        rolNombre: 'Delegado de Cuadrilla',
        rolCodigo: 'DELEGADO_CUADRILLA',
        delegacionId: 'del-1',
        delegacionNombre: 'Sur',
        permisos: ['misiones:terreno:ejecutar'],
        unidadId: 'cuad-1',
        unidadNombre: 'Cuadrilla Despeje Sur',
        unidadActiva: true,
      },
      token: 'jwt-cuad',
      cargando: false,
      autenticado: true,
      esPatrulla: false,
      esCuadrilla: true,
      unidadActiva: true,
      tieneUnidadAsignada: true,
      estadoAsignacion: 'ACTIVA',
      tienePermiso: vi.fn().mockReturnValue(true),
      tieneAlgunPermiso: vi.fn().mockReturnValue(true),
      login: vi.fn(),
      logout: vi.fn(),
      recargarSesion: vi.fn(),
    });

    vi.mocked(misionesService.sincronizarMisiones)
      .mockResolvedValueOnce([
        {
          id: 'mis-rej-002',
          incidenteId: 'inc-50',
          codigoIncidente: 'INC-2026-0050',
          tipologia: 'Corte de vía',
          direccion: 'Sector Sur 50',
          prioridad: 'ALTA',
          estado: 'RECHAZADA',
          fechaDespacho: '2026-11-24T14:00:00Z',
          actualizadoEn: '2026-11-24T14:30:00Z',
          datosAdicionales: { codigoMision: 'MIS-2026-0002' },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'mis-new-003',
          incidenteId: 'inc-50',
          codigoIncidente: 'INC-2026-0050',
          tipologia: 'Corte de vía',
          direccion: 'Sector Sur 50',
          prioridad: 'ALTA',
          estado: 'DESPACHADA',
          fechaDespacho: '2026-11-24T15:00:00Z',
          actualizadoEn: '2026-11-24T15:00:00Z',
          datosAdicionales: { codigoMision: 'MIS-2026-0003' },
        },
        {
          id: 'mis-rej-002',
          incidenteId: 'inc-50',
          codigoIncidente: 'INC-2026-0050',
          tipologia: 'Corte de vía',
          direccion: 'Sector Sur 50',
          prioridad: 'ALTA',
          estado: 'RECHAZADA',
          fechaDespacho: '2026-11-24T14:00:00Z',
          actualizadoEn: '2026-11-24T14:30:00Z',
          datosAdicionales: { codigoMision: 'MIS-2026-0002' },
        },
      ]);

    render(<MisionesBandejaView tipoUnidad="cuadrilla" />);

    await waitFor(() => {
      expect(screen.getByText(/MIS-2026-0002/)).toBeInTheDocument();
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent('sgrai:mision_asignada'));
    });

    await waitFor(() => {
      expect(screen.getByText(/MIS-2026-0003/)).toBeInTheDocument();
      expect(misionesService.sincronizarMisiones).toHaveBeenCalledWith({
        tipoMision: 'ATENCION_CUADRILLA',
        cuadrillaId: 'cuad-1',
      });
    });
  });
});
