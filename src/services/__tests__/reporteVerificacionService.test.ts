import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  enviarReporteVerificacionTerreno,
  obtenerReporteVerificacionMision,
} from '../reporteVerificacionService';
import apiClient from '@/lib/api/client';
import { VALORES_INICIALES_REPORTE_VERIFICACION } from '@/lib/validations/reporteVerificacion';
import * as offlineQueue from '../offlineQueue';
import * as misionesService from '../misionesService';
import type { MisionLocal } from '@/types/offline';

describe('reporteVerificacionService (H39)', () => {
  const misionMock: MisionLocal = {
    id: '60000000-0000-4000-8000-000000000001',
    incidenteId: '50000000-0000-4000-8000-000000000001',
    codigoIncidente: 'INC-2026-001',
    tipologia: 'Inundación',
    direccion: 'Av. Alemania 600, Valdivia',
    prioridad: 'ALTA',
    estado: 'EN_CURSO',
    fechaDespacho: '2026-11-10T00:00:00Z',
    actualizadoEn: '2026-11-10T00:00:00Z',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(misionesService, 'obtenerCoordenadasOpcionales').mockResolvedValue({});
    vi.spyOn(offlineQueue, 'encolarAccionOutbox').mockResolvedValue({
      id: 'outbox-rep-1',
      tipo: 'ENVIAR_REPORTE',
      url: `/api/misiones/${misionMock.id}/reporte`,
      metodo: 'POST',
      payload: {},
      timestamp: new Date().toISOString(),
      intentos: 0,
    });
    vi.spyOn(offlineQueue, 'guardarMisionLocal').mockResolvedValue();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('enviarReporteVerificacionTerreno', () => {
    it('envía POST online (201 Created) vía apiClient, actualiza la misión a COMPLETADA, patrulla a DISPONIBLE y captura evaluador', async () => {
      vi.stubGlobal('navigator', { onLine: true });
      const postSpy = vi.spyOn(apiClient, 'POST').mockResolvedValueOnce({
        data: {
          message:
            'Informe técnico de verificación registrado y misión cerrada exitosamente.',
          data: {
            reporteTerreno: {
              id: 'rep-cierre-1',
              creadoEn: '2026-11-16T01:00:00Z',
              evaluador: {
                id: 'usr-p1',
                nombre: 'Personal 1',
                email: 'p1@valdivia.cl',
                rut: '11.111.111-1',
              },
            },
            mision: {
              id: misionMock.id,
              estado: 'COMPLETADA',
              fechaCierre: '2026-11-16T01:00:00Z',
              actualizadoEn: '2026-11-16T01:00:00Z',
            },
            patrulla: {
              id: 'pat-1',
              estado: 'DISPONIBLE',
            },
            incidente: {
              id: misionMock.incidenteId,
              estado: 'VERIFICANDO',
            },
          },
        },
        error: undefined,
        response: new Response(null, { status: 201 }),
      } as never);

      const resultado = await enviarReporteVerificacionTerreno(
        misionMock.id,
        {
          ...VALORES_INICIALES_REPORTE_VERIFICACION,
          dictamen: 'REQUIERE_CUADRILLA',
          resumen_tecnico:
            'Se constata socavón en calzada con riesgo vehicular; requiere cuadrilla vial.',
          estado_terreno: 'CRITICO',
          personas_afectadas: 5,
          requiere_asistencia_social: true,
        },
        misionMock
      );

      expect(postSpy).toHaveBeenCalledWith(
        '/api/misiones/{id}/reporte',
        expect.objectContaining({
          params: { path: { id: misionMock.id } },
          body: expect.objectContaining({
            dictamen: 'REQUIERE_CUADRILLA',
            estado_terreno: 'CRITICO',
          }),
        })
      );
      expect(resultado.ok).toBe(true);
      expect(resultado.offline).toBe(false);
      expect(resultado.reporte.evaluador?.nombre).toBe('Personal 1');
      expect(resultado.mision?.estado).toBe('COMPLETADA');
      expect(resultado.mision?.datosAdicionales?.estadoPatrulla).toBe('DISPONIBLE');
      expect(
        resultado.mision?.datosAdicionales?.reporteVerificacionEnviado
      ).toBe(true);
      expect(offlineQueue.guardarMisionLocal).toHaveBeenCalled();
    });

    it('encola en outbox (ENVIAR_REPORTE) y marca sincronizacionPendiente cuando está offline', async () => {
      vi.stubGlobal('navigator', { onLine: false });

      const resultado = await enviarReporteVerificacionTerreno(
        misionMock.id,
        {
          ...VALORES_INICIALES_REPORTE_VERIFICACION,
          dictamen: 'NO_ABORDABLE',
          motivo_no_abordable:
            'Emergencia dentro de predio privado sin autorización de ingreso ni riesgo vial.',
          resumen_tecnico: 'Se realiza inspección perimetral desde vía pública.',
          estado_terreno: 'INACCESIBLE',
          personas_afectadas: 0,
        },
        misionMock
      );

      expect(resultado.ok).toBe(true);
      expect(resultado.offline).toBe(true);
      expect(resultado.mision?.estado).toBe('COMPLETADA');
      expect(resultado.mision?.sincronizacionPendiente).toBe(true);
      expect(resultado.mision?.datosAdicionales?.estadoIncidente).toBe(
        'NO_ABORDABLE'
      );
      expect(offlineQueue.encolarAccionOutbox).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'ENVIAR_REPORTE',
          url: `/api/misiones/${misionMock.id}/reporte`,
          metodo: 'POST',
        })
      );
    });

    it('propaga estrictamente 401, 403 y 404 sin devolver nunca éxito (BUG-H39-PWA-01)', async () => {
      vi.stubGlobal('navigator', { onLine: true });

      vi.spyOn(apiClient, 'POST').mockResolvedValueOnce({
        data: undefined,
        error: { message: 'Token inválido' },
        response: new Response(null, { status: 401 }),
      } as never);

      await expect(
        enviarReporteVerificacionTerreno(
          misionMock.id,
          {
            ...VALORES_INICIALES_REPORTE_VERIFICACION,
            resumen_tecnico: 'Diagnóstico técnico válido de verificación.',
          },
          misionMock
        )
      ).rejects.toThrow(/Sesión expirada/i);

      vi.spyOn(apiClient, 'POST').mockResolvedValueOnce({
        data: undefined,
        error: { message: 'No posee el permiso requerido: reportes:crear.' },
        response: new Response(null, { status: 403 }),
      } as never);

      await expect(
        enviarReporteVerificacionTerreno(
          misionMock.id,
          {
            ...VALORES_INICIALES_REPORTE_VERIFICACION,
            resumen_tecnico: 'Diagnóstico técnico válido de verificación.',
          },
          misionMock
        )
      ).rejects.toThrow(/reportes:crear/i);

      vi.spyOn(apiClient, 'POST').mockResolvedValueOnce({
        data: undefined,
        error: { message: 'Misión no encontrada.' },
        response: new Response(null, { status: 404 }),
      } as never);

      await expect(
        enviarReporteVerificacionTerreno(
          misionMock.id,
          {
            ...VALORES_INICIALES_REPORTE_VERIFICACION,
            resumen_tecnico: 'Diagnóstico técnico válido de verificación.',
          },
          misionMock
        )
      ).rejects.toThrow(/no encontrada/i);
    });

    it('lanza error descriptivo ante 409 Conflict (misión no EN_CURSO o ya cerrada)', async () => {
      vi.stubGlobal('navigator', { onLine: true });
      vi.spyOn(apiClient, 'POST').mockResolvedValueOnce({
        data: undefined,
        error: { message: 'La misión ya fue cerrada previamente.' },
        response: new Response(null, { status: 409 }),
      } as never);

      await expect(
        enviarReporteVerificacionTerreno(
          misionMock.id,
          {
            ...VALORES_INICIALES_REPORTE_VERIFICACION,
            resumen_tecnico: 'Diagnóstico técnico válido de verificación.',
          },
          misionMock
        )
      ).rejects.toThrow(/cerrada previamente/i);
    });
  });

  describe('obtenerReporteVerificacionMision', () => {
    it('extrae el reporte de cierre desde reportesTerreno del servidor incluyendo su evaluador', () => {
      const misionConCierreRemoto: MisionLocal = {
        ...misionMock,
        estado: 'COMPLETADA',
        datosAdicionales: {
          reportesTerreno: [
            {
              id: 'rep-prio-1',
              tipoReporte: 'EVALUACION_PRIORIDAD',
              resumenTecnico: 'Prioridad evaluada',
              personasAfectadas: 3,
              evaluador: { id: 'u1', nombre: 'Personal 1', email: 'p1@valdivia.cl' },
              creadoEn: '2026-11-16T00:30:00Z',
            },
            {
              id: 'rep-cierre-1',
              tipoReporte: 'VERIFICACION_CIERRE',
              dictamen: 'REQUIERE_CUADRILLA',
              resumenTecnico: 'Se requiere motobomba en intersección.',
              estadoTerreno: 'CRITICO',
              personasAfectadas: 3,
              requiereAsistenciaSocial: true,
              danosEstimados: 'Anegamiento en acceso.',
              observaciones: 'Acceso norte habilitado.',
              evaluador: {
                id: 'u1',
                nombre: 'Personal 1',
                email: 'p1@valdivia.cl',
                rut: '11.111.111-1',
              },
              adjuntos: [],
              creadoEn: '2026-11-16T01:00:00Z',
            },
          ],
        },
      };

      const cierre = obtenerReporteVerificacionMision(misionConCierreRemoto);
      expect(cierre).not.toBeNull();
      expect(cierre?.dictamen).toBe('REQUIERE_CUADRILLA');
      expect(cierre?.evaluador?.nombre).toBe('Personal 1');
      expect(cierre?.personas_afectadas).toBe(3);
      expect(cierre?.requiere_asistencia_social).toBe(true);
    });
  });
});
