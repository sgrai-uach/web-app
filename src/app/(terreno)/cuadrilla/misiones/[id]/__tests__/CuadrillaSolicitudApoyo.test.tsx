import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import CuadrillaMisionDetailPage from '../page';
import { useAuth } from '@/context/AuthContext';
import { useConnectivity } from '@/hooks/useConnectivity';
import * as misionesService from '@/services/misionesService';
import { solicitarApoyoAdicional } from '@/services/solicitudApoyoService';
import { ToastProvider } from '@/components/ui/Toast';
import type { MisionLocal } from '@/types/offline';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/hooks/useConnectivity', () => ({
  useConnectivity: vi.fn(),
}));

vi.mock('@/hooks/useTelemetry', () => ({
  useTelemetry: () => ({ estado: 'inactivo', reintentar: vi.fn() }),
}));

vi.mock('@/services/misionesService', async (importOriginal) => {
  const actual = await importOriginal<typeof misionesService>();
  return {
    ...actual,
    obtenerDetalleMision: vi.fn(),
  };
});

vi.mock('@/services/cierreCuadrillaService', () => ({
  cerrarMisionCuadrilla: vi.fn(),
  obtenerRecursosDisponiblesCuadrilla: vi.fn().mockResolvedValue([]),
  obtenerReporteCierreCuadrillaMision: vi.fn().mockReturnValue(null),
}));

vi.mock('@/services/solicitudApoyoService', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/services/solicitudApoyoService')>();
  return {
    ...actual,
    solicitarApoyoAdicional: vi.fn(),
  };
});

vi.mock('@/components/maps/MapaModal', () => ({
  MapaModal: () => null,
}));

const misionEnCurso: MisionLocal = {
  id: '70000000-0000-4000-8000-000000000044',
  incidenteId: '30000000-0000-4000-8000-000000000044',
  codigoIncidente: 'INC-2026-0044',
  tipologia: 'Árbol caído en calzada',
  direccion: 'Av. Ramón Picarte 1100, Valdivia',
  coordenadas: { lat: -39.81422, lng: -73.24589 },
  prioridad: 'ALTA',
  estado: 'EN_CURSO',
  fechaDespacho: '2026-11-23T18:00:00.000Z',
  fechaInicio: '2026-11-23T18:05:00.000Z',
  actualizadoEn: '2026-11-23T18:05:00.000Z',
};

