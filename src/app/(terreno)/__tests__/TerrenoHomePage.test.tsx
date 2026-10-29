import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

vi.mock('@/services/offlineQueue', () => ({
  obtenerMisionesLocales: vi.fn().mockResolvedValue([
    {
      id: 'm-1',
      incidenteId: 'inc-1',
      codigoIncidente: 'INC-2026-0001',
      tipologia: 'CAIDA_ARBOL',
      direccion: 'Av. Alemania 600',
      prioridad: 'ALTA',
      estado: 'EN_CURSO',
      fechaDespacho: '2026-10-29T10:00:00Z',
      actualizadoEn: '2026-10-29T10:05:00Z',
    },
  ]),
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

  it('renderiza bienvenida simplificada, resumen operativo, sincronización fuera de línea y barra inferior con botón Salir', () => {
    const mockLogout = vi.fn();
    mockUseAuth.mockReturnValue(buildAuthMock({ logout: mockLogout }));

    render(
      <TerrenoLayout>
        <TerrenoHomePage />
      </TerrenoLayout>
    );

    // Bienvenida: solo nombre y rol
    expect(
      screen.getByRole('heading', { name: /bienvenido\/a, camila soto/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/rol: patrulla verificadora/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/dirección de gestión de riesgos de desastres/i)
    ).not.toBeInTheDocument();

    // Resumen Operativo y Sincronización fuera de línea
    expect(
      screen.getByRole('heading', { name: /resumen operativo/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/sincronización fuera de línea/i)).toBeInTheDocument();
    expect(screen.getByText(/conexión estable con el servidor\./i)).toBeInTheDocument();

    const btnSincronizar = screen.getByRole('button', { name: /sincronizar/i });
    fireEvent.click(btnSincronizar);
    expect(mockSincronizar).toHaveBeenCalledTimes(1);

    // Módulos de Patrulla Verificadora visibles sin badges superiores
    expect(
      screen.getByRole('heading', { name: /bandeja de misiones de patrulla/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /triage, tipología y prioridad/i })
    ).toBeInTheDocument();
    expect(screen.queryByText(/operativo • h35/i)).not.toBeInTheDocument();

    // Barra de navegación inferior (Inicio, Misiones, Salir)
    const navInferior = screen.getByRole('navigation', {
      name: /navegación principal de terreno/i,
    });
    expect(navInferior).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^misiones$/i })).toHaveAttribute(
      'href',
      '/patrulla/misiones'
    );

    const btnSalir = screen.getByRole('button', { name: /^salir$/i });
    fireEvent.click(btnSalir);
    expect(mockLogout).toHaveBeenCalledTimes(1);
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

    expect(screen.getByRole('link', { name: /^faenas$/i })).toHaveAttribute(
      'href',
      '/cuadrilla/misiones'
    );
  });

  it('muestra banner de unidad inactiva y botones en modo lectura cuando unidadActiva es false (H82/H85)', () => {
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

    expect(
      screen.getAllByRole('link', { name: /ver en modo lectura/i }).length
    ).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /^historial$/i })).toHaveAttribute(
      'href',
      '/patrulla/misiones'
    );
  });
});
