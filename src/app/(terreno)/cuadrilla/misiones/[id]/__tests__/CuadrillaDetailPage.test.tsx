import React, { Suspense } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CuadrillaMisionDetailPage from '../page';
import { useAuth } from '@/context/AuthContext';
import { useConnectivity } from '@/hooks/useConnectivity';
import { obtenerDetalleMision, rechazarMision } from '@/services/misionesService';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/hooks/useConnectivity', () => ({
  useConnectivity: vi.fn(),
}));

vi.mock('@/services/misionesService', () => ({
  obtenerDetalleMision: vi.fn(),
  rechazarMision: vi.fn(),
}));

vi.mock('@/components/maps/MapaModal', () => ({
  MapaModal: () => null,
}));

const misionDespachada = {
  id: '70000000-0000-4000-8000-000000000001',
  incidenteId: '30000000-0000-4000-8000-000000000001',
  codigoIncidente: 'INC-2026-0001',
  tipologia: 'Árbol caído en calzada',
  direccion: 'Av. Ramón Picarte 1100, Valdivia',
  coordenadas: { lat: -39.81422, lng: -73.24589 },
  prioridad: 'ALTA',
  estado: 'DESPACHADA',
  fechaDespacho: '2026-11-16T22:00:00.000Z',
  actualizadoEn: '2026-11-16T22:00:00.000Z',
};

describe('CuadrillaMisionDetailPage — Rechazo Motivado (H41)', () => {
  const actualizarPendientesMock = vi.fn().mockResolvedValue(0);

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useConnectivity).mockReturnValue({
      status: 'synced',
      pendientes: 0,
      sincronizar: vi.fn(),
      actualizarPendientes: actualizarPendientesMock,
    } as never);

    vi.mocked(useAuth).mockReturnValue({
      usuario: {
        id: 'd0000000-0000-4000-8000-000000000001',
        nombre: 'Juan Delegado',
        unidadId: '50000000-0000-4000-8000-000000000001',
        unidadNombre: 'Cuadrilla Vías y Canales 1',
      },
      unidadActiva: true,
      tieneUnidadAsignada: true,
      estadoAsignacion: 'ACTIVA',
      esCuadrilla: true,
      esPatrulla: false,
      tienePermiso: (p: string) => p === 'misiones:terreno:ejecutar',
    } as never);

    vi.mocked(obtenerDetalleMision).mockResolvedValue(misionDespachada);
  });

  it('muestra el botón Rechazar Misión cuando la misión está DESPACHADA y el delegado tiene permiso', async () => {
    await act(async () => {
      render(
        <Suspense fallback={null}>
          <CuadrillaMisionDetailPage params={Promise.resolve({ id: misionDespachada.id })} />
        </Suspense>
      );
    });

    await waitFor(() => {
      expect(screen.getByText('INC-2026-0001')).toBeInTheDocument();
    });

    const btnRechazar = screen.getByRole('button', { name: /Rechazar Misión/i });
    expect(btnRechazar).toBeInTheDocument();
  });

  it('oculta el botón Rechazar Misión si la misión no está en estado DESPACHADA o falta el permiso RBAC', async () => {
    vi.mocked(useAuth).mockReturnValue({
      usuario: { id: '1', nombre: 'Juan' },
      unidadActiva: true,
      tieneUnidadAsignada: true,
      estadoAsignacion: 'ACTIVA',
      esCuadrilla: true,
      esPatrulla: false,
      tienePermiso: () => false,
    } as never);

    await act(async () => {
      render(
        <Suspense fallback={null}>
          <CuadrillaMisionDetailPage params={Promise.resolve({ id: misionDespachada.id })} />
        </Suspense>
      );
    });

    await waitFor(() => {
      expect(screen.getByText('INC-2026-0001')).toBeInTheDocument();
    });

    expect(
      screen.queryByRole('button', { name: /Rechazar Misión/i })
    ).not.toBeInTheDocument();
  });

  it('despliega el modal, bloquea envío con < 5 caracteres y ejecuta rechazo válido con retorno seguro', async () => {
    vi.mocked(rechazarMision).mockResolvedValueOnce({
      exito: true,
      mensaje: 'Misión rechazada exitosamente.',
    });

    await act(async () => {
      render(
        <Suspense fallback={null}>
          <CuadrillaMisionDetailPage params={Promise.resolve({ id: misionDespachada.id })} />
        </Suspense>
      );
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Rechazar Misión/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Rechazar Misión/i }));

    expect(
      screen.getByText('Rechazar Asignación de Cuadrilla')
    ).toBeInTheDocument();

    const btnConfirmar = screen.getByRole('button', { name: /Confirmar Rechazo/i });
    expect(btnConfirmar).toBeDisabled();

    const textarea = screen.getByLabelText(/Motivo del Rechazo/i);
    fireEvent.change(textarea, { target: { value: 'abc' } });
    expect(btnConfirmar).toBeDisabled();

    fireEvent.change(textarea, {
      target: { value: 'Camión tolva presenta falla hidráulica en salida.' },
    });
    expect(btnConfirmar).not.toBeDisabled();

    fireEvent.click(btnConfirmar);

    await waitFor(() => {
      expect(rechazarMision).toHaveBeenCalledWith(misionDespachada.id, {
        justificacion_rechazo: 'Camión tolva presenta falla hidráulica en salida.',
        latitud: undefined,
        longitud: undefined,
      });
    });

    await waitFor(() => {
      expect(actualizarPendientesMock).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/cuadrilla/misiones');
    });
  });
});
