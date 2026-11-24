import { describe, it, expect, vi, beforeEach } from 'vitest';
import apiClient, { handleUnauthorizedSession } from '@/lib/api/client';
import * as offlineQueue from '@/services/offlineQueue';
import {
  SolicitarApoyoServiceError,
  obtenerSolicitudesApoyoMision,
  solicitarApoyoAdicional,
} from '../solicitudApoyoService';
import type { MisionLocal } from '@/types/offline';

vi.mock('@/lib/api/client', () => ({
  default: {
    POST: vi.fn(),
  },
  handleUnauthorizedSession: vi.fn(),
}));

vi.mock('@/services/offlineQueue', () => ({
  encolarAccionOutbox: vi.fn().mockResolvedValue(undefined),
  guardarMisionLocal: vi.fn().mockResolvedValue(undefined),
  obtenerMisionLocalPorId: vi.fn().mockResolvedValue(undefined),
}));

const misionBase: MisionLocal = {
  id: '70000000-0000-4000-8000-000000000044',
  incidenteId: '30000000-0000-4000-8000-000000000044',
  codigoIncidente: 'INC-2026-0044',
  tipologia: 'Deslizamiento de tierra',
  direccion: 'Av. Ramón Picarte 1800, Valdivia',
  prioridad: 'ALTA',
  estado: 'EN_CURSO',
  fechaDespacho: '2026-11-23T18:00:00.000Z',
  actualizadoEn: '2026-11-23T18:10:00.000Z',
  datosAdicionales: {
    tipoMision: 'ATENCION_CUADRILLA',
    estadoCuadrilla: 'EN_MISION',
  },
};

