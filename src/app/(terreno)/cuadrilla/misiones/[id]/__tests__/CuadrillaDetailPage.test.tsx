import React, { Suspense } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import CuadrillaMisionDetailPage from '../page';
import * as AuthContextModule from '@/context/AuthContext';
import * as misionesService from '@/services/misionesService';
import * as useConnectivityModule from '@/hooks/useConnectivity';
import { ToastProvider } from '@/components/ui/Toast';
import type { MisionLocal } from '@/types/offline';

vi.mock('@/context/AuthContext');
vi.mock('@/services/misionesService', async (importOriginal) => {
  const actual = await importOriginal<typeof misionesService>();
  return {
    ...actual,
    obtenerDetalleMision: vi.fn(),
    aceptarMision: vi.fn(),
    reportarLlegadaCuadrilla: vi.fn(),
  };
});
vi.mock('@/hooks/useConnectivity');
vi.mock('@/components/maps/MapaModal', () => ({
  MapaModal: () => <div data-testid="mapa-modal-mock" />,
}));

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
    tipoMision: 'ATENCION_CUADRILLA',
    trabajo: 'Despeje preventivo de calzada y trozado de ramas mayores.',
  },
};

const mockMisionEnCursoSinLlegada: MisionLocal = {
  ...mockMisionDespachada,
  estado: 'EN_CURSO',
  fechaInicio: '2026-11-08T19:10:00.000Z',
  fechaLlegada: null,
  sincronizacionPendiente: false,
  datosAdicionales: {
    ...mockMisionDespachada.datosAdicionales,
    estadoCuadrilla: 'EN_MISION',
    estadoIncidente: 'EN_ATENCION',
  },
  actualizadoEn: '2026-11-08T19:10:00.000Z',
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
      unidadId: '50000000-0000-4000-8000-000000000001',
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
    tieneUnidadAsignada: true,
    estadoAsignacion: unidadActiva ? 'ACTIVA' : 'DESACTIVADA',
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

describe('CuadrillaMisionDetailPage — Aceptación de Asignación (H40 — Prioridad en DESPACHADA)', () => {
  const actualizarPendientesMock = vi.fn().mockResolvedValue(0);

  beforeEach(() => {
    vi.clearAllMocks();
    configurarAuthMock({ unidadActiva: true, permisoEjecutar: true });
    vi.mocked(useConnectivityModule.useConnectivity).mockReturnValue({
      online: true,
      sincronizando: false,
      pendientes: 0,
      status: 'connected',
      sincronizar: vi.fn(),
      actualizarPendientes: actualizarPendientesMock,
    });
    vi.mocked(misionesService.obtenerDetalleMision).mockResolvedValue(mockMisionDespachada);
  });

  it('muestra "Aceptar Asignación" y oculta "Llegada a Terreno" cuando la misión está DESPACHADA', async () => {
    await act(async () => {
      render(
        <ToastProvider>
          <Suspense fallback={<div>Cargando...</div>}>
            <CuadrillaMisionDetailPage
              params={Promise.resolve({ id: mockMisionDespachada.id })}
            />
          </Suspense>
        </ToastProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByText('INC-2026-00100')).toBeInTheDocument();
    });

    expect(
      screen.getByRole('button', { name: /aceptar asignación/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /llegada a terreno/i })
    ).not.toBeInTheDocument();
  });

  it('oculta "Aceptar Asignación" si falta permiso misiones:terreno:ejecutar o la cuadrilla está inactiva', async () => {
    configurarAuthMock({ unidadActiva: false, permisoEjecutar: true });

    await act(async () => {
      render(
        <ToastProvider>
          <Suspense fallback={<div>Cargando...</div>}>
            <CuadrillaMisionDetailPage
              params={Promise.resolve({ id: mockMisionDespachada.id })}
            />
          </Suspense>
        </ToastProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByText('INC-2026-00100')).toBeInTheDocument();
    });

    expect(
      screen.queryByRole('button', { name: /aceptar asignación/i })
    ).not.toBeInTheDocument();
    expect(screen.getAllByText(/solo lectura/i).length).toBeGreaterThanOrEqual(1);
  });

  it('al presionar "Aceptar Asignación" emite toast "Asignación aceptada", muestra "Faena en Curso" y habilita "Llegada a Terreno" (H40 -> H42)', async () => {
    vi.mocked(misionesService.aceptarMision).mockResolvedValueOnce({
      mision: mockMisionEnCursoSinLlegada,
      enColaOffline: false,
      mensaje:
        'Asignación de misión aceptada exitosamente. La cuadrilla inicia el desplazamiento y asume la atención del incidente.',
    });

    await act(async () => {
      render(
        <ToastProvider>
          <Suspense fallback={<div>Cargando...</div>}>
            <CuadrillaMisionDetailPage
              params={Promise.resolve({ id: mockMisionDespachada.id })}
            />
          </Suspense>
        </ToastProvider>
      );
    });

    const btnAceptar = await screen.findByRole('button', {
      name: /aceptar asignación/i,
    });

    await act(async () => {
      fireEvent.click(btnAceptar);
    });

    expect(misionesService.aceptarMision).toHaveBeenCalledWith(
      mockMisionDespachada.id,
      {
        misionActual: mockMisionDespachada,
        tipoUnidad: 'cuadrilla',
      }
    );

    await waitFor(() => {
      expect(screen.getByText('Asignación aceptada')).toBeInTheDocument();
      expect(screen.getByText('Faena en Curso')).toBeInTheDocument();
    });

    expect(screen.getByText('Inicio de trayecto')).toBeInTheDocument();
    expect(screen.getByText('En misión')).toBeInTheDocument();
    expect(screen.getByText('En atención')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /aceptar asignación/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /llegada a terreno/i })
    ).toBeInTheDocument();
    expect(actualizarPendientesMock).toHaveBeenCalled();
  });

  it('soporta aceptación offline mostrando toast de advertencia y limpia pendiente al sincronizar outbox', async () => {
    vi.mocked(useConnectivityModule.useConnectivity).mockReturnValue({
      online: false,
      sincronizando: false,
      pendientes: 1,
      status: 'offline',
      sincronizar: vi.fn(),
      actualizarPendientes: actualizarPendientesMock,
    });

    vi.mocked(misionesService.obtenerDetalleMision).mockResolvedValueOnce(
      mockMisionDespachada
    );

    const misionOptimista: MisionLocal = {
      ...mockMisionEnCursoSinLlegada,
      sincronizacionPendiente: true,
    };

    vi.mocked(misionesService.aceptarMision).mockResolvedValueOnce({
      mision: misionOptimista,
      enColaOffline: true,
      mensaje:
        'Sin conexión: Asignación aceptada localmente y guardada en cola para sincronizar al recuperar señal.',
    });

    await act(async () => {
      render(
        <ToastProvider>
          <Suspense fallback={<div>Cargando...</div>}>
            <CuadrillaMisionDetailPage
              params={Promise.resolve({ id: mockMisionDespachada.id })}
            />
          </Suspense>
        </ToastProvider>
      );
    });

    const btnAceptar = await screen.findByRole('button', {
      name: /aceptar asignación/i,
    });

    await act(async () => {
      fireEvent.click(btnAceptar);
    });

    await waitFor(() => {
      expect(screen.getByText('Guardado sin conexión')).toBeInTheDocument();
      expect(screen.getByText('Faena en Curso')).toBeInTheDocument();
    });

    expect(screen.getByText(/pendiente de sincronizar/i)).toBeInTheDocument();

    vi.mocked(misionesService.obtenerDetalleMision).mockResolvedValueOnce({
      ...misionOptimista,
      sincronizacionPendiente: false,
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent('sgrai:outbox-synced'));
    });

    await waitFor(() => {
      expect(
        screen.queryByText(/pendiente de sincronizar/i)
      ).not.toBeInTheDocument();
    });
  });

  it('emite toast informativo ante respuesta idempotente 409 EN_CURSO', async () => {
    vi.mocked(misionesService.aceptarMision).mockResolvedValueOnce({
      mision: mockMisionEnCursoSinLlegada,
      enColaOffline: false,
      yaAceptadaPreviamente: true,
      mensaje: 'La asignación ya se encuentra en curso (Faena en Curso).',
    });

    await act(async () => {
      render(
        <ToastProvider>
          <Suspense fallback={<div>Cargando...</div>}>
            <CuadrillaMisionDetailPage
              params={Promise.resolve({ id: mockMisionDespachada.id })}
            />
          </Suspense>
        </ToastProvider>
      );
    });

    const btnAceptar = await screen.findByRole('button', {
      name: /aceptar asignación/i,
    });

    await act(async () => {
      fireEvent.click(btnAceptar);
    });

    await waitFor(() => {
      expect(screen.getByText('Misión ya en curso')).toBeInTheDocument();
      expect(screen.getByText('Faena en Curso')).toBeInTheDocument();
    });
  });

  it('muestra alerta y toast de error sin transicionar cuando el backend rechaza (403/409)', async () => {
    vi.mocked(misionesService.aceptarMision).mockRejectedValueOnce(
      new misionesService.MisionServiceError(
        403,
        'No cuenta con el permiso misiones:terreno:ejecutar.'
      )
    );

    await act(async () => {
      render(
        <ToastProvider>
          <Suspense fallback={<div>Cargando...</div>}>
            <CuadrillaMisionDetailPage
              params={Promise.resolve({ id: mockMisionDespachada.id })}
            />
          </Suspense>
        </ToastProvider>
      );
    });

    const btnAceptar = await screen.findByRole('button', {
      name: /aceptar asignación/i,
    });

    await act(async () => {
      fireEvent.click(btnAceptar);
    });

    await waitFor(() => {
      expect(screen.getByText('No se pudo aceptar la asignación')).toBeInTheDocument();
      expect(
        screen.getAllByText(/No cuenta con el permiso misiones:terreno:ejecutar/i).length
      ).toBeGreaterThanOrEqual(1);
    });

    expect(screen.queryByText('Faena en Curso')).not.toBeInTheDocument();
  });

  it('muestra tarjeta Misión no encontrada cuando obtenerDetalleMision retorna null (sin datos ficticios)', async () => {
    vi.mocked(misionesService.obtenerDetalleMision).mockResolvedValueOnce(null);

    await act(async () => {
      render(
        <ToastProvider>
          <Suspense fallback={<div>Cargando...</div>}>
            <CuadrillaMisionDetailPage
              params={Promise.resolve({ id: 'uuid-inexistente' })}
            />
          </Suspense>
        </ToastProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Misión no encontrada')).toBeInTheDocument();
    });
  });
});

