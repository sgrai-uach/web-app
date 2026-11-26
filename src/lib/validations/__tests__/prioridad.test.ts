import { describe, it, expect } from 'vitest';
import {
  VALORES_INICIALES_EVALUACION_PRIORIDAD,
  asignarPrioridadSchema,
  calcularPrioridadSugerida,
  familiaAfectadaSchema,
} from '../prioridad';

describe('Validaciones y cálculo de prioridad en terreno (H38)', () => {
  describe('calcularPrioridadSugerida', () => {
    it('sugiere prioridad BAJA cuando no hay vulnerables, daños ni peligros activos', () => {
      const resultado = calcularPrioridadSugerida(
        VALORES_INICIALES_EVALUACION_PRIORIDAD
      );

      expect(resultado.prioridadSugerida).toBe('BAJA');
      expect(resultado.factoresGatillantes).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/Sin afectación humana directa/i),
        ])
      );
    });

    it('sugiere prioridad MEDIA cuando hay núcleo familiar afectado o daño leve en vivienda', () => {
      const resultado = calcularPrioridadSugerida({
        ...VALORES_INICIALES_EVALUACION_PRIORIDAD,
        familias: [],
        nucleoFamiliarTotal: 3,
        cantidadNinos: 1,
        viviendasAfectadas: 1,
        nivelCompromisoVivienda: 'LEVE',
      });

      expect(resultado.prioridadSugerida).toBe('MEDIA');
      expect(resultado.factoresGatillantes).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/Personas afectadas en el núcleo/i),
          expect.stringMatching(/Niños afectados/i),
          expect.stringMatching(/Compromiso de vivienda LEVE/i),
        ])
      );
    });

    it('sugiere prioridad ALTA cuando hay personas vulnerables y daño moderado', () => {
      const resultado = calcularPrioridadSugerida({
        ...VALORES_INICIALES_EVALUACION_PRIORIDAD,
        familias: [],
        nucleoFamiliarTotal: 4,
        cantidadAdultosMayores: 1,
        aislamientoVial: true,
        nivelCompromisoVivienda: 'MODERADO',
      });

      expect(resultado.prioridadSugerida).toBe('ALTA');
      expect(resultado.factoresGatillantes).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/Adultos mayores afectados/i),
          expect.stringMatching(/Aislamiento vial/i),
          expect.stringMatching(/Compromiso de vivienda MODERADO/i),
        ])
      );
    });

    it('sugiere prioridad CRITICA cuando hay personas electrodependientes, riesgo eléctrico o vivienda inhabitable', () => {
      const resultado = calcularPrioridadSugerida({
        ...VALORES_INICIALES_EVALUACION_PRIORIDAD,
        familias: [],
        personasElectrodependientes: 1,
        riesgoElectrico: true,
        nivelCompromisoVivienda: 'GRAVE_INHABITABLE',
      });

      expect(resultado.prioridadSugerida).toBe('CRITICA');
      expect(resultado.factoresGatillantes).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/electrodependientes/i),
          expect.stringMatching(/Riesgo eléctrico activo/i),
          expect.stringMatching(/GRAVE \/ INHABITABLE/i),
        ])
      );
    });

    it('homologa riesgoEstructural aislado a MEDIA (25 pts) igual que sgrai-api y permite decrementar a 0 en familia única', () => {
      const resEstructural = calcularPrioridadSugerida({
        ...VALORES_INICIALES_EVALUACION_PRIORIDAD,
        riesgoEstructural: true,
      });
      expect(resEstructural.prioridadSugerida).toBe('MEDIA');

      const trasDecremento = calcularPrioridadSugerida({
        ...VALORES_INICIALES_EVALUACION_PRIORIDAD,
        personasElectrodependientes: 1,
        familias: [
          {
            ...VALORES_INICIALES_EVALUACION_PRIORIDAD.familias[0],
            personasElectrodependientes: 0,
          },
        ],
      });
      expect(trasDecremento.prioridadSugerida).toBe('BAJA');
    });
    it('no considera requiereApoyoAdicional en el cálculo de prioridad sugerida', () => {
      const resultado = calcularPrioridadSugerida({
        ...VALORES_INICIALES_EVALUACION_PRIORIDAD,
        requiereApoyoAdicional: true,
      });

      expect(resultado.prioridadSugerida).toBe('BAJA');
      expect(resultado.factoresGatillantes).not.toContain(
        'Requiere apoyo operativo adicional'
      );
    });

    it('no incluye Ficha FIBE (requiereAsistenciaSocial) en la evaluación ni factores de HU-38 tras su traslado a HU-39', () => {
      expect(VALORES_INICIALES_EVALUACION_PRIORIDAD).not.toHaveProperty(
        'requiereAsistenciaSocial'
      );
      const resultado = calcularPrioridadSugerida(
        VALORES_INICIALES_EVALUACION_PRIORIDAD
      );
      expect(resultado.factoresGatillantes).not.toContain(
        'Requiere levantamiento social (FIBE)'
      );
    });
  });

  describe('asignarPrioridadSchema', () => {
    it('aprueba la validación sin justificación cuando la prioridad seleccionada coincide con la sugerida', () => {
      const parsed = asignarPrioridadSchema.safeParse({
        ...VALORES_INICIALES_EVALUACION_PRIORIDAD,
        prioridadSugerida: 'ALTA',
        prioridad: 'ALTA',
        justificacionPrioridad: '',
      });

      expect(parsed.success).toBe(true);
    });

    it('rechaza cuando se modifica la prioridad sugerida sin justificación o con menos de 5 caracteres', () => {
      const parsedVacio = asignarPrioridadSchema.safeParse({
        ...VALORES_INICIALES_EVALUACION_PRIORIDAD,
        prioridadSugerida: 'MEDIA',
        prioridad: 'CRITICA',
        justificacionPrioridad: 'abc',
      });

      expect(parsedVacio.success).toBe(false);
      if (!parsedVacio.success) {
        expect(parsedVacio.error.issues[0]?.message).toMatch(
          /al menos 5 caracteres/i
        );
      }
    });

    it('aprueba cuando se modifica la prioridad sugerida con una justificación de al menos 5 caracteres', () => {
      const parsed = asignarPrioridadSchema.safeParse({
        ...VALORES_INICIALES_EVALUACION_PRIORIDAD,
        prioridadSugerida: 'MEDIA',
        prioridad: 'CRITICA',
        justificacionPrioridad:
          'Se constata riesgo inminente de caída de poste sobre vivienda habitada.',
      });

      expect(parsed.success).toBe(true);
    });

    it('rechaza en familiaAfectadaSchema cuando niños + adultos mayores, discapacidad o electrodependientes superan el núcleo familiar', () => {
      const baseFamilia = {
        nucleoFamiliarTotal: 3,
        cantidadNinos: 2,
        cantidadAdultosMayores: 2,
        personasDiscapacitadas: 0,
        personasElectrodependientes: 0,
        mascotasAfectadas: 5,
        nivelCompromisoVivienda: 'SIN_DANO' as const,
      };

      const resEtario = familiaAfectadaSchema.safeParse(baseFamilia);
      expect(resEtario.success).toBe(false);

      const resDiscapacidad = familiaAfectadaSchema.safeParse({
        ...baseFamilia,
        cantidadNinos: 1,
        cantidadAdultosMayores: 1,
        personasDiscapacitadas: 4,
      });
      expect(resDiscapacidad.success).toBe(false);

      const resElectro = familiaAfectadaSchema.safeParse({
        ...baseFamilia,
        cantidadNinos: 1,
        cantidadAdultosMayores: 1,
        personasElectrodependientes: 4,
      });
      expect(resElectro.success).toBe(false);
    });
  });
});

