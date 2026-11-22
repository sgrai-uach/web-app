import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import TerrenoPerfilPage from '../page';
import * as authContext from '@/context/AuthContext';
import * as perfilService from '@/services/perfilTerrenoService';

vi.mock('@/context/AuthContext');
vi.mock('@/services/perfilTerrenoService');

describe('TerrenoPerfilPage — Perfil del Operador de Terreno', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(perfilService.obtenerMetricasPerfil).mockResolvedValue({
      misionesAtendidas: 14,
      misionesEnCurso: 1,
      misionesPendientes: 3,
      totalMisiones: 18,
      especialidad: 'Operaciones de Terreno y Triage Primario',
    });
    vi.mocked(perfilService.obtenerHistorialUnidades).mockResolvedValue([]);
    vi.mocked(perfilService.registrarPatrullaEnHistorial).mockResolvedValue();
  });

  it('renderiza datos del operador, estadísticas y especialidad sin mostrar enums crudos', async () => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      usuario: {
        id: 'user-1',
        rut: '12.345.678-9',
        nombre: 'Juan Pérez Valdivia',
        email: 'jperez@valdivia.cl',
        rolId: 'rol-1',
        rolNombre: 'PATRULLA_VERIFICADORA',
        rolCodigo: 'PATRULLA_VERIFICADORA',
        delegacionId: 'del-1',
        delegacionNombre: 'Delegación Costera',
        permisos: [],
        unidadNombre: 'Patrulla Móvil Alfa 01',
        unidadActiva: true,
      },
      token: 'mock-token',
      cargando: false,
      autenticado: true,
      esPatrulla: true,
      esCuadrilla: false,
      unidadActiva: true,
      tieneUnidadAsignada: true,
      estadoAsignacion: 'ACTIVA',
      tienePermiso: vi.fn(),
      tieneAlgunPermiso: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      recargarSesion: vi.fn(),
    });

    render(<TerrenoPerfilPage />);

    expect(screen.getByText('Juan Pérez Valdivia')).toBeInTheDocument();
    expect(screen.getByText('Patrulla Verificadora')).toBeInTheDocument(); // En español natural, no PATRULLA_VERIFICADORA
    expect(screen.getByText('Patrulla Móvil Alfa 01')).toBeInTheDocument();
    expect(screen.getByText('12.345.678-9')).toBeInTheDocument();
    expect(screen.getByText('jperez@valdivia.cl')).toBeInTheDocument();
    expect(screen.getByText('Delegación Costera')).toBeInTheDocument();
    expect(screen.getByText('En servicio activo')).toBeInTheDocument();

    // Métricas
    expect(await screen.findByText('14')).toBeInTheDocument();
    expect(screen.getByText('Atendidas')).toBeInTheDocument();
    expect(screen.getByText('Operaciones de Terreno y Triage Primario')).toBeInTheDocument();
  });

  it('muestra estado sin asignación operativa cuando el operador no tiene patrulla asignada', async () => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      usuario: {
        id: 'user-2',
        rut: '15.678.901-2',
        nombre: 'Pedro Sin Patrulla',
        email: 'psinpatrulla@valdivia.cl',
        rolId: 'rol-1',
        rolNombre: 'PATRULLA_VERIFICADORA',
        rolCodigo: 'PATRULLA_VERIFICADORA',
        delegacionId: 'del-1',
        delegacionNombre: 'Central Valdivia',
        permisos: [],
        unidadId: null,
        unidadNombre: null,
        unidadActiva: false,
      },
      token: 'mock-token',
      cargando: false,
      autenticado: true,
      esPatrulla: true,
      esCuadrilla: false,
      unidadActiva: false,
      tieneUnidadAsignada: false,
      estadoAsignacion: 'SIN_ASIGNACION',
      tienePermiso: vi.fn(),
      tieneAlgunPermiso: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      recargarSesion: vi.fn(),
    });

    vi.mocked(perfilService.obtenerHistorialUnidades).mockResolvedValue([]);

    render(<TerrenoPerfilPage />);

    expect(screen.getByText('Sin patrulla asignada')).toBeInTheDocument();
    expect(screen.getByText('Sin asignación operativa activa')).toBeInTheDocument();
    expect(
      screen.getByText(/No se registran unidades históricas asociadas a este funcionario/i)
    ).toBeInTheDocument();
  });

  it('renderiza la lista del historial de patrullas asignadas previamente', async () => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      usuario: {
        id: 'user-3',
        rut: '16.789.012-3',
        nombre: 'Carlos Histórico',
        email: 'chistorico@valdivia.cl',
        rolId: 'rol-1',
        rolNombre: 'PATRULLA_VERIFICADORA',
        rolCodigo: 'PATRULLA_VERIFICADORA',
        delegacionId: 'del-1',
        delegacionNombre: 'Central Valdivia',
        permisos: [],
        unidadId: 'pat-actual',
        unidadNombre: 'Patrulla Actual 03',
        unidadActiva: true,
      },
      token: 'mock-token',
      cargando: false,
      autenticado: true,
      esPatrulla: true,
      esCuadrilla: false,
      unidadActiva: true,
      tieneUnidadAsignada: true,
      estadoAsignacion: 'ACTIVA',
      tienePermiso: vi.fn(),
      tieneAlgunPermiso: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      recargarSesion: vi.fn(),
    });

    vi.mocked(perfilService.obtenerHistorialUnidades).mockResolvedValue([
      {
        unidadId: 'pat-actual',
        nombre: 'Patrulla Actual 03',
        tipoUnidad: 'PATRULLA',
        fechaPrimerRegistro: '2026-10-01T08:00:00Z',
        ultimaVezVisto: '2026-10-25T18:00:00Z',
        estadoAlMomento: 'ACTIVA',
      },
      {
        unidadId: 'pat-anterior',
        nombre: 'Patrulla Móvil Alfa 01',
        tipoUnidad: 'PATRULLA',
        fechaPrimerRegistro: '2026-08-01T08:00:00Z',
        ultimaVezVisto: '2026-09-30T18:00:00Z',
        estadoAlMomento: 'DESACTIVADA',
      },
    ]);

    render(<TerrenoPerfilPage />);

    expect(await screen.findByText('Patrulla Actual 03')).toBeInTheDocument();
    expect(await screen.findByText('Patrulla Móvil Alfa 01')).toBeInTheDocument();
    expect(screen.getByText('Activa')).toBeInTheDocument();
    expect(screen.getByText('Desactivada')).toBeInTheDocument();
  });
});
