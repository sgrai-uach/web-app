import React, { Suspense } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import CuadrillaMisionDetailPage from '../page';
import * as AuthContextModule from '@/context/AuthContext';
import * as misionesService from '@/services/misionesService';
import type { MisionLocal } from '@/types/offline';

vi.mock('@/context/AuthContext');
vi.mock('@/services/misionesService');

const misionCuadrillaEnCursoMock: MisionLocal = {
  id: '70000000-0000-4000-8000-000000000002',
  incidenteId: 'b0000000-0000-4000-8000-000000000002',
  codigoIncidente: 'INC-2026-0002',
  tipologia: 'Despeje de vía pública',
  direccion: 'Calle Esmeralda 450, Valdivia',
  coordenadas: { lat: -39.8142, lng: -73.2459 },
  prioridad: 'CRITICA',
  estado: 'EN_CURSO',
  fechaDespacho: '2026-11-02T10:00:00.000Z',
  datosAdicionales: {
    trabajo: 'Corte de troncos y despeje con motosierra',
  },
  actualizadoEn: '2026-11-02T10:00:00.000Z',
};

function configurarAuthCuadrillaMock(opciones?: {
  unidadActiva?: boolean;
  tieneUnidadAsignada?: boolean;
  estadoAsignacion?: 'ACTIVA' | 'DESACTIVADA' | 'SIN_ASIGNACION';
}) {
  const tieneUnidadAsignada = opciones?.tieneUnidadAsignada ?? true;
  const unidadActiva = tieneUnidadAsignada ? (opciones?.unidadActiva ?? true) : false;
  const estadoAsignacion =
    opciones?.estadoAsignacion ??
    (!tieneUnidadAsignada ? 'SIN_ASIGNACION' : unidadActiva ? 'ACTIVA' : 'DESACTIVADA');

  vi.mocked(AuthContextModule.useAuth).mockReturnValue({
    usuario: {
      id: '00000000-0000-4000-8000-000000000005',
      rut: '13.456.789-0',
      nombre: 'Delegado Cuadrilla Líder',
      email: 'cuadrilla@valdivia.cl',
      rolId: 'rol-cuadrilla',
      rolNombre: 'Delegado de Cuadrilla',
      rolCodigo: 'DELEGADO_CUADRILLA',
      delegacionId: 'del-2',
      delegacionNombre: 'Valdivia Sur',
      permisos: ['misiones:terreno:operar'],
      unidadNombre: tieneUnidadAsignada ? 'Cuadrilla Pesada Alfa' : null,
      unidadId: tieneUnidadAsignada ? 'c1000000-0000-4000-8000-000000000060' : null,
      unidadActiva,
    },
    token: 'jwt-cuadrilla-token',
    cargando: false,
    autenticado: true,
    esPatrulla: false,
    esCuadrilla: true,
    unidadActiva,
    tieneUnidadAsignada,
    estadoAsignacion,
    tienePermiso: vi.fn().mockReturnValue(true),
    tieneAlgunPermiso: vi.fn().mockReturnValue(true),
    login: vi.fn(),
    logout: vi.fn(),
    recargarSesion: vi.fn(),
  });
}

describe('CuadrillaDetailPage — Telemetría GPS en faena activa (HU-70)', () => {
  let mockGetCurrentPosition: ReturnType<typeof vi.fn>;
  let originalGeolocation: Geolocation | undefined;

  beforeEach(() => {
    vi.clearAllMocks();

    mockGetCurrentPosition = vi.fn((success) => {
      success({
        coords: {
          latitude: -39.8142,
          longitude: -73.2459,
          heading: 90,
          accuracy: 6.0,
          speed: 0,
        },
        timestamp: Date.now(),
      });
    });

    originalGeolocation = navigator.geolocation;
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: mockGetCurrentPosition,
        watchPosition: vi.fn(),
        clearWatch: vi.fn(),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalGeolocation) {
      Object.defineProperty(navigator, 'geolocation', {
        value: originalGeolocation,
        writable: true,
        configurable: true,
      });
    }
  });

  it('despliega el badge "GPS activo" cuando la cuadrilla tiene misión EN_CURSO y unidad activa', async () => {
    configurarAuthCuadrillaMock({ unidadActiva: true });
    vi.mocked(misionesService.obtenerDetalleMision).mockResolvedValue(misionCuadrillaEnCursoMock);

    await act(async () => {
      render(
        <Suspense fallback={<div>Cargando...</div>}>
          <CuadrillaMisionDetailPage
            params={Promise.resolve({ id: misionCuadrillaEnCursoMock.id })}
          />
        </Suspense>
      );
    });

    await waitFor(() => {
      expect(screen.getByText('INC-2026-0002')).toBeInTheDocument();
    });

    expect(screen.getByText('GPS activo')).toBeInTheDocument();
    expect(mockGetCurrentPosition).toHaveBeenCalled();
  });

  it('no muestra "GPS activo" si la misión está FINALIZADA', async () => {
    configurarAuthCuadrillaMock({ unidadActiva: true });
    vi.mocked(misionesService.obtenerDetalleMision).mockResolvedValue({
      ...misionCuadrillaEnCursoMock,
      estado: 'FINALIZADA',
    });

    await act(async () => {
      render(
        <Suspense fallback={<div>Cargando...</div>}>
          <CuadrillaMisionDetailPage
            params={Promise.resolve({ id: misionCuadrillaEnCursoMock.id })}
          />
        </Suspense>
      );
    });

    await waitFor(() => {
      expect(screen.getByText('INC-2026-0002')).toBeInTheDocument();
    });

    expect(screen.queryByText('GPS activo')).not.toBeInTheDocument();
  });
});