describe('solicitudApoyoService (HU-44)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
    });
  });

  it('envía POST /api/misiones/{id}/apoyo online (201) y persiste la solicitud sincronizada en IndexedDB', async () => {
    vi.mocked(apiClient.POST).mockResolvedValueOnce({
      data: {
        message: 'Solicitud de apoyo adicional registrada y notificada al Centro de Mando.',
        data: {
          reporteTerreno: {
            id: 'rep-apoyo-1',
            misionId: misionBase.id,
            requiereApoyoAdicional: true,
            detalleApoyoRequerido: 'Se solicita motoniveladora y cuadrilla adicional de despeje',
            resumenTecnico: 'Corte total de calzada',
            creadoEn: '2026-11-23T18:30:00.000Z',
            evaluador: {
              id: 'user-cuad-1',
              nombre: 'Juan Delegado',
              email: 'juan@valdivia.cl',
            },
          },
        },
      },
      error: undefined,
      response: new Response(null, { status: 201 }),
    } as never);

    const resultado = await solicitarApoyoAdicional(
      misionBase.id,
      {
        requiereApoyoAdicional: true,
        detalleApoyoRequerido: 'Se solicita motoniveladora y cuadrilla adicional de despeje',
        resumenTecnico: 'Corte total de calzada',
        observaciones: '',
      },
      { misionActual: misionBase }
    );

    expect(apiClient.POST).toHaveBeenCalledWith('/api/misiones/{id}/apoyo', {
      params: { path: { id: misionBase.id } },
      body: {
        requiereApoyoAdicional: true,
        detalleApoyoRequerido: 'Se solicita motoniveladora y cuadrilla adicional de despeje',
        resumenTecnico: 'Corte total de calzada',
      },
    });
    expect(resultado.enColaOffline).toBe(false);
    expect(resultado.solicitud.sincronizado).toBe(true);
    expect(resultado.solicitud.id).toBe('rep-apoyo-1');
    expect(resultado.mensaje).toMatch(/central logística y de operaciones ha sido alertada/i);
    expect(offlineQueue.guardarMisionLocal).toHaveBeenCalled();
    expect(offlineQueue.encolarAccionOutbox).not.toHaveBeenCalled();
  });

  it('encola SOLICITAR_APOYO en IndexedDB outbox cuando no hay conexión (offline-first)', async () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
    });

    const resultado = await solicitarApoyoAdicional(
      misionBase.id,
      {
        requiereApoyoAdicional: true,
        detalleApoyoRequerido: 'Camión aljibe y bomba extractora de 4 pulgadas',
        resumenTecnico: '',
        observaciones: 'Acceso por pasaje sur',
      },
      { misionActual: misionBase }
    );

    expect(apiClient.POST).not.toHaveBeenCalled();
    expect(resultado.enColaOffline).toBe(true);
    expect(resultado.solicitud.sincronizado).toBe(false);
    expect(resultado.mision?.sincronizacionPendiente).toBe(true);
    expect(offlineQueue.encolarAccionOutbox).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'SOLICITAR_APOYO',
        url: `/api/misiones/${misionBase.id}/apoyo`,
        metodo: 'POST',
        payload: expect.objectContaining({
          requiereApoyoAdicional: true,
          detalleApoyoRequerido: 'Camión aljibe y bomba extractora de 4 pulgadas',
          observaciones: 'Acceso por pasaje sur',
        }),
      })
    );
  });

  it('lanza SolicitarApoyoServiceError en errores terminales (400, 403, 409) sin encolar en outbox', async () => {
    for (const status of [400, 403, 409]) {
      vi.mocked(apiClient.POST).mockResolvedValueOnce({
        data: undefined,
        error: { message: `Error HTTP ${status}` },
        response: new Response(null, { status }),
      } as never);

      await expect(
        solicitarApoyoAdicional(
          misionBase.id,
          {
            requiereApoyoAdicional: true,
            detalleApoyoRequerido: 'Generador eléctrico portátil de respaldo',
            resumenTecnico: '',
            observaciones: '',
          },
          { misionActual: misionBase }
        )
      ).rejects.toThrow(SolicitarApoyoServiceError);
    }

    expect(offlineQueue.encolarAccionOutbox).not.toHaveBeenCalled();
  });

  it('invoca handleUnauthorizedSession y lanza 401 sin encolar cuando el token expiró', async () => {
    vi.mocked(apiClient.POST).mockResolvedValueOnce({
      data: undefined,
      error: { message: 'Token expirado' },
      response: new Response(null, { status: 401 }),
    } as never);

    await expect(
      solicitarApoyoAdicional(
        misionBase.id,
        {
          requiereApoyoAdicional: true,
          detalleApoyoRequerido: 'Camión pluma para retiro de poste',
          resumenTecnico: '',
          observaciones: '',
        },
        { misionActual: misionBase }
      )
    ).rejects.toMatchObject({ statusCode: 401 });

    expect(handleUnauthorizedSession).toHaveBeenCalled();
    expect(offlineQueue.encolarAccionOutbox).not.toHaveBeenCalled();
  });

  it('consolida solicitudes remotas (snake_case y camelCase) y locales sin duplicados', () => {
    const lista = obtenerSolicitudesApoyoMision({
      ...misionBase,
      datosAdicionales: {
        reportesTerreno: [
          {
            id: 'rep-1',
            requiere_apoyo_adicional: true,
            detalle_apoyo_requerido: 'Motoniveladora pesada',
            creadoEn: '2026-11-23T18:20:00.000Z',
          },
          {
            id: 'rep-sin-apoyo',
            requiereApoyoAdicional: false,
            detalleApoyoRequerido: null,
            creadoEn: '2026-11-23T18:10:00.000Z',
          },
        ],
        solicitudesApoyoLocales: [
          {
            id: 'rep-1',
            misionId: misionBase.id,
            requiereApoyoAdicional: true,
            detalleApoyoRequerido: 'Motoniveladora pesada',
            resumenTecnico: '',
            observaciones: '',
            creadoEn: '2026-11-23T18:20:00.000Z',
            sincronizado: true,
          },
          {
            localId: 'apoyo-local-2',
            misionId: misionBase.id,
            requiereApoyoAdicional: true,
            detalleApoyoRequerido: 'Cuadrilla eléctrica de apoyo',
            resumenTecnico: '',
            observaciones: '',
            creadoEn: '2026-11-23T18:35:00.000Z',
            sincronizado: false,
          },
        ],
      },
    });

    expect(lista).toHaveLength(2);
    expect(lista[0].detalleApoyoRequerido).toBe('Cuadrilla eléctrica de apoyo');
    expect(lista[0].sincronizado).toBe(false);
    expect(lista[1].detalleApoyoRequerido).toBe('Motoniveladora pesada');
    expect(lista[1].sincronizado).toBe(true);
  });
});
