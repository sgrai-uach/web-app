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

