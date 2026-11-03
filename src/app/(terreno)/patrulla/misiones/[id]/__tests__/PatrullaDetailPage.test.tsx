import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import PatrullaMisionDetailPage from '../page';
import * as AuthContextModule from '@/context/AuthContext';
import * as misionesService from '@/services/misionesService';
import type { MisionLocal } from '@/types/offline';

vi.mock('@/context/AuthContext');
vi.mock('@/services/misionesService');
vi.mock('@/components/maps/MapaModal', () => ({
  MapaModal: () => <div data-testid="mapa-modal-mock" />,
}));

describe('PatrullaMisionDetailPage (H69 — Rechazo Motivado de Misión)', () => {
  const misionDespachada: MisionLocal = {
    id: 'mis-desp-1',
    incidenteId: 'inc-100',
    codigoIncidente: 'INC-2026-00100',
    tipologia: 'Caída de árbol en tendido',
    direccion: 'Av. Ramón Picarte 1520, Valdivia',
    prioridad: 'ALTA',
    estado: 'DESPACHADA',
    fechaDespacho: '2026-11-03T18:00:00Z',
    actualizadoEn: '2026-11-03T18:00:00Z',
    datosAdicionales: {
      trabajo: 'Verificar afectación de cables de media tensión.',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(misionesService.obtenerDetalleMision).mockResolvedValue(misionDespachada);
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      usuario: {
        id: 'u-pat-1',
        rut: '12.345.678-5',
        nombre: 'Mario Patrullero',
        email: 'mpatrullero@valdivia.cl',
        rolId: 'r-pat-1',
        rolNombre: 'Patrulla Verificadora',
        rolCodigo: 'PATRULLA_VERIFICADORA',
        delegacionId: 'del-1',
        delegacionNombre: 'Valdivia Sur',
        permisos: [],
        unidadNombre: 'Patrulla Móvil 01',
        unidadActiva: true,
      },
      token: 'mock-token',
      cargando: false,
      autenticado: true,
      esPatrulla: true,
      esCuadrilla: false,
      unidadActiva: true,
      tienePermiso: vi.fn().mockReturnValue(true),
      tieneAlgunPermiso: vi.fn().mockReturnValue(true),
      login: vi.fn(),
      logout: vi.fn(),
      recargarSesion: vi.fn(),
    });
  });

  it('muestra el botón "Rechazar Misión" cuando la misión está DESPACHADA y la unidad está activa', async () => {
    render(<PatrullaMisionDetailPage params={{ id: 'mis-desp-1' }} />);

    await waitFor(() => {
      expect(screen.getByText('INC-2026-00100')).toBeInTheDocument();
    });

    const botonRechazar = screen.getByRole('button', { name: /rechazar misión/i });
    expect(botonRechazar).toBeInTheDocument();
  });

  it('abre el modal de rechazo y permite rechazar motivadamente la misión con >= 5 caracteres', async () => {
    vi.mocked(misionesService.rechazarMision).mockResolvedValueOnce({
      exito: true,
      mensaje: 'Misión rechazada exitosamente.',
      mision: {
        id: 'mis-desp-1',
        codigo: 'INC-2026-00100',
        estado: 'RECHAZADA',
        justificacionRechazo: 'Desperfecto mecánico en radiador',
      },
    });

    render(<PatrullaMisionDetailPage params={{ id: 'mis-desp-1' }} />);

    await waitFor(() => {
      expect(screen.getByText('INC-2026-00100')).toBeInTheDocument();
    });

    // Abrir modal
    const botonRechazar = screen.getByRole('button', { name: /rechazar misión/i });
    fireEvent.click(botonRechazar);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /rechazar misión de verificación/i })).toBeInTheDocument();

    // Ingresar motivo válido
    const textarea = screen.getByLabelText(/motivo del rechazo/i);
    fireEvent.change(textarea, { target: { value: 'Desperfecto mecánico en radiador' } });

    // Confirmar
    const botonConfirmar = screen.getByRole('button', { name: /confirmar rechazo/i });
    fireEvent.click(botonConfirmar);

    await waitFor(() => {
      expect(misionesService.rechazarMision).toHaveBeenCalledWith(
        'mis-desp-1',
        expect.objectContaining({
          justificacion_rechazo: 'Desperfecto mecánico en radiador',
        })
      );
    });

    // Verificar que se muestre el banner de éxito y el banner de misión rechazada
    await waitFor(() => {
      expect(screen.getByText(/Misión rechazada exitosamente/i)).toBeInTheDocument();
      expect(screen.getByText(/Misión Rechazada por Patrulla Verificadora/i)).toBeInTheDocument();
      expect(screen.getByText(/Desperfecto mecánico en radiador/i)).toBeInTheDocument();
    });
  });

  it('no muestra el botón "Rechazar Misión" si la unidad está inactiva y muestra aviso de solo lectura', async () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      usuario: {
        id: 'u-pat-1',
        rut: '12.345.678-5',
        nombre: 'Mario Patrullero',
        email: 'mpatrullero@valdivia.cl',
        rolId: 'r-pat-1',
        rolNombre: 'Patrulla Verificadora',
        rolCodigo: 'PATRULLA_VERIFICADORA',
        delegacionId: 'del-1',
        delegacionNombre: 'Valdivia Sur',
        permisos: [],
        unidadNombre: 'Patrulla Móvil 01',
        unidadActiva: false,
      },
      token: 'mock-token',
      cargando: false,
      autenticado: true,
      esPatrulla: true,
      esCuadrilla: false,
      unidadActiva: false,
      tienePermiso: vi.fn().mockReturnValue(true),
      tieneAlgunPermiso: vi.fn().mockReturnValue(true),
      login: vi.fn(),
      logout: vi.fn(),
      recargarSesion: vi.fn(),
    });

    render(<PatrullaMisionDetailPage params={{ id: 'mis-desp-1' }} />);

    await waitFor(() => {
      expect(screen.getByText('INC-2026-00100')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /rechazar misión/i })).toBeNull();
    expect(screen.getAllByText(/solo lectura/i).length).toBeGreaterThanOrEqual(1);
  });

  it('muestra el banner descriptivo si la misión ya fue rechazada previamente', async () => {
    const misionRechazada: MisionLocal = {
      ...misionDespachada,
      estado: 'RECHAZADA',
      datosAdicionales: {
        justificacionRechazo: 'Vehículo en mantención programada',
      },
    };
    vi.mocked(misionesService.obtenerDetalleMision).mockResolvedValue(misionRechazada);

    render(<PatrullaMisionDetailPage params={{ id: 'mis-desp-1' }} />);

    await waitFor(() => {
      expect(screen.getByText(/Misión Rechazada por Patrulla Verificadora/i)).toBeInTheDocument();
      expect(screen.getByText(/Vehículo en mantención programada/i)).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /rechazar misión/i })).toBeNull();
  });
});