describe('CuadrillaMisionDetailPage — Reporte de Llegada a Terreno (H42 post-H40)', () => {
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
    vi.mocked(misionesService.obtenerDetalleMision).mockResolvedValue(
      mockMisionEnCursoSinLlegada
    );
  });

  it('debe renderizar el botón destacado "Llegada a Terreno" cuando la misión está EN_CURSO sin arribo previo', async () => {
    await act(async () => {
      render(
        <ToastProvider>
          <Suspense fallback={<div>Cargando...</div>}>
            <CuadrillaMisionDetailPage
              params={Promise.resolve({ id: mockMisionEnCursoSinLlegada.id })}
            />
          </Suspense>
        </ToastProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByText('INC-2026-00100')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /llegada a terreno/i })).toBeInTheDocument();
    expect(screen.getByText(/confirmación de arribo/i)).toBeInTheDocument();
  });

  it('al presionar "Llegada a Terreno" invoca reportarLlegadaCuadrilla, emite toast y transiciona a "En Trabajos de Terreno"', async () => {
    const mockMisionConLlegada: MisionLocal = {
      ...mockMisionEnCursoSinLlegada,
      fechaLlegada: '2026-11-08T19:30:00.000Z',
      datosAdicionales: {
        ...mockMisionEnCursoSinLlegada.datosAdicionales,
        hitoLlegada: 'Llegada a terreno reportada.',
      },
    };

    vi.mocked(misionesService.reportarLlegadaCuadrilla).mockResolvedValue({
      mision: mockMisionConLlegada,
      enColaOffline: false,
      mensaje: 'Llegada a terreno reportada exitosamente.',
    });

    await act(async () => {
      render(
        <ToastProvider>
          <Suspense fallback={<div>Cargando...</div>}>
            <CuadrillaMisionDetailPage
              params={Promise.resolve({ id: mockMisionEnCursoSinLlegada.id })}
            />
          </Suspense>
        </ToastProvider>
      );
    });

    const botonLlegada = await screen.findByRole('button', { name: /llegada a terreno/i });

    await act(async () => {
      fireEvent.click(botonLlegada);
    });

    expect(misionesService.reportarLlegadaCuadrilla).toHaveBeenCalledWith(
      mockMisionEnCursoSinLlegada.id,
      expect.objectContaining({
        usarUbicacionMision: false,
      })
    );

    await waitFor(() => {
      expect(screen.getByText('Llegada registrada')).toBeInTheDocument();
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
        <ToastProvider>
          <Suspense fallback={<div>Cargando...</div>}>
            <CuadrillaMisionDetailPage
              params={Promise.resolve({ id: mockMisionEnCursoSinLlegada.id })}
            />
          </Suspense>
        </ToastProvider>
      );
    });

    const botonLlegada = await screen.findByRole('button', { name: /llegada a terreno/i });

    await act(async () => {
      fireEvent.click(botonLlegada);
    });

    await waitFor(() => {
      expect(
        screen.getAllByText(/permiso de ubicación denegado/i).length
      ).toBeGreaterThanOrEqual(1);
    });

    const botonContingencia = screen.getByRole('button', {
      name: /registrar llegada con ubicación de la misión/i,
    });
    expect(botonContingencia).toBeInTheDocument();

    const mockMisionConLlegada: MisionLocal = {
      ...mockMisionEnCursoSinLlegada,
      fechaLlegada: '2026-11-08T19:35:00.000Z',
      datosAdicionales: {
        ...mockMisionEnCursoSinLlegada.datosAdicionales,
        hitoLlegada: 'Llegada a terreno reportada.',
      },
    };

    vi.mocked(misionesService.reportarLlegadaCuadrilla).mockResolvedValueOnce({
      mision: mockMisionConLlegada,
      enColaOffline: false,
      mensaje: 'Llegada registrada exitosamente con ubicación de contingencia.',
    });

    await act(async () => {
      fireEvent.click(botonContingencia);
    });

    expect(misionesService.reportarLlegadaCuadrilla).toHaveBeenCalledWith(
      mockMisionEnCursoSinLlegada.id,
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
      ...mockMisionEnCursoSinLlegada,
      estado: 'COMPLETADA',
    };
    vi.mocked(misionesService.obtenerDetalleMision).mockResolvedValue(mockMisionCompletada);

    await act(async () => {
      render(
        <ToastProvider>
          <Suspense fallback={<div>Cargando...</div>}>
            <CuadrillaMisionDetailPage
              params={Promise.resolve({ id: mockMisionEnCursoSinLlegada.id })}
            />
          </Suspense>
        </ToastProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByText('INC-2026-00100')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /llegada a terreno/i })).not.toBeInTheDocument();
    expect(screen.getAllByText(/solo lectura/i).length).toBeGreaterThanOrEqual(1);
  });
});
