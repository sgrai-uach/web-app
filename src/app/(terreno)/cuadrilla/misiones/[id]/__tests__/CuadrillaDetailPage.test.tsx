import React, { Suspense } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import CuadrillaMisionDetailPage from '../page';
import * as AuthContextModule from '@/context/AuthContext';
import * as misionesService from '@/services/misionesService';
import * as useConnectivityModule from '@/hooks/useConnectivity';
import type { MisionLocal } from '@/types/offline';

vi.mock('@/context/AuthContext');
vi.mock('@/services/misionesService', async (importOriginal) => {
  const actual = await importOriginal<typeof misionesService>();
  return {
    ...actual,
    obtenerDetalleMision: vi.fn(),
    reportarLlegadaCuadrilla: vi.fn(),
  };
});
vi.mock('@/hooks/useConnectivity');

describe('CuadrillaMisionDetailPage — Reporte de Llegada a Terreno (H42)', () => {
  const mockMisionDespachada: MisionLocal = {
    id: 'mis-cuadrilla-100',
    incidenteId: 'inc-100',
    codigoIncidente: 'INC-2026-00100',
    tipologia: 'Caída de árbol en tendido eléctrico',
    direccion: 'Av. Ramón Picarte 1100, Valdivia',
    coordenadas: { lat: -39.81422, lng: -73.24591 },
    prioridad: 'ALTA',
    estado: 'DESPACHADA',
    fechaDespacho: '2026-11-08T19:00:00Z',
    actualizadoEn: '2026-11-08T19:00:00Z',
    datosAdicionales: {
      trabajo: 'Despeje preventivo de calzada y trozado de ramas mayores.',
    },
  };

  function configurarAuthMock(opciones?: {
    unidadActiva?: boolean;
    permisoEjecutar?: boolean;
  }) {
    const unidadActiva = opciones?.unidadActiva ?? true;
    const permisoEjecutar = opciones?.permisoEjecutar ?? true;

    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      usuario: {
        id: 'delegado-01',
        rut: '12.345.678-5',
        nombre: 'Pedro Delegado',
        email: 'pdelegado@valdivia.cl',
        rolId: 'rol-cuadrilla',
        rolNombre: 'Delegado de Cuadrilla',
        rolCodigo: 'DELEGADO_CUADRILLA',
        delegacionId: 'del-01',
        delegacionNombre: 'Las Ánimas',
        unidadNombre: 'Cuadrilla Rescate Arbolado',
        unidadActiva,
        permisos: permisoEjecutar ? ['misiones:terreno:ejecutar'] : [],
      },
      token: 'token-valido',
      cargando: false,
      autenticado: true,
      esPatrulla: false,
      esCuadrilla: true,
      unidadActiva,
      tienePermiso: vi
        .fn()
        .mockImplementation(
          (permiso: string) => permisoEjecutar && permiso === 'misiones:terreno:ejecutar'
        ),
      tieneAlgunPermiso: vi.fn().mockReturnValue(permisoEjecutar),
      login: vi.fn(),
      logout: vi.fn(),
      recargarSesion: vi.fn(),
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    configurarAuthMock({ unidadActiva: true, permisoEjecutar: true });
    vi.mocked(useConnectivityModule.useConnectivity).mockReturnValue({
      online: true,
      sincronizando: false,
      pendientes: 0,
      status: 'connected',
      sincronizar: vi.fn(),
      actualizarPendientes: vi.fn().mockResolvedValue(undefined),
    });
    vi.mocked(misionesService.obtenerDetalleMision).mockResolvedValue(mockMisionDespachada);
  });

  it('debe renderizar el botón destacado "Llegada a Terreno" cuando la misión está DESPACHADA y el delegado tiene permisos', async () => {
    await act(async () => {
      render(
        <Suspense fallback={<div>Cargando...</div>}>
          <CuadrillaMisionDetailPage
            params={Promise.resolve({ id: mockMisionDespachada.id })}
          />
        </Suspense>
      );
    });

    await waitFor(() => {
      expect(screen.getByText('INC-2026-00100')).toBeInTheDocument();
    });

    const botonLlegada = screen.getByRole('button', { name: /llegada a terreno/i });
    expect(botonLlegada).toBeInTheDocument();
    expect(screen.getByText(/confirmación de arribo/i)).toBeInTheDocument();
  });

  it('al presionar "Llegada a Terreno" debe invocar reportarLlegadaCuadrilla y transicionar a "En Trabajos de Terreno"', async () => {
    const mockMisionEnCurso: MisionLocal = {
      ...mockMisionDespachada,
      estado: 'EN_CURSO',
      fechaLlegada: '2026-11-08T19:30:00.000Z',
      fechaInicio: '2026-11-08T19:30:00.000Z',
    };

    vi.mocked(misionesService.reportarLlegadaCuadrilla).mockResolvedValue({
      mision: mockMisionEnCurso,
      enColaOffline: false,
      mensaje: 'Llegada a terreno reportada exitosamente.',
    });

    await act(async () => {
      render(
        <Suspense fallback={<div>Cargando...</div>}>
          <CuadrillaMisionDetailPage
            params={Promise.resolve({ id: mockMisionDespachada.id })}
          />
        </Suspense>
      );
    });

    const botonLlegada = await screen.findByRole('button', { name: /llegada a terreno/i });

    await act(async () => {
      fireEvent.click(botonLlegada);
    });

    expect(misionesService.reportarLlegadaCuadrilla).toHaveBeenCalledWith(
      mockMisionDespachada.id,
      expect.objectContaining({
        usarUbicacionMision: false,
      })
    );

    await waitFor(() => {
      expect(screen.getByText(/en trabajos de terreno/i)).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /llegada a terreno/i })).not.toBeInTheDocument();
  });

  it('debe manejar error de GPS denegado y permitir la contingencia con ubicación de la misión', async () => {
    vi.mocked(misionesService.reportarLlegadaCuadrilla).mockRejectedValueOnce(
      new misionesService.GeolocationError(
        'PERMISO_DENEGADO',
        'Permiso de ubicación denegado. Active los permisos de GPS en su navegador.'
      )
    );

    await act(async () => {
      render(
        <Suspense fallback={<div>Cargando...</div>}>
          <CuadrillaMisionDetailPage
            params={Promise.resolve({ id: mockMisionDespachada.id })}
          />
        </Suspense>
      );
    });

    const botonLlegada = await screen.findByRole('button', { name: /llegada a terreno/i });

    await act(async () => {
      fireEvent.click(botonLlegada);
    });

    await waitFor(() => {
      expect(
        screen.getByText(/permiso de ubicación denegado/i)
      ).toBeInTheDocument();
    });

    // Debe desplegarse el botón de contingencia
    const botonContingencia = screen.getByRole('button', {
      name: /registrar llegada con ubicación de la misión/i,
    });
    expect(botonContingencia).toBeInTheDocument();

    const mockMisionEnCurso: MisionLocal = {
      ...mockMisionDespachada,
      estado: 'EN_CURSO',
      fechaLlegada: '2026-11-08T19:35:00.000Z',
    };

    vi.mocked(misionesService.reportarLlegadaCuadrilla).mockResolvedValueOnce({
      mision: mockMisionEnCurso,
      enColaOffline: false,
      mensaje: 'Llegada registrada exitosamente con ubicación de contingencia.',
    });

    await act(async () => {
      fireEvent.click(botonContingencia);
    });

    expect(misionesService.reportarLlegadaCuadrilla).toHaveBeenCalledWith(
      mockMisionDespachada.id,
      expect.objectContaining({
        usarUbicacionMision: true,
      })
    );

    await waitFor(() => {
      expect(screen.getByText(/en trabajos de terreno/i)).toBeInTheDocument();
    });
  });

  it('no debe mostrar el botón de llegada y debe mostrar "Solo lectura" si la misión ya está COMPLETADA', async () => {
    const mockMisionCompletada: MisionLocal = {
      ...mockMisionDespachada,
      estado: 'COMPLETADA',
    };
    vi.mocked(misionesService.obtenerDetalleMision).mockResolvedValue(mockMisionCompletada);

    await act(async () => {
      render(
        <Suspense fallback={<div>Cargando...</div>}>
          <CuadrillaMisionDetailPage
            params={Promise.resolve({ id: mockMisionDespachada.id })}
          />
        </Suspense>
      );
    });

    await waitFor(() => {
      expect(screen.getByText('INC-2026-00100')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /llegada a terreno/i })).not.toBeInTheDocument();
    expect(screen.getByText(/solo lectura/i)).toBeInTheDocument();
  });
});
