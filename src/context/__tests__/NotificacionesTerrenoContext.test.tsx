import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NotificacionesTerrenoProvider,
  useNotificacionesTerreno,
} from '../NotificacionesTerrenoContext';
import * as AuthContextModule from '@/context/AuthContext';
import * as socketClient from '@/lib/socket/socketClient';
import * as notificacionesService from '@/services/notificacionesService';
import * as alertaSonora from '@/lib/utils/alertaSonora';
import type { MisionAsignadaPayload } from '@/types/notificaciones';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock('@/lib/socket/socketClient', () => ({
  conectarSocket: vi.fn(),
  desconectarSocket: vi.fn(),
  unirseASalaPatrulla: vi.fn(),
  salirDeSalaPatrulla: vi.fn(),
  onMisionAsignada: vi.fn(),
  onSocketConnect: vi.fn(),
  emitirAckNotificacionSocket: vi.fn(),
}));

vi.mock('@/services/notificacionesService', () => ({
  procesarMisionAsignada: vi.fn(),
  emitirAckLectura: vi.fn(),
  consultarMisionesPendientes: vi.fn(),
}));

vi.mock('@/lib/utils/alertaSonora', () => ({
  activarAlertaSensorialMision: vi.fn(),
}));

function TestConsumer() {
  const { alertaActiva, reconciliarMisiones } = useNotificacionesTerreno();
  return (
    <div>
      <span data-testid="estado-alerta">
        {alertaActiva ? alertaActiva.codigo : 'sin-alerta'}
      </span>
      <button
        type="button"
        data-testid="btn-reconciliar"
        onClick={() => void reconciliarMisiones()}
      >
        Reconciliar
      </button>
    </div>
  );
}

