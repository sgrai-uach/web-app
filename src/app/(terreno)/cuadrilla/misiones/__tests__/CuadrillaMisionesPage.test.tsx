import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import CuadrillaMisionesPage from '../page';
import * as AuthContextModule from '@/context/AuthContext';
import * as offlineQueue from '@/services/offlineQueue';
import * as socketHook from '@/hooks/useMisionesSocket';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/cuadrilla/misiones',
}));

vi.mock('@/context/AuthContext');
vi.mock('@/services/offlineQueue');
vi.mock('@/hooks/useMisionesSocket');

describe('CuadrillaMisionesPage — Modo Histórico Cuadrilla Desactivada (H82)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(offlineQueue.obtenerMisionesLocales).mockResolvedValue([]);
    vi.mocked(offlineQueue.guardarMisionesLocales).mockResolvedValue();
    vi.mocked(socketHook.useMisionesSocket).mockReturnValue({
      conectado: false,
      ultimaMisionAsignada: null,
      descartarUltimaMision: vi.fn(),
    });
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
      tieneUnidadAsignada: true,
      estadoAsignacion: 'DESACTIVADA',
      tienePermiso: vi.fn().mockReturnValue(true),
      tieneAlgunPermiso: vi.fn().mockReturnValue(true),
      login: vi.fn(),
      logout: vi.fn(),
      recargarSesion: vi.fn(),
    });

    render(<CuadrillaMisionesPage />);

    expect(screen.getByText(/Cuadrilla Desactivada — Cuadrilla Norte/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /^historial$/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Sin registros disponibles/i)).toBeInTheDocument();
      expect(screen.getByText(/No se encontraron faenas históricas registradas para esta cuadrilla/i)).toBeInTheDocument();
    });
  });

  it('muestra el banner SinUnidadBanner cuando el funcionario no tiene cuadrilla asignada (SIN_ASIGNACION)', async () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      usuario: {
        id: 'u-cuad-2',
        rut: '11.111.111-1',
        nombre: 'Pedro Delegado',
        email: 'pdelegado@valdivia.cl',
        rolId: 'r-1',
        rolNombre: 'Delegado de Cuadrilla',
        rolCodigo: 'DELEGADO_CUADRILLA',
        delegacionId: 'del-1',
        delegacionNombre: 'Las Ánimas',
        permisos: [],
        unidadNombre: null,
        unidadActiva: false,
      },
      token: 'mock-token',
      cargando: false,
      autenticado: true,
      esPatrulla: false,
      esCuadrilla: true,
      unidadActiva: false,
      tieneUnidadAsignada: false,
      estadoAsignacion: 'SIN_ASIGNACION',
      tienePermiso: vi.fn().mockReturnValue(true),
      tieneAlgunPermiso: vi.fn().mockReturnValue(true),
      login: vi.fn(),
      logout: vi.fn(),
      recargarSesion: vi.fn(),
    });

    render(<CuadrillaMisionesPage />);

    expect(screen.getByText(/Sin Cuadrilla Asignada — Pedro Delegado/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /^misiones$/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText(/El funcionario no posee una cuadrilla asignada\. Solicite su asignación en el Centro de Mando\./i),
      ).toBeInTheDocument();
    });
  });

  it('navega usando ruta relativa a basePath (/cuadrilla/misiones/{id}) al pulsar Ver Misión Asignada en NuevaMisionBanner (BUG-INT-PWA-10)', async () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      usuario: {
        id: 'u-cuad-3',
        rut: '11.111.111-1',
        nombre: 'Pedro Delegado',
        email: 'pdelegado@valdivia.cl',
        rolId: 'r-1',
        rolNombre: 'Delegado de Cuadrilla',
        rolCodigo: 'DELEGADO_CUADRILLA',
        delegacionId: 'del-1',
        delegacionNombre: 'Las Ánimas',
        permisos: [],
        unidadId: 'cuad-01',
        unidadNombre: 'Cuadrilla Norte',
        unidadActiva: true,
      },
      token: 'mock-token',
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

    vi.mocked(socketHook.useMisionesSocket).mockReturnValue({
      conectado: true,
      ultimaMisionAsignada: {
        misionId: 'mis-cuad-99',
        codigo: 'INC-2026-0099',
        tipoMision: 'ATENCION_CUADRILLA',
        cuadrillaId: 'cuad-01',
        asignadoEn: '2026-11-24T12:00:00Z',
      },
      descartarUltimaMision: vi.fn(),
    });

    render(<CuadrillaMisionesPage />);

    const btnVer = await screen.findByRole('button', { name: /ver misión asignada/i });
    fireEvent.click(btnVer);

    expect(mockPush).toHaveBeenCalledWith('/cuadrilla/misiones/mis-cuad-99');
  });
});
