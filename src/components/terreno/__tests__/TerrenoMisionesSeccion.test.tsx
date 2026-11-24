import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { TerrenoMisionesSeccion } from '../TerrenoMisionesSeccion';
import * as authContext from '@/context/AuthContext';
import * as misionesService from '@/services/misionesService';

vi.mock('@/context/AuthContext');
vi.mock('@/services/misionesService');

describe('TerrenoMisionesSeccion — Componente Unificado de Inicio', () => {
  const mockAuthCuadrilla = {
    usuario: {
      id: 'usr-cuad-1',
      rut: '15.111.222-3',
      nombre: 'Delegado Sur',
      email: 'cuad@valdivia.cl',
      rolId: 'rol-cuad',
      rolNombre: 'Delegado de Cuadrilla',
      rolCodigo: 'DELEGADO_CUADRILLA',
      delegacionId: 'del-1',
      delegacionNombre: 'Sur',
      permisos: ['misiones:terreno:ejecutar'],
      unidadId: 'cuad-sur-1',
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
    estadoAsignacion: 'ACTIVA' as const,
    tienePermiso: vi.fn().mockReturnValue(true),
    tieneAlgunPermiso: vi.fn().mockReturnValue(true),
    login: vi.fn(),
    logout: vi.fn(),
    recargarSesion: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(authContext, 'useAuth').mockReturnValue(mockAuthCuadrilla);
  });

  it('renderiza estados pendientes y en_curso con la misma estructura y refresca ante sgrai:mision_asignada y sgrai:mision-sincronizada', async () => {
    vi.spyOn(misionesService, 'sincronizarMisiones')
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'mis-reasig-003',
          incidenteId: 'inc-100',
          codigoIncidente: 'INC-2026-0100',
          tipologia: 'Árbol caído en calzada',
          direccion: 'Av. Francia 900',
          prioridad: 'ALTA',
          estado: 'DESPACHADA',
          fechaDespacho: '2026-11-24T17:50:00Z',
          actualizadoEn: '2026-11-24T17:50:00Z',
          datosAdicionales: {
            codigoMision: 'MIS-2026-0003',
          },
        },
      ]);

    render(
      <div>
        <TerrenoMisionesSeccion variante="pendientes" />
        <TerrenoMisionesSeccion variante="en_curso" />
      </div>
    );

    await waitFor(() => {
      expect(screen.getByText(/Sin despachos pendientes por confirmar/i)).toBeInTheDocument();
      expect(screen.getByText(/Sin misiones en curso actualmente/i)).toBeInTheDocument();
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent('sgrai:mision_asignada'));
    });

    await waitFor(() => {
      expect(screen.getByText('INC-2026-0100')).toBeInTheDocument();
      expect(screen.getByText('MIS-2026-0003')).toBeInTheDocument();
      expect(screen.getByText('1 por confirmar')).toBeInTheDocument();
    });
  });

  it('recarga cuando se dispara sgrai:mision-rechazada', async () => {
    const spySync = vi
      .spyOn(misionesService, 'sincronizarMisiones')
      .mockResolvedValueOnce([
        {
          id: 'mis-en-curso-1',
          incidenteId: 'inc-200',
          codigoIncidente: 'INC-2026-0200',
          tipologia: 'Inundación',
          direccion: 'Picarte 100',
          prioridad: 'CRITICA',
          estado: 'EN_CURSO',
          fechaDespacho: '2026-11-24T16:00:00Z',
          actualizadoEn: '2026-11-24T16:10:00Z',
        },
      ])
      .mockResolvedValueOnce([]);

    render(<TerrenoMisionesSeccion variante="en_curso" />);

    await waitFor(() => {
      expect(screen.getByText('INC-2026-0200')).toBeInTheDocument();
      expect(screen.getByText('1 en curso')).toBeInTheDocument();
    });

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('sgrai:mision-rechazada', { detail: { misionId: 'mis-en-curso-1' } })
      );
    });

    await waitFor(() => {
      expect(spySync).toHaveBeenCalledTimes(2);
      expect(screen.getByText(/Sin misiones en curso actualmente/i)).toBeInTheDocument();
    });
  });
});