describe('NotificacionesTerrenoContext (HU-35)', () => {
  let socketHandler: (payload: MisionAsignadaPayload) => void = () => {};
  let connectHandler: () => void = () => {};

  const usuarioPatrulla = {
    id: 'user-001',
    rut: '12.345.678-5',
    nombre: 'Patrullero Uno',
    email: 'patrulla@valdivia.cl',
    rolId: 'rol-1',
    rolNombre: 'Patrulla Verificadora',
    rolCodigo: 'PATRULLA_VERIFICADORA',
    delegacionId: 'del-1',
    delegacionNombre: 'Las Ánimas',
    permisos: ['misiones:terreno:verificar'],
    unidadId: 'patrulla-uuid-999',
    unidadNombre: 'Patrulla Costa-1',
    unidadActiva: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(socketClient.onMisionAsignada).mockImplementation((fn) => {
      socketHandler = fn;
      return () => {};
    });

    vi.mocked(socketClient.onSocketConnect).mockImplementation((fn) => {
      connectHandler = fn;
      return () => {};
    });

    vi.mocked(notificacionesService.consultarMisionesPendientes).mockResolvedValue([]);
    vi.mocked(notificacionesService.procesarMisionAsignada).mockResolvedValue({
      esDuplicado: false,
      mision: {
        id: 'mision-1',
        incidenteId: 'inc-1',
        codigoIncidente: 'INC-1',
        tipologia: 'Inundación',
        direccion: 'Calle Prat',
        prioridad: 'ALTA',
        estado: 'DESPACHADA',
        fechaDespacho: '2026-11-10T12:00:00Z',
        actualizadoEn: '2026-11-10T12:00:00Z',
      },
    });

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      usuario: usuarioPatrulla,
      token: 'jwt-mock-patrulla',
      cargando: false,
      autenticado: true,
      esPatrulla: true,
      esCuadrilla: false,
      unidadActiva: true,
      tieneUnidadAsignada: true,
      estadoAsignacion: 'ACTIVA',
      tienePermiso: vi.fn().mockReturnValue(true),
      tieneAlgunPermiso: vi.fn().mockReturnValue(true),
      login: vi.fn(),
      logout: vi.fn(),
      recargarSesion: vi.fn(),
    });
  });

  // CP-H35-PWA-01: Suscripción a Sala
  it('CP-H35-PWA-01: suscribe el socket a la sala patrulla:{patrullaId} al iniciar sesión', async () => {
    render(
      <NotificacionesTerrenoProvider>
        <TestConsumer />
      </NotificacionesTerrenoProvider>
    );

    expect(socketClient.conectarSocket).toHaveBeenCalledWith('jwt-mock-patrulla');
    expect(socketClient.unirseASalaPatrulla).toHaveBeenCalledWith('patrulla-uuid-999');
  });

  // CP-H35-PWA-02: Recepción y Despliegue Visual
  it('CP-H35-PWA-02: al recibir mision:asignada despliega el banner y dispara alerta auditiva/háptica', async () => {
    render(
      <NotificacionesTerrenoProvider>
        <TestConsumer />
      </NotificacionesTerrenoProvider>
    );

    await act(async () => {
      socketHandler({
        notificacionId: 'notif-100',
        misionId: 'mis-100',
        codigo: 'MIS-2026-0042',
        tipoMision: 'VERIFICACION',
        patrullaId: 'patrulla-uuid-999',
        cuadrillaId: null,
        incidenteId: 'inc-100',
        incidenteCodigo: 'INC-2026-0089',
        incidenteFolio: 'FOL-1042',
        tipoAfectacion: 'Inundación por colapso de sumidero',
        direccion: 'Calle Bueras 450, Valdivia',
        prioridad: 'ALTA',
        asignadoEn: '2026-11-10T15:20:00Z',
      });
    });

    expect(notificacionesService.procesarMisionAsignada).toHaveBeenCalled();
    expect(alertaSonora.activarAlertaSensorialMision).toHaveBeenCalled();
    expect(screen.getByTestId('codigo-mision-banner')).toHaveTextContent('MIS-2026-0042');
  });

  // CP-H35-PWA-05: ACK LEIDA e Interacción
  it('CP-H35-PWA-05: al tocar "Ver Misión" emite ACK LEIDA, cierra el banner y navega al detalle', async () => {
    render(
      <NotificacionesTerrenoProvider>
        <TestConsumer />
      </NotificacionesTerrenoProvider>
    );

    await act(async () => {
      socketHandler({
        notificacionId: 'notif-100',
        misionId: 'mis-100',
        codigo: 'MIS-2026-0042',
        tipoMision: 'VERIFICACION',
        patrullaId: 'patrulla-uuid-999',
        cuadrillaId: null,
        incidenteId: 'inc-100',
        incidenteCodigo: 'INC-2026-0089',
        incidenteFolio: 'FOL-1042',
        tipoAfectacion: 'Inundación',
        direccion: 'Calle Bueras 450',
        prioridad: 'ALTA',
        asignadoEn: '2026-11-10T15:20:00Z',
      });
    });

    const btnVer = screen.getByTestId('btn-ver-mision-banner');
    await act(async () => {
      fireEvent.click(btnVer);
    });

    expect(notificacionesService.emitirAckLectura).toHaveBeenCalledWith('notif-100', 'mis-100');
    expect(mockPush).toHaveBeenCalledWith('/patrulla/misiones/mis-100');
    expect(screen.queryByTestId('codigo-mision-banner')).not.toBeInTheDocument();
  });

  // CP-H35-PWA-07: Reconciliación Offline / Modo Avión
  it('CP-H35-PWA-07: reconectar la red consulta misiones pendientes y despliega alertas no vistas', async () => {
    vi.mocked(notificacionesService.consultarMisionesPendientes).mockResolvedValue([
      {
        notificacionId: 'notif-offline-99',
        misionId: 'mis-offline-99',
        codigoMision: 'MIS-2026-0077',
        titulo: 'Árbol caído sobre cableado',
        descripcion: 'Verificar daño',
        tipoMision: 'VERIFICACION',
        prioridad: 'CRITICA',
        estadoMision: 'DESPACHADA',
        estadoNotificacion: 'PENDIENTE_ENVIO',
        patrullaId: 'patrulla-uuid-999',
        incidenteId: 'inc-99',
        incidenteCodigo: 'INC-99',
        incidenteFolio: 'FOL-99',
        tipoAfectacion: 'Árbol caído',
        direccion: 'Av. Alemania 300',
        latitud: null,
        longitud: null,
        creadaAt: '2026-11-10T16:00:00Z',
        enviadaAt: null,
      },
    ]);

    render(
      <NotificacionesTerrenoProvider>
        <TestConsumer />
      </NotificacionesTerrenoProvider>
    );

    // Simula evento 'online' o reconexión de socket
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      connectHandler();
    });

    await waitFor(() => {
      expect(notificacionesService.consultarMisionesPendientes).toHaveBeenCalledWith(
        'patrulla-uuid-999'
      );
    });
    expect(notificacionesService.procesarMisionAsignada).toHaveBeenCalledWith(
      expect.objectContaining({
        notificacionId: 'notif-offline-99',
        misionId: 'mis-offline-99',
        codigo: 'MIS-2026-0077',
      })
    );
  });
});
