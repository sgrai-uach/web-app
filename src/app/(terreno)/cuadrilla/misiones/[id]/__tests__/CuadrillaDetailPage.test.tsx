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
    vi.resetAllMocks();
    actualizarPendientesMock.mockResolvedValue(0);

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
      expect(mockPush).toHaveBeenCalledWith(
        '/cuadrilla/misiones?rechazo=ok&msg=Misi%C3%B3n+rechazada+exitosamente.'
      );
    });
  });

  it('oculta acciones si el estado no es DESPACHADA, si unidadActiva es false, esCuadrilla es false o SIN_ASIGNACION, y muestra justificación en RECHAZADA (BUG-H41-PWA-04)', async () => {
    // 1. Estado EN_CURSO
    vi.mocked(obtenerDetalleMision).mockResolvedValueOnce({
      ...misionDespachada,
      estado: 'EN_CURSO',
    });

    let unmount1!: () => void;
    await act(async () => {
      ({ unmount: unmount1 } = render(
        <Suspense fallback={null}>
          <CuadrillaMisionDetailPage params={Promise.resolve({ id: misionDespachada.id })} />
        </Suspense>
      ));
    });
    await waitFor(() => expect(screen.getByText('INC-2026-0001')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Rechazar Misión/i })).not.toBeInTheDocument();
    unmount1();

    // 2. Estado RECHAZADA con justificación
    vi.mocked(obtenerDetalleMision).mockResolvedValueOnce({
      ...misionDespachada,
      estado: 'RECHAZADA',
      datosAdicionales: { justificacionRechazo: 'Falla mecánica reportada previamente' },
    });

    let unmount2!: () => void;
    await act(async () => {
      ({ unmount: unmount2 } = render(
        <Suspense fallback={null}>
          <CuadrillaMisionDetailPage params={Promise.resolve({ id: misionDespachada.id })} />
        </Suspense>
      ));
    });
    await waitFor(() =>
      expect(screen.getByText('Falla mecánica reportada previamente')).toBeInTheDocument()
    );
    expect(screen.getByText(/Solo lectura/i)).toBeInTheDocument();
    unmount2();

    // 3. SIN_ASIGNACION y esCuadrilla false
    vi.mocked(useAuth).mockReturnValue({
      usuario: { id: 'u-1', nombre: 'Juan' },
      unidadActiva: false,
      tieneUnidadAsignada: false,
      estadoAsignacion: 'SIN_ASIGNACION',
      esCuadrilla: false,
      esPatrulla: false,
      tienePermiso: () => true,
    } as never);
    vi.mocked(obtenerDetalleMision).mockResolvedValueOnce(misionDespachada);

    await act(async () => {
      render(
        <Suspense fallback={null}>
          <CuadrillaMisionDetailPage params={Promise.resolve({ id: misionDespachada.id })} />
        </Suspense>
      );
    });
    await waitFor(() => expect(screen.getByText('INC-2026-0001')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Rechazar Misión/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Solo lectura/i)).toBeInTheDocument();
  });

  it('propaga errores HTTP 409/403 dentro del modal sin redirigir y captura coordenadas GPS cuando están disponibles (BUG-H41-PWA-04)', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn((ok) =>
          ok({ coords: { latitude: -39.8142, longitude: -73.2458 } })
        ),
      },
      configurable: true,
    });

    vi.mocked(rechazarMision).mockRejectedValueOnce(
      new Error('No está autorizado para rechazar esta misión.')
    );

    await act(async () => {
      render(
        <Suspense fallback={null}>
          <CuadrillaMisionDetailPage params={Promise.resolve({ id: misionDespachada.id })} />
        </Suspense>
      );
    });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Rechazar Misión/i })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: /Rechazar Misión/i }));
    fireEvent.change(screen.getByLabelText(/Motivo del Rechazo/i), {
      target: { value: 'Camión tolva con falla eléctrica' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar Rechazo/i }));

    await waitFor(() => {
      expect(rechazarMision).toHaveBeenCalledWith(misionDespachada.id, {
        justificacion_rechazo: 'Camión tolva con falla eléctrica',
        latitud: -39.8142,
        longitud: -73.2458,
      });
      expect(screen.getByRole('alert')).toHaveTextContent(
        'No está autorizado para rechazar esta misión.'
      );
    });
    expect(mockPush).not.toHaveBeenCalled();
  });
});
