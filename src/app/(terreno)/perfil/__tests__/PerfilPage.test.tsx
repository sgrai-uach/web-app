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
});
