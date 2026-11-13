import React, { Suspense } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import PatrullaMisionDetailPage from '../page';
import * as AuthContextModule from '@/context/AuthContext';
import * as misionesService from '@/services/misionesService';
import * as useConnectivityModule from '@/hooks/useConnectivity';
import type { MisionLocal } from '@/types/offline';

vi.mock('@/context/AuthContext');
vi.mock('@/services/misionesService');
vi.mock('@/hooks/useConnectivity');
vi.mock('@/components/maps/MapaModal', () => ({
  MapaModal: () => <div data-testid="mapa-modal-mock" />,
}));

const misionDespachadaMock: MisionLocal = {
  id: '60000000-0000-4000-8000-000000000001',
  incidenteId: 'a0000000-0000-4000-8000-000000000001',
  codigoIncidente: 'INC-2026-0001',
  tipologia: 'Caída de árbol',
  direccion: 'Av. Ramón Picarte 1200, Valdivia',
  coordenadas: { lat: -39.819588, lng: -73.245209 },
  prioridad: 'ALTA',
  estado: 'DESPACHADA',
  fechaDespacho: '2026-11-01T20:30:00.000Z',
  datosAdicionales: {
    trabajo: 'Evaluar caída de árbol sobre calzada',
  },
  actualizadoEn: '2026-11-01T20:30:00.000Z',
};

function configurarAuthMock(opciones?: {
  unidadActiva?: boolean;
  permisoVerificar?: boolean;
}) {
  const unidadActiva = opciones?.unidadActiva ?? true;
  const permisoVerificar = opciones?.permisoVerificar ?? true;

  vi.mocked(AuthContextModule.useAuth).mockReturnValue({
    usuario: {
      id: '00000000-0000-4000-8000-000000000004',
      rut: '12.345.678-5',
      nombre: 'Patrullero Líder',
      email: 'patrulla@valdivia.cl',
      rolId: 'rol-patrulla',
      rolNombre: 'Patrulla Verificadora',
      rolCodigo: 'PATRULLA_VERIFICADORA',
      delegacionId: 'del-1',
      delegacionNombre: 'Valdivia Norte',
      permisos: permisoVerificar ? ['misiones:terreno:verificar'] : [],
      unidadNombre: 'Patrulla Rápida Costa-1',
      unidadActiva,
    },
    token: 'jwt-mock-token',
    cargando: false,
    autenticado: true,
    esPatrulla: true,
    esCuadrilla: false,
    unidadActiva,
    tieneUnidadAsignada: true,
    estadoAsignacion: unidadActiva ? 'ACTIVA' : 'DESACTIVADA',
    tienePermiso: vi
      .fn()
      .mockImplementation((permiso: string) =>
        permisoVerificar && permiso === 'misiones:terreno:verificar'
      ),
    tieneAlgunPermiso: vi.fn().mockReturnValue(permisoVerificar),
    login: vi.fn(),
    logout: vi.fn(),
    recargarSesion: vi.fn(),
  });
}

