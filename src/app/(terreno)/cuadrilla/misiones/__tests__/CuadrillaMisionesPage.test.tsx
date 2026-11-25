import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import CuadrillaMisionesPage from '../page';
import * as AuthContextModule from '@/context/AuthContext';
import * as offlineQueue from '@/services/offlineQueue';
import * as misionesService from '@/services/misionesService';

const mockReplace = vi.fn();
let mockSearchParamsValue = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParamsValue,
  useRouter: () => ({
    push: vi.fn(),
    replace: mockReplace,
  }),
  usePathname: () => '/cuadrilla/misiones',
}));

vi.mock('@/context/AuthContext');
vi.mock('@/services/offlineQueue');
vi.mock('@/services/misionesService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/misionesService')>();
  return {
    ...actual,
    sincronizarMisiones: vi.fn().mockResolvedValue([]),
  };
});

describe('CuadrillaMisionesPage — Modo Histórico Cuadrilla Desactivada (H82)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParamsValue = new URLSearchParams();
    vi.mocked(offlineQueue.obtenerMisionesLocales).mockResolvedValue([]);
    vi.mocked(offlineQueue.guardarMisionesLocales).mockResolvedValue();
    vi.mocked(misionesService.sincronizarMisiones).mockResolvedValue([]);
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

  it('refresca la bandeja ante sgrai:mision-rechazada y sgrai:outbox-synced y muestra el banner de confirmación tras rechazo (BUG-H41-PWA-03 / PWA-04)', async () => {
    mockSearchParamsValue = new URLSearchParams({
      rechazo: 'offline',
      msg: 'Rechazo registrado localmente. Se sincronizará automáticamente al recuperar la conexión.',
    });

    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      usuario: {
        id: 'u-cuad-act',
        rut: '11.111.111-1',
        nombre: 'Pedro Delegado',
        email: 'pdelegado@valdivia.cl',
        rolId: 'r-1',
        rolNombre: 'Delegado de Cuadrilla',
        rolCodigo: 'DELEGADO_CUADRILLA',
        delegacionId: 'del-1',
        delegacionNombre: 'Las Ánimas',
        permisos: ['misiones:terreno:ejecutar'],
        unidadId: 'cuad-1',
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

    render(<CuadrillaMisionesPage />);

    await waitFor(() => {
      expect(misionesService.sincronizarMisiones).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole('status')).toHaveTextContent(
      'Rechazo registrado localmente. Se sincronizará automáticamente al recuperar la conexión.'
    );

    fireEvent.click(screen.getByRole('button', { name: /Cerrar notificación de rechazo/i }));
    expect(mockReplace).toHaveBeenCalledWith('/cuadrilla/misiones', { scroll: false });

    act(() => {
      window.dispatchEvent(new CustomEvent('sgrai:mision-rechazada'));
      window.dispatchEvent(new CustomEvent('sgrai:outbox-synced'));
    });

    await waitFor(() => {
      expect(misionesService.sincronizarMisiones).toHaveBeenCalledTimes(3);
    });
  });
});
