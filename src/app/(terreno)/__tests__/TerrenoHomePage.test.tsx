import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import TerrenoLayout from '../layout';
import TerrenoHomePage from '../page';
import type { AuthContextValue } from '@/context/AuthContext';

const mockUseAuth = vi.fn<() => AuthContextValue>();
const mockSincronizar = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/hooks/useConnectivity', () => ({
  useConnectivity: () => ({
    status: 'connected',
    pendientes: 2,
    sincronizar: mockSincronizar,
  }),
}));

function buildAuthMock(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  const rolCodigo = overrides.usuario?.rolCodigo || 'PATRULLA_VERIFICADORA';
  const esPatrulla = rolCodigo === 'PATRULLA_VERIFICADORA';
  const esCuadrilla = rolCodigo === 'DELEGADO_CUADRILLA';

  return {
    usuario: {
      id: 'usr-1',
      rut: '15.555.555-5',
      nombre: 'Camila Soto',
      email: 'patrulla@valdivia.cl',
      rolId: 'rol-patrulla',
      rolNombre: 'Patrulla Verificadora',
      rolCodigo: 'PATRULLA_VERIFICADORA',
      delegacionId: 'del-1',
      delegacionNombre: 'Delegación Centro',
      unidadNombre: 'Patrulla Alfa 01',
      unidadActiva: true,
      permisos: [],
    },
    token: 'jwt-token',
    cargando: false,
    autenticado: true,
    esPatrulla,
    esCuadrilla,
    unidadActiva: true,
    tienePermiso: (permiso: string) => {
      if (esPatrulla && permiso.startsWith('patrulla:')) return true;
      if (esCuadrilla && permiso.startsWith('cuadrilla:')) return true;
      return false;
    },
    tieneAlgunPermiso: (permisos: string[]) =>
      permisos.some((p) => {
        if (esPatrulla && p.startsWith('patrulla:')) return true;
        if (esCuadrilla && p.startsWith('cuadrilla:')) return true;
        return false;
      }),
    login: vi.fn(),
    logout: vi.fn(),
    recargarSesion: vi.fn(),
    ...overrides,
  };
}

describe('TerrenoHomePage & TerrenoBottomNav — Hub Operativo de Terreno', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza bienvenida, resumen operativo, módulos de Patrulla Verificadora y barra inferior', () => {
    mockUseAuth.mockReturnValue(buildAuthMock());

    render(
      <TerrenoLayout>
        <TerrenoHomePage />
      </TerrenoLayout>
    );

    expect(
      screen.getByRole('heading', { name: /bienvenido\/a, camila soto/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/patrulla alfa 01/i)).toBeInTheDocument();

    // Módulos de Patrulla Verificadora visibles
    expect(
      screen.getByRole('heading', { name: /bandeja de misiones de patrulla/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /triage, tipología y prioridad/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /bandeja de faenas de cuadrilla/i })
    ).not.toBeInTheDocument();

    // Barra de navegación inferior (TerrenoBottomNav)
    const navInferior = screen.getByRole('navigation', {
      name: /navegación principal de terreno/i,
    });
    expect(navInferior).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^misiones$/i })).toHaveAttribute(
      'href',
      '/patrulla/misiones'
    );
  });

  it('renderiza los módulos de Delegado de Cuadrilla y enlace a Faenas en la barra inferior', () => {
    mockUseAuth.mockReturnValue(
      buildAuthMock({
        usuario: {
          id: 'usr-2',
          rut: '16.666.666-6',
          nombre: 'Roberto Muñoz',
          email: 'cuadrilla@valdivia.cl',
          rolId: 'rol-cuadrilla',
          rolNombre: 'Delegado de Cuadrilla',
          rolCodigo: 'DELEGADO_CUADRILLA',
          delegacionId: 'del-1',
          delegacionNombre: 'Delegación Las Ánimas',
          unidadNombre: 'Cuadrilla Pesada 02',
          unidadActiva: true,
          permisos: [],
        },
        esPatrulla: false,
        esCuadrilla: true,
      })
    );

    render(
      <TerrenoLayout>
        <TerrenoHomePage />
      </TerrenoLayout>
    );

    expect(
      screen.getByRole('heading', { name: /bienvenido\/a, roberto muñoz/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /bandeja de faenas de cuadrilla/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /evidencia, apoyos y cierre de faena/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /bandeja de misiones de patrulla/i })
    ).not.toBeInTheDocument();

    expect(screen.getByRole('link', { name: /^faenas$/i })).toHaveAttribute(
      'href',
      '/cuadrilla/misiones'
    );
  });

  it('muestra advertencia de unidad inactiva y modo lectura cuando unidadActiva es false (H82/H85)', () => {
    mockUseAuth.mockReturnValue(
      buildAuthMock({
        unidadActiva: false,
      })
    );

    render(
      <TerrenoLayout>
        <TerrenoHomePage />
      </TerrenoLayout>
    );

    expect(screen.getByText(/modo histórico \(inactiva\)/i)).toBeInTheDocument();
    expect(
      screen.getAllByText(/solo lectura • unidad inactiva/i).length
    ).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /^historial$/i })).toHaveAttribute(
      'href',
      '/patrulla/misiones'
    );
  });
});