describe('CuadrillaMisionDetailPage — Solicitud de Apoyo Adicional (HU-44)', () => {
  const actualizarPendientesMock = vi.fn().mockResolvedValue(0);

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useConnectivity).mockReturnValue({
      status: 'connected',
      pendientes: 0,
      sincronizar: vi.fn(),
      actualizarPendientes: actualizarPendientesMock,
    } as never);

    vi.mocked(useAuth).mockReturnValue({
      usuario: {
        id: 'd0000000-0000-4000-8000-000000000001',
        nombre: 'Juan Delegado',
        unidadId: '50000000-0000-4000-8000-000000000001',
        unidadNombre: 'Cuadrilla Vías 1',
      },
      unidadActiva: true,
      tieneUnidadAsignada: true,
      estadoAsignacion: 'ACTIVA',
      esCuadrilla: true,
      esPatrulla: false,
      tienePermiso: (p: string) =>
        p === 'misiones:terreno:ejecutar' || p === 'reportes:crear',
    } as never);
  });

  it('despliega "Solicitar Apoyo Adicional" en misión EN_CURSO con permiso reportes:crear y actualiza el badge al enviar', async () => {
    vi.mocked(misionesService.obtenerDetalleMision).mockResolvedValue(
      misionEnCurso
    );

    const misionActualizada: MisionLocal = {
      ...misionEnCurso,
      datosAdicionales: {
        requiereApoyoAdicional: true,
        solicitudesApoyoLocales: [
          {
            id: 'rep-apoyo-1',
            misionId: misionEnCurso.id,
            requiereApoyoAdicional: true,
            requiereCuadrillaAdicional: true,
            detalleApoyoRequerido: 'Se solicita motoniveladora y cuadrilla adicional',
            resumenTecnico: '',
            observaciones: '',
            creadoEn: '2026-11-23T18:20:00.000Z',
            sincronizado: true,
          },
        ],
      },
    };

    vi.mocked(solicitarApoyoAdicional).mockResolvedValueOnce({
      solicitud: {
        id: 'rep-apoyo-1',
        misionId: misionEnCurso.id,
        requiereApoyoAdicional: true,
        requiereCuadrillaAdicional: true,
        detalleApoyoRequerido: 'Se solicita motoniveladora y cuadrilla adicional',
        resumenTecnico: '',
        observaciones: '',
        creadoEn: '2026-11-23T18:20:00.000Z',
        sincronizado: true,
      },
      mision: misionActualizada,
      enColaOffline: false,
      mensaje:
        'Solicitud de apoyo enviada. La central logística y de operaciones ha sido alertada.',
    });

    render(
      <ToastProvider>
        <CuadrillaMisionDetailPage
          params={{ id: misionEnCurso.id } as unknown as Promise<{ id: string }>}
        />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Solicitar Apoyo Adicional')).toBeInTheDocument();
    });

    const checkbox = screen.getByRole('checkbox', {
      name: /Requiere apoyo adicional/i,
    });
    fireEvent.click(checkbox);
    fireEvent.click(
      screen.getByRole('checkbox', { name: /Requiere cuadrilla adicional/i })
    );

    fireEvent.change(screen.getByLabelText(/Detalle de apoyo requerido/i), {
      target: { value: 'Se solicita motoniveladora y cuadrilla adicional' },
    });

    fireEvent.click(
      screen.getByRole('button', { name: /Enviar Solicitud de Apoyo/i })
    );

    await waitFor(() => {
      expect(solicitarApoyoAdicional).toHaveBeenCalled();
      expect(actualizarPendientesMock).toHaveBeenCalled();
      expect(screen.getByText('Apoyo solicitado (1)')).toBeInTheDocument();
      expect(
        screen.getAllByText('Cuadrilla adicional solicitada').length
      ).toBeGreaterThanOrEqual(1);
    });
  });

  it('oculta "Solicitar Apoyo Adicional" cuando la misión está DESPACHADA o falta permiso reportes:crear', async () => {
    vi.mocked(misionesService.obtenerDetalleMision).mockResolvedValue({
      ...misionEnCurso,
      estado: 'DESPACHADA',
    });

    const { unmount } = render(
      <ToastProvider>
        <CuadrillaMisionDetailPage
          params={{ id: misionEnCurso.id } as unknown as Promise<{ id: string }>}
        />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('INC-2026-0044')).toBeInTheDocument();
    });
    expect(
      screen.queryByText('Solicitar Apoyo Adicional')
    ).not.toBeInTheDocument();

    unmount();

    vi.mocked(useAuth).mockReturnValue({
      usuario: {
        id: 'd0000000-0000-4000-8000-000000000001',
        nombre: 'Juan Delegado',
        unidadId: '50000000-0000-4000-8000-000000000001',
        unidadNombre: 'Cuadrilla Vías 1',
      },
      unidadActiva: true,
      tieneUnidadAsignada: true,
      estadoAsignacion: 'ACTIVA',
      esCuadrilla: true,
      esPatrulla: false,
      tienePermiso: (p: string) => p === 'misiones:terreno:ejecutar',
    } as never);

    vi.mocked(misionesService.obtenerDetalleMision).mockResolvedValue(
      misionEnCurso
    );

    render(
      <ToastProvider>
        <CuadrillaMisionDetailPage
          params={{ id: misionEnCurso.id } as unknown as Promise<{ id: string }>}
        />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Gestión Técnica de Faena')).toBeInTheDocument();
    });
    expect(
      screen.queryByText('Solicitar Apoyo Adicional')
    ).not.toBeInTheDocument();
  });

  it('muestra las solicitudes de apoyo registradas en modo solo lectura cuando la misión está COMPLETADA', async () => {
    vi.mocked(misionesService.obtenerDetalleMision).mockResolvedValue({
      ...misionEnCurso,
      estado: 'COMPLETADA',
      datosAdicionales: {
        reportesTerreno: [
          {
            id: 'rep-apoyo-cerrada',
            requiereApoyoAdicional: true,
            detalleApoyoRequerido: 'Camión grúa municipal',
            creadoEn: '2026-11-23T18:15:00.000Z',
          },
        ],
      },
    });

    render(
      <ToastProvider>
        <CuadrillaMisionDetailPage
          params={{ id: misionEnCurso.id } as unknown as Promise<{ id: string }>}
        />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Solicitar Apoyo Adicional')).toBeInTheDocument();
    });

    expect(screen.getByText('Camión grúa municipal')).toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: /Requiere apoyo adicional/i })
    ).not.toBeInTheDocument();
  });
});
