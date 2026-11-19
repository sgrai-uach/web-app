import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CuadrillaMisionDetailPage from '../page';
import { useAuth } from '@/context/AuthContext';
import { useConnectivity } from '@/hooks/useConnectivity';
import { obtenerDetalleMision, rechazarMision } from '@/services/misionesService';
import { ToastProvider } from '@/components/ui/Toast';

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
    render(<CuadrillaMisionDetailPage params={{ id: misionDespachada.id } as unknown as Promise<{ id: string }>} />);

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

    render(<CuadrillaMisionDetailPage params={{ id: misionDespachada.id } as unknown as Promise<{ id: string }>} />);

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

    render(
      <ToastProvider>
        <CuadrillaMisionDetailPage params={{ id: misionDespachada.id } as unknown as Promise<{ id: string }>} />
      </ToastProvider>
    );

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
      expect(screen.getByText('Misión rechazada')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('Misión rechazada exitosamente.');
      expect(actualizarPendientesMock).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/cuadrilla/misiones');
    });
  });

  it('muestra el módulo Evidencia Multimedia (H43) cuando la misión está EN_CURSO y el usuario tiene permiso reportes:crear', async () => {
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
      tienePermiso: (p: string) =>
        p === 'misiones:terreno:ejecutar' || p === 'reportes:crear',
    } as never);

    vi.mocked(obtenerDetalleMision).mockResolvedValue({
      ...misionDespachada,
      estado: 'EN_CURSO',
    });

    render(<CuadrillaMisionDetailPage params={{ id: misionDespachada.id } as unknown as Promise<{ id: string }>} />);

    await waitFor(() => {
      expect(screen.getByText('Evidencia Multimedia')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Tomar Foto/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Grabar Video/i })).toBeInTheDocument();
  });

  it('oculta los controles de carga de evidencia si la misión está DESPACHADA o falta permiso reportes:crear', async () => {
    render(<CuadrillaMisionDetailPage params={{ id: misionDespachada.id } as unknown as Promise<{ id: string }>} />);

    await waitFor(() => {
      expect(screen.getByText('INC-2026-0001')).toBeInTheDocument();
    });

    expect(screen.queryByText('Evidencia Multimedia')).not.toBeInTheDocument();
  });
});
