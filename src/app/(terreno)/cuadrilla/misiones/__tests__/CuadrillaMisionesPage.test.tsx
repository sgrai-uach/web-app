import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CuadrillaMisionesPage from '../page';
import * as AuthContextModule from '@/context/AuthContext';
import * as offlineQueue from '@/services/offlineQueue';

vi.mock('@/context/AuthContext');
vi.mock('@/services/offlineQueue');

describe('CuadrillaMisionesPage — Modo Histórico Cuadrilla Desactivada (H82)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(offlineQueue.obtenerMisionesLocales).mockResolvedValue([]);
    vi.mocked(offlineQueue.guardarMisionesLocales).mockResolvedValue();
  });

  it('muestra el banner de advertencia y el título de historial cuando la cuadrilla está desactivada', async () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      usuario: {
        id: 'u-1',
        rut: '11.111.111-1',
        nombre: 'Pedro Delegado',
        email: 'pdelegado@valdivia.cl',
        rolId: 'r-1',
        rolNombre: 'Delegado de Cuadrilla',
        rolCodigo: 'DELEGADO_CUADRILLA',
        delegacionId: 'del-1',
        delegacionNombre: 'Las Ánimas',
        permisos: [],
        unidadNombre: 'Cuadrilla Norte',
        unidadActiva: false,
      },
      token: 'mock-token',
      cargando: false,
      autenticado: true,
      esPatrulla: false,
      esCuadrilla: true,
      unidadActiva: false,
      login: vi.fn(),
      logout: vi.fn(),
      recargarSesion: vi.fn(),
    });

    render(<CuadrillaMisionesPage />);

    expect(screen.getByText(/Cuadrilla Desactivada — Cuadrilla Norte/i)).toBeInTheDocument();
    expect(screen.getByText(/Historial de Faenas Operativas/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Modo histórico de solo lectura/i).length).toBeGreaterThanOrEqual(1);

    await waitFor(() => {
      expect(offlineQueue.guardarMisionesLocales).toHaveBeenCalled();
    });
  });
});
