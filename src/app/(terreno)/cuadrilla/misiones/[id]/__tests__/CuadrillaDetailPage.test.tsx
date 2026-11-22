import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CuadrillaMisionDetailPage from '../page';
import { useAuth } from '@/context/AuthContext';
import { useConnectivity } from '@/hooks/useConnectivity';
import {
  obtenerDetalleMision,
  aceptarMision,
  rechazarMision,
  MisionServiceError,
} from '@/services/misionesService';
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

vi.mock('@/services/misionesService', async () => {
  const actual = await vi.importActual<typeof import('@/services/misionesService')>(
    '@/services/misionesService'
  );
  return {
    MisionServiceError: actual.MisionServiceError,
    obtenerDetalleMision: vi.fn(),
    aceptarMision: vi.fn(),
    rechazarMision: vi.fn(),
  };
});

vi.mock('@/services/cierreCuadrillaService', () => ({
  cerrarMisionCuadrilla: vi.fn(),
  obtenerRecursosDisponiblesCuadrilla: vi.fn().mockResolvedValue([]),
  obtenerReporteCierreCuadrillaMision: vi.fn().mockReturnValue(null),
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

describe('CuadrillaMisionDetailPage — Aceptación de Asignación (H40)', () => {
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

    vi.mocked(obtenerDetalleMision).mockResolvedValue(misionDespachada);
  });

  it('muestra el botón principal "Aceptar Asignación" junto a "Rechazar Misión" cuando está DESPACHADA y tiene permiso misiones:terreno:ejecutar', async () => {
    render(
      <ToastProvider>
        <CuadrillaMisionDetailPage
          params={{ id: misionDespachada.id } as unknown as Promise<{ id: string }>}
        />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('INC-2026-0001')).toBeInTheDocument();
    });

    expect(
      screen.getByRole('button', { name: /Aceptar Asignación/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Rechazar Misión/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('formularios-reporte-tecnico')
    ).not.toBeInTheDocument();
  });

  it('oculta "Aceptar Asignación" cuando falta permiso misiones:terreno:ejecutar o la cuadrilla está inactiva', async () => {
    vi.mocked(useAuth).mockReturnValue({
      usuario: {
        id: 'd0000000-0000-4000-8000-000000000001',
        nombre: 'Juan Delegado',
        unidadId: '50000000-0000-4000-8000-000000000001',
        unidadNombre: 'Cuadrilla Vías y Canales 1',
      },
      unidadActiva: false,
      tieneUnidadAsignada: true,
      estadoAsignacion: 'DESACTIVADA',
      esCuadrilla: true,
      esPatrulla: false,
      tienePermiso: (p: string) => p === 'misiones:terreno:ejecutar',
    } as never);

    render(
      <CuadrillaMisionDetailPage
        params={{ id: misionDespachada.id } as unknown as Promise<{ id: string }>}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('INC-2026-0001')).toBeInTheDocument();
    });

    expect(
      screen.queryByRole('button', { name: /Aceptar Asignación/i })
    ).not.toBeInTheDocument();
  });

  it('al presionar "Aceptar Asignación" online transiciona a Faena en Curso, emite toast de éxito y habilita reportes y evidencia', async () => {
    const misionEnCurso = {
      ...misionDespachada,
      estado: 'EN_CURSO',
      fechaInicio: '2026-11-22T14:00:00.000Z',
      sincronizacionPendiente: false,
      datosAdicionales: {
        estadoCuadrilla: 'EN_MISION',
        estadoIncidente: 'EN_ATENCION',
        hitoAceptacion: 'Asignación Aceptada por Cuadrilla',
      },
      actualizadoEn: '2026-11-22T14:00:00.000Z',
    };

    vi.mocked(aceptarMision).mockResolvedValueOnce({
      mision: misionEnCurso,
      enColaOffline: false,
      mensaje:
        'Asignación de misión aceptada exitosamente. La cuadrilla inicia el desplazamiento y asume la atención del incidente.',
    });

    render(
      <ToastProvider>
        <CuadrillaMisionDetailPage
          params={{ id: misionDespachada.id } as unknown as Promise<{ id: string }>}
        />
      </ToastProvider>
    );

    const btnAceptar = await screen.findByRole('button', {
      name: /Aceptar Asignación/i,
    });
    fireEvent.click(btnAceptar);

    await waitFor(() => {
      expect(aceptarMision).toHaveBeenCalledWith(misionDespachada.id, {
        misionActual: misionDespachada,
        tipoUnidad: 'cuadrilla',
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Asignación aceptada')).toBeInTheDocument();
      expect(screen.getByText('Faena en Curso')).toBeInTheDocument();
    });

    expect(screen.getByText('Inicio de trayecto')).toBeInTheDocument();
    expect(screen.getAllByText('En curso').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('En misión')).toBeInTheDocument();
    expect(screen.getByText('En atención')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Aceptar Asignación/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Rechazar Misión/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId('formularios-reporte-tecnico')
    ).toBeInTheDocument();
    expect(screen.getByText('Evidencia Multimedia')).toBeInTheDocument();
    expect(actualizarPendientesMock).toHaveBeenCalled();
  });

  it('soporta aceptación offline mostrando toast de advertencia y limpia el estado pendiente al sincronizar outbox', async () => {
    vi.mocked(useConnectivity).mockReturnValue({
      status: 'offline',
      pendientes: 1,
      sincronizar: vi.fn(),
      actualizarPendientes: actualizarPendientesMock,
    } as never);

    vi.mocked(obtenerDetalleMision).mockResolvedValueOnce(misionDespachada);

    const misionOptimista = {
      ...misionDespachada,
      estado: 'EN_CURSO',
      fechaInicio: '2026-11-22T14:02:00.000Z',
      sincronizacionPendiente: true,
      actualizadoEn: '2026-11-22T14:02:00.000Z',
    };

    vi.mocked(aceptarMision).mockResolvedValueOnce({
      mision: misionOptimista,
      enColaOffline: true,
      mensaje:
        'Sin conexión: Asignación aceptada localmente y guardada en cola para sincronizar al recuperar señal.',
    });

    render(
      <ToastProvider>
        <CuadrillaMisionDetailPage
          params={{ id: misionDespachada.id } as unknown as Promise<{ id: string }>}
        />
      </ToastProvider>
    );

    const btnAceptar = await screen.findByRole('button', {
      name: /Aceptar Asignación/i,
    });
    fireEvent.click(btnAceptar);

    await waitFor(() => {
      expect(screen.getByText('Guardado sin conexión')).toBeInTheDocument();
      expect(screen.getByText('Faena en Curso')).toBeInTheDocument();
    });

    expect(screen.getByText(/Pendiente de sincronizar/i)).toBeInTheDocument();

    vi.mocked(obtenerDetalleMision).mockResolvedValueOnce({
      ...misionOptimista,
      sincronizacionPendiente: false,
    });

    window.dispatchEvent(new CustomEvent('sgrai:outbox-synced'));

    await waitFor(() => {
      expect(
        screen.queryByText(/Pendiente de sincronizar/i)
      ).not.toBeInTheDocument();
    });
  });

  it('emite toast informativo ante respuesta idempotente 409 EN_CURSO', async () => {
    vi.mocked(aceptarMision).mockResolvedValueOnce({
      mision: {
        ...misionDespachada,
        estado: 'EN_CURSO',
        fechaInicio: '2026-11-22T14:00:00.000Z',
        sincronizacionPendiente: false,
      },
      enColaOffline: false,
      yaAceptadaPreviamente: true,
      mensaje: 'La asignación ya se encuentra en curso (Faena en Curso).',
    });

    render(
      <ToastProvider>
        <CuadrillaMisionDetailPage
          params={{ id: misionDespachada.id } as unknown as Promise<{ id: string }>}
        />
      </ToastProvider>
    );

    const btnAceptar = await screen.findByRole('button', {
      name: /Aceptar Asignación/i,
    });
    fireEvent.click(btnAceptar);

    await waitFor(() => {
      expect(screen.getByText('Misión ya en curso')).toBeInTheDocument();
      expect(screen.getByText('Faena en Curso')).toBeInTheDocument();
    });
  });

  it('muestra alerta de error y toast sin transicionar cuando el backend rechaza la aceptación (403/409)', async () => {
    vi.mocked(aceptarMision).mockRejectedValueOnce(
      new MisionServiceError(
        403,
        'No cuenta con permisos para aceptar esta misión.'
      )
    );

    const { container } = render(
      <ToastProvider>
        <CuadrillaMisionDetailPage
          params={{ id: misionDespachada.id } as unknown as Promise<{ id: string }>}
        />
      </ToastProvider>
    );

    const btnAceptar = await screen.findByRole('button', {
      name: /Aceptar Asignación/i,
    });
    fireEvent.click(btnAceptar);

    await waitFor(() => {
      expect(
        screen.getByText('No se pudo aceptar la asignación')
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole('button', { name: /Aceptar Asignación/i })
    ).toBeInTheDocument();
    expect(screen.queryByText('Faena en Curso')).not.toBeInTheDocument();

    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(container.textContent || '')).toBe(false);
  });
});
