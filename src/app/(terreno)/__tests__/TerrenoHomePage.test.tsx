import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TerrenoHomePage from '../page';
import TerrenoLayout from '../layout';
import { useAuth } from '@/context/AuthContext';
import { useConnectivity } from '@/hooks/useConnectivity';
import type { AuthContextValue } from '@/context/AuthContext';

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/hooks/useConnectivity', () => ({
  useConnectivity: vi.fn(),
}));

vi.mock('@/services/offlineQueue', () => ({
  obtenerMisionesLocales: vi.fn().mockResolvedValue([]),
  guardarMisionesLocales: vi.fn().mockResolvedValue(undefined),
  obtenerMisionLocalPorId: vi.fn().mockResolvedValue(undefined),
  guardarMisionLocal: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/misionesService', () => ({
  sincronizarMisiones: vi.fn().mockResolvedValue([
    {
      id: 'mis-next-01',
      incidenteId: 'inc-01',
      codigoIncidente: 'INC-2026-00315',
      tipologia: 'Anegamiento de calzada',
      direccion: 'Costanera Arturo Prat 420',
      prioridad: 'CRITICA',
      estado: 'DESPACHADA',
      fechaDespacho: '2026-10-30T04:00:00Z',
      actualizadoEn: '2026-10-30T04:00:00Z',
    },
  ]),
  obtenerDetalleMision: vi.fn().mockResolvedValue(null),
}));

const mockUseAuth = vi.mocked(useAuth);
const mockUseConnectivity = vi.mocked(useConnectivity);

const mockSincronizar = vi.fn().mockResolvedValue(undefined);

function buildAuthMock(overrides?: Partial<AuthContextValue>): AuthContextValue {
  const esPatrulla = overrides?.esPatrulla ?? true;
  const esCuadrilla = overrides?.esCuadrilla ?? false;

  return {
    usuario: {
      id: 'usr-1',
      rut: '15.555.555-5',
      nombre: 'Camila Soto',
      email: 'csoto@valdivia.cl',
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
    unidadActiva: overrides?.unidadActiva ?? true,
    tieneUnidadAsignada: overrides?.tieneUnidadAsignada ?? true,
    estadoAsignacion: overrides?.estadoAsignacion ?? (overrides?.unidadActiva === false ? 'DESACTIVADA' : 'ACTIVA'),
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
    mockUseConnectivity.mockReturnValue({
      status: 'connected',
      pendientes: 0,
      sincronizando: false,
      sincronizar: mockSincronizar,
      online: true,
      actualizarPendientes: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('renderiza bienvenida, resumen operativo con enlaces a filtros, sincronización compacta y modal de confirmación al salir', async () => {
    const mockLogout = vi.fn();
    mockUseAuth.mockReturnValue(buildAuthMock({ logout: mockLogout }));

    render(
      <TerrenoLayout>
        <TerrenoHomePage />
      </TerrenoLayout>
    );

    // Bienvenida: nombre de operador, unidad y rol
    expect(
      screen.getByRole('heading', { name: /bienvenido\/a, camila soto/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/patrulla alfa 01 · patrulla verificadora/i)).toBeInTheDocument();

    // Sincronización compacta
    expect(screen.getByText(/sincronizado recién/i)).toBeInTheDocument();
    const btnSync = screen.getByRole('button', { name: /sincronizar ahora/i });
    fireEvent.click(btnSync);
    expect(mockSincronizar).toHaveBeenCalledTimes(1);

    // Resumen Operativo: enlaces a las listas filtradas
    expect(screen.getByRole('link', { name: /ver 0 misiones pendientes/i })).toHaveAttribute(
      'href',
      '/patrulla/misiones?estado=pendientes'
    );
    expect(screen.getByRole('link', { name: /ver 0 misiones en curso/i })).toHaveAttribute(
      'href',
      '/patrulla/misiones?estado=en_curso'
    );

    // Misiones en atención (tarjetas compactas)
    await waitFor(() => {
      expect(screen.getByText(/misiones en atención/i)).toBeInTheDocument();
      expect(screen.getByText('INC-2026-00315')).toBeInTheDocument();
      expect(screen.getByText('Anegamiento de calzada')).toBeInTheDocument();
    });

    // Barra de navegación inferior con Inicio, Misiones y Perfil
    const navInferior = screen.getByRole('navigation', {
      name: /navegación principal de terreno/i,
    });
    expect(navInferior).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^misiones$/i })).toHaveAttribute(
      'href',
      '/patrulla/misiones'
    );
    expect(screen.getByRole('link', { name: /^perfil$/i })).toHaveAttribute(
      'href',
      '/perfil'
    );
  });

  it('renderiza enlaces a Faenas para el Delegado de Cuadrilla', async () => {
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

    expect(screen.getByRole('link', { name: /^faenas$/i })).toHaveAttribute(
      'href',
      '/cuadrilla/misiones'
    );
  });

  it('muestra banner de advertencia cuando la unidad está inactiva (H82/H85)', async () => {
    mockUseAuth.mockReturnValue(
      buildAuthMock({
        unidadActiva: false,
        usuario: {
          id: 'usr-1',
          rut: '15.555.555-5',
          nombre: 'Camila Soto',
          email: 'csoto@valdivia.cl',
          rolId: 'rol-patrulla',
          rolNombre: 'Patrulla Verificadora',
          rolCodigo: 'PATRULLA_VERIFICADORA',
          delegacionId: 'del-1',
          delegacionNombre: 'Delegación Centro',
          unidadNombre: 'Patrulla Alfa 01',
          unidadActiva: false,
          permisos: [],
        },
      })
    );

    render(
      <TerrenoLayout>
        <TerrenoHomePage />
      </TerrenoLayout>
    );

    expect(screen.getByText(/patrulla desactivada/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^historial$/i })).toHaveAttribute(
      'href',
      '/patrulla/misiones'
    );
  });
});