describe('PatrullaMisionDetailPage — Confirmar y aceptar misión asignada (HU-36)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useConnectivityModule.useConnectivity).mockReturnValue({
      online: true,
      sincronizando: false,
      pendientes: 0,
      status: 'connected',
      sincronizar: vi.fn(),
      actualizarPendientes: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('presenta el botón prominente "Aceptar Misión" cuando el estado es DESPACHADA y tiene el permiso misiones:terreno:verificar', async () => {
    configurarAuthMock({ unidadActiva: true, permisoVerificar: true });
    vi.mocked(misionesService.obtenerDetalleMision).mockResolvedValue(misionDespachadaMock);

    await act(async () => {
      render(
        <Suspense fallback={<div>Cargando...</div>}>
          <PatrullaMisionDetailPage
            params={Promise.resolve({ id: misionDespachadaMock.id })}
          />
        </Suspense>
      );
    });

    await waitFor(() => {
      expect(screen.getByText('INC-2026-0001')).toBeInTheDocument();
    });

    const botonAceptar = screen.getByRole('button', { name: /aceptar misi[oó]n/i });
    expect(botonAceptar).toBeInTheDocument();
    expect(
      screen.queryByTestId('formularios-reporte-tecnico')
    ).not.toBeInTheDocument();
  });

  it('oculta el botón "Aceptar Misión" si el usuario no cuenta con el permiso misiones:terreno:verificar', async () => {
    configurarAuthMock({ unidadActiva: true, permisoVerificar: false });
    vi.mocked(misionesService.obtenerDetalleMision).mockResolvedValue(misionDespachadaMock);

    await act(async () => {
      render(
        <Suspense fallback={<div>Cargando...</div>}>
          <PatrullaMisionDetailPage
            params={Promise.resolve({ id: misionDespachadaMock.id })}
          />
        </Suspense>
      );
    });

    await waitFor(() => {
      expect(screen.getByText('INC-2026-0001')).toBeInTheDocument();
    });

    expect(
      screen.queryByRole('button', { name: /aceptar misi[oó]n/i })
    ).not.toBeInTheDocument();
  });

  it('al presionar "Aceptar Misión", invoca aceptarMisionPatrulla y cambia la vista a "En Trayecto / Evaluación" habilitando los formularios técnicos', async () => {
    configurarAuthMock({ unidadActiva: true, permisoVerificar: true });
    vi.mocked(misionesService.obtenerDetalleMision).mockResolvedValue(misionDespachadaMock);

    const misionEnCurso: MisionLocal = {
      ...misionDespachadaMock,
      estado: 'EN_CURSO',
      fechaInicio: '2026-11-01T21:00:00.000Z',
      sincronizacionPendiente: false,
      datosAdicionales: {
        ...misionDespachadaMock.datosAdicionales,
        estadoPatrulla: 'EN_VERIFICACION',
        estadoIncidente: 'VERIFICANDO',
      },
      actualizadoEn: '2026-11-01T21:00:00.000Z',
    };

    vi.mocked(misionesService.aceptarMisionPatrulla).mockResolvedValue({
      mision: misionEnCurso,
      enColaOffline: false,
      mensaje:
        'Misión aceptada exitosamente. La patrulla se encuentra en trayecto para iniciar la evaluación.',
    });

    await act(async () => {
      render(
        <Suspense fallback={<div>Cargando...</div>}>
          <PatrullaMisionDetailPage
            params={Promise.resolve({ id: misionDespachadaMock.id })}
          />
        </Suspense>
      );
    });

    const botonAceptar = await screen.findByRole('button', {
      name: /aceptar misi[oó]n/i,
    });

    await act(async () => {
      fireEvent.click(botonAceptar);
    });

    expect(misionesService.aceptarMisionPatrulla).toHaveBeenCalledWith(
      misionDespachadaMock.id,
      expect.objectContaining({ misionActual: misionDespachadaMock })
    );

    // El botón Aceptar Misión desaparece y se habilita la vista En Trayecto / Evaluación
    expect(
      screen.queryByRole('button', { name: /aceptar misi[oó]n/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /en trayecto \/ evaluaci[oó]n/i })
    ).toBeInTheDocument();
    expect(screen.getByTestId('formularios-reporte-tecnico')).toBeInTheDocument();
    expect(screen.getByText('En verificación')).toBeInTheDocument();
    expect(screen.getByText('Verificando')).toBeInTheDocument();
  });

  it('soporta aceptación optimista en modo offline y actualiza el estado al sincronizar la cola diferida', async () => {
    configurarAuthMock({ unidadActiva: true, permisoVerificar: true });
    vi.mocked(useConnectivityModule.useConnectivity).mockReturnValue({
      online: false,
      sincronizando: false,
      pendientes: 1,
      status: 'offline',
      sincronizar: vi.fn(),
      actualizarPendientes: vi.fn().mockResolvedValue(undefined),
    });

    vi.mocked(misionesService.obtenerDetalleMision).mockResolvedValueOnce(
      misionDespachadaMock
    );

    const misionOptimistaOffline: MisionLocal = {
      ...misionDespachadaMock,
      estado: 'EN_CURSO',
      fechaInicio: '2026-11-01T21:02:00.000Z',
      sincronizacionPendiente: true,
      actualizadoEn: '2026-11-01T21:02:00.000Z',
    };

    vi.mocked(misionesService.aceptarMisionPatrulla).mockResolvedValueOnce({
      mision: misionOptimistaOffline,
      enColaOffline: true,
      mensaje:
        'Sin conexión: Misión aceptada localmente y guardada en cola para sincronizar al recuperar señal.',
    });

    await act(async () => {
      render(
        <Suspense fallback={<div>Cargando...</div>}>
          <PatrullaMisionDetailPage
            params={Promise.resolve({ id: misionDespachadaMock.id })}
          />
        </Suspense>
      );
    });

    const botonAceptar = await screen.findByRole('button', {
      name: /aceptar misi[oó]n/i,
    });

    await act(async () => {
      fireEvent.click(botonAceptar);
    });

    expect(
      screen.getByRole('heading', { name: /en trayecto \/ evaluaci[oó]n/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/pendiente de sincronizar/i)).toBeInTheDocument();
    expect(screen.getByTestId('formularios-reporte-tecnico')).toBeInTheDocument();

    // Simular recuperación de red y sincronización diferida de la cola outbox
    const misionSincronizada: MisionLocal = {
      ...misionOptimistaOffline,
      sincronizacionPendiente: false,
    };
    vi.mocked(misionesService.obtenerDetalleMision).mockResolvedValueOnce(
      misionSincronizada
    );

    await act(async () => {
      window.dispatchEvent(new CustomEvent('sgrai:outbox-synced'));
    });

    await waitFor(() => {
      expect(
        screen.queryByText(/pendiente de sincronizar/i)
      ).not.toBeInTheDocument();
    });
  });
});




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
    vi.mocked(useConnectivityModule.useConnectivity).mockReturnValue({
      online: true,
      sincronizando: false,
      pendientes: 0,
      status: 'connected',
      sincronizar: vi.fn(),
      actualizarPendientes: vi.fn().mockResolvedValue(undefined),
    });
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
        permisos: ['misiones:terreno:verificar'],
        unidadNombre: 'Patrulla Móvil 01',
        unidadActiva: true,
      },
      token: 'mock-token',
      cargando: false,
      autenticado: true,
      esPatrulla: true,
      esCuadrilla: false,
      unidadActiva: true,
      tieneUnidadAsignada: true,
      estadoAsignacion: 'ACTIVA',
      tienePermiso: vi.fn().mockImplementation((p: string) => p === 'misiones:terreno:verificar'),
      tieneAlgunPermiso: vi.fn().mockReturnValue(true),
      login: vi.fn(),
      logout: vi.fn(),
      recargarSesion: vi.fn(),
    });
  });

  it('muestra el botón "Rechazar Misión" y el recuadro unificado de acciones de despacho cuando la misión está DESPACHADA', async () => {
    render(<PatrullaMisionDetailPage params={{ id: 'mis-desp-1' }} />);

    await waitFor(() => {
      expect(screen.getByText('INC-2026-00100')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: /acciones de despacho/i })).toBeInTheDocument();
    expect(
      screen.getByText(/confirme la salida a terreno para evaluar o fundamente el rechazo/i)
    ).toBeInTheDocument();

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
      tieneUnidadAsignada: true,
      estadoAsignacion: 'DESACTIVADA',
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

  it('no muestra el botón "Rechazar Misión" si el usuario no tiene permiso misiones:terreno:verificar (RBAC)', async () => {
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
      tieneUnidadAsignada: true,
      estadoAsignacion: 'ACTIVA',
      tienePermiso: vi.fn().mockReturnValue(false),
      tieneAlgunPermiso: vi.fn().mockReturnValue(false),
      login: vi.fn(),
      logout: vi.fn(),
      recargarSesion: vi.fn(),
    });

    render(<PatrullaMisionDetailPage params={{ id: 'mis-desp-1' }} />);

    await waitFor(() => {
      expect(screen.getByText('INC-2026-00100')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /rechazar misión/i })).toBeNull();
  });

  it('muestra la tarjeta de misión no encontrada cuando la misión no existe en local ni remoto', async () => {
    vi.mocked(misionesService.obtenerDetalleMision).mockResolvedValue(null);

    render(<PatrullaMisionDetailPage params={{ id: 'mis-inexistente' }} />);

    await waitFor(() => {
      expect(screen.getByText('Misión no encontrada')).toBeInTheDocument();
      expect(
        screen.getByText(/La misión solicitada no existe o no se encuentra asignada/i)
      ).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: /volver a la bandeja/i })).toBeInTheDocument();
  });
});

