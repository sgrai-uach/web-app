import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PatrullaMisionesPage from '../page';
import * as AuthContextModule from '@/context/AuthContext';
import * as offlineQueue from '@/services/offlineQueue';

vi.mock('@/context/AuthContext');
vi.mock('@/services/offlineQueue');

describe('PatrullaMisionesPage — Modo Histórico Patrulla Desactivada (H85)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(offlineQueue.obtenerMisionesLocales).mockResolvedValue([]);
    vi.mocked(offlineQueue.guardarMisionesLocales).mockResolvedValue();
  });

  it('muestra el banner de advertencia y el título de historial cuando la patrulla está desactivada', async () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      usuario: {
        id: 'u-pat-1',
        rut: '12.345.678-5',
        nombre: 'Mario Patrullero',
        email: 'mpatrullero@valdivia.cl',
        rolId: 'r-pat-1',
        rolNombre: 'Patrulla Verificadora',
        rolCodigo: 'PATRULLA_VERIFICADORA',
        delegacionId: 'del-1',
        delegacionNombre: 'Valdivia Sur',
        permisos: [],
        unidadNombre: 'Patrulla Móvil 02',
        unidadActiva: false,
      },
      token: 'mock-token',
      cargando: false,
      autenticado: true,
      esPatrulla: true,
      esCuadrilla: false,
      unidadActiva: false,
      login: vi.fn(),
      logout: vi.fn(),
      recargarSesion: vi.fn(),
    });

    render(<PatrullaMisionesPage />);

    expect(screen.getByText(/Patrulla Desactivada — Patrulla Móvil 02/i)).toBeInTheDocument();
    expect(screen.getByText(/Historial de Misiones de Triage/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Modo histórico de solo lectura/i).length).toBeGreaterThanOrEqual(1);

    await waitFor(() => {
      expect(offlineQueue.guardarMisionesLocales).toHaveBeenCalled();
    });
  });
});
