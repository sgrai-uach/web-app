import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  procesarMisionAsignada,
  emitirAckLectura,
  consultarMisionesPendientes,
  limpiarCacheNotificacionesMemoria,
  esNotificacionDuplicada,
} from '../notificacionesService';
import * as socketClient from '@/lib/socket/socketClient';
import apiClient from '@/lib/api/client';
import * as offlineQueue from '@/services/offlineQueue';
import type { MisionAsignadaAlerta } from '@/types/notificaciones';

vi.mock('@/lib/socket/socketClient', () => ({
  emitirAckNotificacionSocket: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  default: {
    PATCH: vi.fn(),
    GET: vi.fn(),
  },
}));

vi.mock('@/services/offlineQueue', async () => {
  const actual = await vi.importActual<typeof import('@/services/offlineQueue')>(
    '@/services/offlineQueue'
  );
  return {
    ...actual,
    guardarNotificacionLocal: vi.fn().mockResolvedValue(undefined),
    obtenerNotificacionLocal: vi.fn().mockResolvedValue(undefined),
    guardarMisionLocal: vi.fn().mockResolvedValue(undefined),
    encolarAccionOutbox: vi.fn().mockResolvedValue({ id: 'outbox-1' }),
  };
});

describe('notificacionesService (HU-35)', () => {
  const alerta: MisionAsignadaAlerta = {
    notificacionId: 'notif-uuid-1234',
    misionId: 'mision-uuid-5678',
    codigo: 'MIS-2026-0099',
    tipoMision: 'VERIFICACION',
    patrullaId: 'pat-001',
    incidenteId: 'inc-001',
    incidenteCodigo: 'INC-2026-0044',
    incidenteFolio: 'FOL-0044',
    tipoAfectacion: 'Desborde de río',
    direccion: 'Sector Isla Teja',
    prioridad: 'CRITICA',
    asignadoEn: '2026-11-10T15:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    limpiarCacheNotificacionesMemoria();
  });

  // CP-H35-PWA-04: Emisión Automática de ACK RECIBIDA
  it('CP-H35-PWA-04: emite inmediatamente el acuse técnico RECIBIDA sin esperar interacción', async () => {
    vi.mocked(socketClient.emitirAckNotificacionSocket).mockResolvedValue({
      ok: true,
      message: 'Confirmado',
    });

    const resultado = await procesarMisionAsignada(alerta);

    expect(resultado.esDuplicado).toBe(false);
    expect(resultado.mision.id).toBe('mision-uuid-5678');
    expect(offlineQueue.guardarMisionLocal).toHaveBeenCalled();
    expect(offlineQueue.guardarNotificacionLocal).toHaveBeenCalledWith({
      notificacionId: 'notif-uuid-1234',
      misionId: 'mision-uuid-5678',
      estado: 'RECIBIDA',
      procesadoEn: expect.any(String),
    });
    expect(socketClient.emitirAckNotificacionSocket).toHaveBeenCalledWith(
      'notif-uuid-1234',
      'RECIBIDA'
    );
  });

  // CP-H35-PWA-06: Deduplicación Local
  it('CP-H35-PWA-06: detecta notificaciones ya procesadas e impide duplicados', async () => {
    vi.mocked(socketClient.emitirAckNotificacionSocket).mockResolvedValue({ ok: true });

    // Primer procesamiento
    const primerProceso = await procesarMisionAsignada(alerta);
    expect(primerProceso.esDuplicado).toBe(false);

    // Segundo procesamiento idéntico (simula doble emisión de socket)
    const segundoProceso = await procesarMisionAsignada(alerta);
    expect(segundoProceso.esDuplicado).toBe(true);

    // Solo se debe haber guardado y emitido ACK una sola vez
    expect(offlineQueue.guardarMisionLocal).toHaveBeenCalledTimes(1);
    expect(socketClient.emitirAckNotificacionSocket).toHaveBeenCalledTimes(1);
  });

  // CP-H35-PWA-05: ACK LEIDA e Interacción
  it('CP-H35-PWA-05: emite el ACK LEIDA al interactuar y actualiza la persistencia', async () => {
    vi.mocked(socketClient.emitirAckNotificacionSocket).mockResolvedValue({ ok: true });

    await emitirAckLectura('notif-uuid-1234', 'mision-uuid-5678');

    expect(offlineQueue.guardarNotificacionLocal).toHaveBeenCalledWith({
      notificacionId: 'notif-uuid-1234',
      misionId: 'mision-uuid-5678',
      estado: 'LEIDA',
      procesadoEn: expect.any(String),
    });
    expect(socketClient.emitirAckNotificacionSocket).toHaveBeenCalledWith(
      'notif-uuid-1234',
      'LEIDA'
    );
  });

  it('si falla el WebSocket, envía el ACK vía REST HTTP', async () => {
    vi.mocked(socketClient.emitirAckNotificacionSocket).mockResolvedValue({
      ok: false,
      error: 'Socket offline',
    });
    vi.mocked(apiClient.PATCH).mockResolvedValue({
      response: { ok: true } as Response,
      data: { message: 'Actualizado' },
      error: undefined,
    });

    const resultado = await procesarMisionAsignada(alerta);

    expect(resultado.esDuplicado).toBe(false);
    expect(apiClient.PATCH).toHaveBeenCalledWith(
      '/api/terreno/notificaciones/{id}/estado',
      {
        params: { path: { id: 'notif-uuid-1234' } },
        body: { estado: 'RECIBIDA' },
      }
    );
  });

  it('si fallan WebSocket y REST (modo avión/offline), encola el ACK en outbox', async () => {
    vi.mocked(socketClient.emitirAckNotificacionSocket).mockResolvedValue({
      ok: false,
      error: 'Socket offline',
    });
    vi.mocked(apiClient.PATCH).mockRejectedValue(new Error('Network failure'));

    await procesarMisionAsignada(alerta);

    expect(offlineQueue.encolarAccionOutbox).toHaveBeenCalledWith({
      tipo: 'ACK_NOTIFICACION',
      url: '/api/terreno/notificaciones/notif-uuid-1234/estado',
      metodo: 'PATCH',
      payload: { estado: 'RECIBIDA' },
    });
  });

  it('consultarMisionesPendientes invoca el endpoint GET /api/terreno/misiones/pendientes', async () => {
    const mockMisionesPendientes = [
      {
        notificacionId: 'notif-1',
        misionId: 'mis-1',
        codigoMision: 'MIS-2026-0001',
        titulo: 'Árbol caído',
        descripcion: null,
        tipoMision: 'VERIFICACION',
        prioridad: 'ALTA',
        estadoMision: 'DESPACHADA',
        estadoNotificacion: 'PENDIENTE_ENVIO' as const,
        patrullaId: 'pat-1',
        incidenteId: 'inc-1',
        incidenteCodigo: 'INC-1',
        incidenteFolio: 'FOL-1',
        tipoAfectacion: 'Caída de árbol',
        direccion: 'Calle Prat',
        latitud: null,
        longitud: null,
        creadaAt: '2026-11-10T12:00:00Z',
        enviadaAt: null,
      },
    ];

    vi.mocked(apiClient.GET).mockResolvedValue({
      data: {
        message: 'OK',
        data: mockMisionesPendientes,
        total: 1,
      },
      error: undefined,
      response: { ok: true } as Response,
    });

    const pendientes = await consultarMisionesPendientes('pat-1');
    expect(pendientes).toHaveLength(1);
    expect(pendientes[0].codigoMision).toBe('MIS-2026-0001');
  });
});
