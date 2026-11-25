import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  asignarPrioridadEnTerreno,
  solicitarCalculoPrioridad,
  obtenerUltimoReportePrioridad,
  obtenerReportesPrioridadMision,
  obtenerPersonasAfectadasPrevias,
} from '../prioridadService';
import { VALORES_INICIALES_EVALUACION_PRIORIDAD } from '@/lib/validations/prioridad';
import * as offlineQueue from '../offlineQueue';
import apiClient from '@/lib/api/client';
import type { MisionLocal } from '@/types/offline';

vi.mock('@/lib/api/client', () => ({
  default: {
    POST: vi.fn(),
    PATCH: vi.fn(),
  },
}));

describe('prioridadService (H38)', () => {
  const misionMock: MisionLocal = {
    id: '60000000-0000-4000-8000-000000000001',
    incidenteId: '50000000-0000-4000-8000-000000000001',
    codigoIncidente: 'INC-2026-001',
    tipologia: 'Inundación',
    direccion: 'Av. Alemania 600, Valdivia',
    prioridad: 'MEDIA',
    estado: 'EN_CURSO',
    fechaDespacho: '2026-11-10T00:00:00Z',
    actualizadoEn: '2026-11-10T00:00:00Z',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(offlineQueue, 'encolarAccionOutbox').mockResolvedValue({
      id: 'outbox-prio-1',
      tipo: 'AJUSTAR_PRIORIDAD',
      url: `/api/incidentes/${misionMock.incidenteId}/prioridad`,
      metodo: 'PATCH',
      payload: {},
      timestamp: new Date().toISOString(),
      intentos: 0,
    });
    vi.spyOn(offlineQueue, 'guardarMisionLocal').mockResolvedValue();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('solicitarCalculoPrioridad', () => {
    it('retorna el cálculo del servidor cuando responde 200 OK', async () => {
      vi.stubGlobal('navigator', { onLine: true });
      vi.mocked(apiClient.POST).mockResolvedValueOnce({
        data: {
          data: {
            prioridadSugerida: 'CRITICA',
            factoresGatillantes: ['Riesgo eléctrico confirmado por servidor'],
          },
        },
        error: undefined,
        response: new Response(null, { status: 200 }),
      } as never);

      const res = await solicitarCalculoPrioridad(misionMock.incidenteId, {
        ...VALORES_INICIALES_EVALUACION_PRIORIDAD,
        riesgoElectrico: true,
      });

      expect(res.prioridadSugerida).toBe('CRITICA');
      expect(res.factoresGatillantes).toEqual([
        'Riesgo eléctrico confirmado por servidor',
      ]);
    });

    it('utiliza el cálculo local determinista cuando está offline o falla el servidor', async () => {
      vi.stubGlobal('navigator', { onLine: false });

      const res = await solicitarCalculoPrioridad(misionMock.incidenteId, {
        ...VALORES_INICIALES_EVALUACION_PRIORIDAD,
        familias: [],
        personasDiscapacitadas: 2,
      });

      expect(res.prioridadSugerida).toBe('MEDIA');
      expect(res.factoresGatillantes[0]).toMatch(
        /Personas con discapacidad/i
      );
    });
  });

  describe('asignarPrioridadEnTerreno', () => {
    it('rechaza con error de validación si se modifica la prioridad sugerida sin justificación de al menos 5 caracteres', async () => {
      await expect(
        asignarPrioridadEnTerreno(
          misionMock.incidenteId,
          {
            ...VALORES_INICIALES_EVALUACION_PRIORIDAD,
            prioridadSugerida: 'BAJA',
            prioridad: 'ALTA',
            justificacionPrioridad: 'abc',
          },
          misionMock
        )
      ).rejects.toThrow(/al menos 5 caracteres/i);
    });

    it('envía petición PATCH online exitosa, actualiza la prioridad de la misión y registra Reporte #1', async () => {
      vi.stubGlobal('navigator', { onLine: true });
      vi.mocked(apiClient.PATCH).mockResolvedValueOnce({
        data: {
          message: 'Prioridad actualizada y reporte registrado en el Centro de Mando.',
          data: {
            incidente: {
              id: misionMock.incidenteId,
              prioridad: 'CRITICA',
              actualizadoEn: '2026-11-11T12:00:00Z',
            },
            reporteTerreno: {
              id: 'rep-100',
              versionReporte: 1,
            },
          },
        },
        error: undefined,
        response: new Response(null, { status: 200 }),
      } as never);

      const resultado = await asignarPrioridadEnTerreno(
        misionMock.incidenteId,
        {
          ...VALORES_INICIALES_EVALUACION_PRIORIDAD,
          nucleoFamiliarTotal: 4,
          personasElectrodependientes: 1,
          prioridadSugerida: 'CRITICA',
          prioridad: 'CRITICA',
          justificacionPrioridad: '',
          misionId: misionMock.id,
        },
        misionMock
      );

      expect(resultado.ok).toBe(true);
      expect(resultado.offline).toBe(false);
      expect(resultado.versionReporte).toBe(1);
      expect(resultado.mision?.prioridad).toBe('CRITICA');
      expect(resultado.mision?.datosAdicionales?.prioridadEvaluada).toBe(true);
      expect(offlineQueue.guardarMisionLocal).toHaveBeenCalled();
    });

    it('incrementa la versión a Reporte #2 cuando la misión ya posee un reporte previo', async () => {
      vi.stubGlobal('navigator', { onLine: true });
      vi.mocked(apiClient.PATCH).mockResolvedValueOnce({
        data: {
          data: {
            incidente: {
              id: misionMock.incidenteId,
              prioridad: 'CRITICA',
            },
          },
        },
        error: undefined,
        response: new Response(null, { status: 200 }),
      } as never);

      const misionConReportePrevio: MisionLocal = {
        ...misionMock,
        datosAdicionales: {
          prioridadEvaluada: true,
          versionReportePrioridad: 1,
          reportesPrioridad: [
            {
              id: 'rep-1',
              versionReporte: 1,
              evaluacion: {
                ...VALORES_INICIALES_EVALUACION_PRIORIDAD,
                nucleoFamiliarTotal: 2,
              },
              prioridadSugerida: 'MEDIA',
              prioridadAsignada: 'MEDIA',
              factoresGatillantes: ['Núcleo familiar afectado (2 personas)'],
              justificacionPrioridad: 'Ratificada',
              creadoEn: '2026-11-11T10:00:00Z',
              sincronizado: true,
            },
          ],
        },
      };

      const ultimoPrevio = obtenerUltimoReportePrioridad(misionConReportePrevio);
      expect(ultimoPrevio?.versionReporte).toBe(1);

      const resultado = await asignarPrioridadEnTerreno(
        misionMock.incidenteId,
        {
          ...VALORES_INICIALES_EVALUACION_PRIORIDAD,
          nucleoFamiliarTotal: 5,
          riesgoEstructural: true,
          prioridadSugerida: 'CRITICA',
          prioridad: 'CRITICA',
        },
        misionConReportePrevio
      );

      expect(resultado.versionReporte).toBe(2);
      expect(resultado.mision?.datosAdicionales?.versionReportePrioridad).toBe(2);
      expect(resultado.mensaje).toMatch(/Reporte #2/i);
    });

    it('encola en outbox (AJUSTAR_PRIORIDAD) y marca sincronizacionPendiente cuando está offline', async () => {
      vi.stubGlobal('navigator', { onLine: false });

      const resultado = await asignarPrioridadEnTerreno(
        misionMock.incidenteId,
        {
          ...VALORES_INICIALES_EVALUACION_PRIORIDAD,
          prioridadSugerida: 'BAJA',
          prioridad: 'ALTA',
          justificacionPrioridad:
            'Se observa crecida acelerada de estero colindante a viviendas.',
        },
        misionMock
      );

      expect(resultado.ok).toBe(true);
      expect(resultado.offline).toBe(true);
      expect(resultado.mision?.prioridad).toBe('ALTA');
      expect(resultado.mision?.sincronizacionPendiente).toBe(true);
      expect(offlineQueue.encolarAccionOutbox).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'AJUSTAR_PRIORIDAD',
          url: `/api/incidentes/${misionMock.incidenteId}/prioridad`,
          metodo: 'PATCH',
        })
      );
    });

    it('lanza error descriptivo ante 403 Forbidden (falta permiso misiones:terreno:verificar)', async () => {
      vi.stubGlobal('navigator', { onLine: true });
      vi.mocked(apiClient.PATCH).mockResolvedValueOnce({
        data: undefined,
        error: {
          message: 'Se requiere el permiso misiones:terreno:verificar.',
        },
        response: new Response(null, { status: 403 }),
      } as never);

      await expect(
        asignarPrioridadEnTerreno(
          misionMock.incidenteId,
          {
            ...VALORES_INICIALES_EVALUACION_PRIORIDAD,
            prioridadSugerida: 'BAJA',
            prioridad: 'BAJA',
          },
          misionMock
        )
      ).rejects.toThrow(/misiones:terreno:verificar/i);
    });
  });

  describe('reconciliación multi-operador y personas afectadas previas', () => {
    it('reconcilia reportes remotos (reportesTerreno) conservando evaluador y excluyendo VERIFICACION_CIERRE', () => {
      const misionCompartida: MisionLocal = {
        ...misionMock,
        datosAdicionales: {
          prioridadEvaluada: true,
          reportesTerreno: [
            {
              id: 'rep-prio-p1',
              tipoReporte: 'EVALUACION_PRIORIDAD',
              versionReporte: 1,
              prioridadSugerida: 'ALTA',
              prioridadAsignada: 'ALTA',
              justificacionPrioridad: 'Adultos mayores afectados',
              personasAfectadas: 5,
              detallesEvaluacion: {
                ...VALORES_INICIALES_EVALUACION_PRIORIDAD,
                nucleoFamiliarTotal: 5,
                cantidadAdultosMayores: 2,
              },
              evaluador: {
                id: 'usr-p1',
                nombre: 'Personal 1',
                email: 'p1@valdivia.cl',
              },
              creadoEn: '2026-11-16T00:15:00Z',
            },
            {
              id: 'rep-cierre-p1',
              tipoReporte: 'VERIFICACION_CIERRE',
              dictamen: 'REQUIERE_CUADRILLA',
              resumenTecnico: 'Cierre de verificación',
              personasAfectadas: 5,
              evaluador: {
                id: 'usr-p1',
                nombre: 'Personal 1',
                email: 'p1@valdivia.cl',
              },
              creadoEn: '2026-11-16T00:45:00Z',
            },
          ],
        },
      };

      const lista = obtenerReportesPrioridadMision(misionCompartida);
      expect(lista).toHaveLength(1);
      expect(lista[0]?.evaluador?.nombre).toBe('Personal 1');
      expect(lista[0]?.evaluacion.nucleoFamiliarTotal).toBe(5);

      const previas = obtenerPersonasAfectadasPrevias(misionCompartida);
      expect(previas).toEqual({
        cantidad: 5,
        tieneEvaluacionPrevia: true,
        versionReporte: 1,
        evaluadorNombre: 'Personal 1',
      });
    });
  });
});

