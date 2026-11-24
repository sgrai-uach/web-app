import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  procesarMisionAsignada,
  emitirAckLectura,
  consultarMisionesPendientes,
  confirmarLecturaMisionAbierta,
  esUuidNotificacionValido,
  limpiarCacheNotificacionesMemoria,
  mapearAlertaAMisionLocal,
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
    obtenerNotificacionLocalPorMisionId: vi.fn().mockResolvedValue(undefined),
    guardarMisionLocal: vi.fn().mockResolvedValue(undefined),
    encolarAccionOutbox: vi.fn().mockResolvedValue({ id: 'outbox-1' }),
  };
});

const NOTIF_UUID = '80000000-0000-4000-8000-000000001234';
const MISION_UUID = '60000000-0000-4000-8000-000000005678';

describe('notificacionesService (HU-35)', () => {
  const alerta: MisionAsignadaAlerta = {
    notificacionId: NOTIF_UUID,
    misionId: MISION_UUID,
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
    expect(resultado.mision.id).toBe(MISION_UUID);
    expect(offlineQueue.guardarMisionLocal).toHaveBeenCalled();
    expect(offlineQueue.guardarNotificacionLocal).toHaveBeenCalledWith({
      notificacionId: NOTIF_UUID,
      misionId: MISION_UUID,
      estado: 'RECIBIDA',
      procesadoEn: expect.any(String),
    });
    expect(socketClient.emitirAckNotificacionSocket).toHaveBeenCalledWith(
      NOTIF_UUID,
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

    await emitirAckLectura(NOTIF_UUID, MISION_UUID);

    expect(offlineQueue.guardarNotificacionLocal).toHaveBeenCalledWith({
      notificacionId: NOTIF_UUID,
      misionId: MISION_UUID,
      estado: 'LEIDA',
      procesadoEn: expect.any(String),
    });
    expect(socketClient.emitirAckNotificacionSocket).toHaveBeenCalledWith(
      NOTIF_UUID,
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
      data: {
        message: 'Actualizado',
        data: {
          id: NOTIF_UUID,
          misionId: MISION_UUID,
          patrullaId: 'pat-001',
          estado: 'RECIBIDA',
          intentosEnvio: 1,
          creadaAt: '2026-11-10T15:00:00Z',
          enviadaAt: '2026-11-10T15:00:00Z',
          recibidaAt: '2026-11-10T15:00:01Z',
          leidaAt: null,
        },
      },
      error: undefined,
    } as unknown as Awaited<ReturnType<typeof apiClient.PATCH>>);

    const resultado = await procesarMisionAsignada(alerta);

    expect(resultado.esDuplicado).toBe(false);
    expect(apiClient.PATCH).toHaveBeenCalledWith(
      '/api/terreno/notificaciones/{id}/estado',
      {
        params: { path: { id: NOTIF_UUID } },
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
      url: `/api/terreno/notificaciones/${NOTIF_UUID}/estado`,
      metodo: 'PATCH',
      payload: { estado: 'RECIBIDA' },
    });
  });

  it('rechaza IDs sintéticos no-UUID sin emitir WebSocket, REST ni outbox', async () => {
    expect(esUuidNotificacionValido('notif-mis-1-123456')).toBe(false);
    expect(esUuidNotificacionValido(NOTIF_UUID)).toBe(true);

    await emitirAckLectura('notif-mis-1-123456', MISION_UUID);

    expect(socketClient.emitirAckNotificacionSocket).not.toHaveBeenCalled();
    expect(apiClient.PATCH).not.toHaveBeenCalled();
    expect(offlineQueue.encolarAccionOutbox).not.toHaveBeenCalled();
  });

  it('consultarMisionesPendientes invoca el endpoint GET /api/terreno/misiones/pendientes para patrulla o cuadrilla', async () => {
    const mockMisionesPendientes = [
      {
        notificacionId: NOTIF_UUID,
        misionId: MISION_UUID,
        codigoMision: 'MIS-2026-0001',
        titulo: 'Árbol caído',
        descripcion: null,
        tipoMision: 'VERIFICACION',
        prioridad: 'ALTA',
        estadoMision: 'DESPACHADA',
        estadoNotificacion: 'PENDIENTE_ENVIO' as const,
        patrullaId: 'pat-1',
        cuadrillaId: null,
        tipoUnidad: 'PATRULLA' as const,
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

    const pendientes = await consultarMisionesPendientes({ cuadrillaId: 'cuad-1' });
    expect(pendientes).toHaveLength(1);
    expect(apiClient.GET).toHaveBeenCalledWith('/api/terreno/misiones/pendientes', {
      params: { query: { cuadrillaId: 'cuad-1' } },
    });
  });

  it('confirmarLecturaMisionAbierta resuelve notificacionId remoto y emite ACK LEIDA automático', async () => {
    vi.mocked(socketClient.emitirAckNotificacionSocket).mockResolvedValue({ ok: true });
    vi.mocked(apiClient.GET).mockResolvedValue({
      data: {
        message: 'OK',
        total: 1,
        data: [
          {
            notificacionId: NOTIF_UUID,
            misionId: MISION_UUID,
            codigoMision: 'MIS-2026-0040',
            titulo: 'Despeje',
            descripcion: null,
            tipoMision: 'ATENCION_CUADRILLA',
            prioridad: 'ALTA',
            estadoMision: 'DESPACHADA',
            estadoNotificacion: 'ENVIADA',
            patrullaId: null,
            cuadrillaId: 'cuad-1',
            tipoUnidad: 'CUADRILLA',
            incidenteId: 'inc-1',
            incidenteCodigo: 'INC-1',
            incidenteFolio: 'FOL-1',
            tipoAfectacion: 'Anegamiento',
            direccion: 'Picarte 100',
            latitud: null,
            longitud: null,
            creadaAt: '2026-11-10T12:00:00Z',
            enviadaAt: '2026-11-10T12:00:01Z',
          },
        ],
      },
      error: undefined,
      response: { ok: true } as Response,
    });

    const confirmada = await confirmarLecturaMisionAbierta({
      misionId: MISION_UUID,
      unidadId: 'cuad-1',
      esCuadrilla: true,
    });

    expect(confirmada).toBe(true);
    expect(socketClient.emitirAckNotificacionSocket).toHaveBeenCalledWith(NOTIF_UUID, 'LEIDA');
  });

  it('mapearAlertaAMisionLocal soporta alertas ATENCION_CUADRILLA con cuadrillaId (H40)', () => {
    const mision = mapearAlertaAMisionLocal({
      notificacionId: NOTIF_UUID,
      misionId: 'mis-cuad-1',
      codigo: 'MIS-2026-0040',
      tipoMision: 'ATENCION_CUADRILLA',
      tipoUnidad: 'CUADRILLA',
      patrullaId: null,
      cuadrillaId: 'cuad-1',
      incidenteId: 'inc-1',
      incidenteCodigo: 'INC-2026-0040',
      incidenteFolio: 'FOL-40',
      tipoAfectacion: null,
      direccion: 'Av. Picarte 1100',
      prioridad: 'ALTA',
      asignadoEn: '2026-11-22T14:00:00Z',
    });

    expect(mision.tipologia).toBe('Atención de Cuadrilla');
    expect(mision.datosAdicionales?.cuadrillaId).toBe('cuad-1');
    expect(mision.datosAdicionales?.patrullaId).toBeNull();
  });
});
