import { describe, it, expect } from 'vitest';
import {
  VALORES_INICIALES_EVALUACION_PRIORIDAD,
  asignarPrioridadSchema,
  calcularPrioridadSugerida,
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
          expect.stringMatching(/Sin personas vulnerables/i),
        ])
      );
    });

    it('sugiere prioridad MEDIA cuando hay núcleo familiar afectado o daño leve en vivienda', () => {
      const resultado = calcularPrioridadSugerida({
        ...VALORES_INICIALES_EVALUACION_PRIORIDAD,
        nucleoFamiliarTotal: 3,
        cantidadNinos: 1,
        viviendasAfectadas: 1,
        nivelCompromisoVivienda: 'LEVE',
      });

      expect(resultado.prioridadSugerida).toBe('MEDIA');
      expect(resultado.factoresGatillantes).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/Presencia de 1 niño/i),
          expect.stringMatching(/Núcleo familiar afectado/i),
          expect.stringMatching(/Vivienda con daño leve/i),
        ])
      );
    });

    it('sugiere prioridad ALTA cuando hay personas con discapacidad, adultos mayores o daño moderado', () => {
      const resultado = calcularPrioridadSugerida({
        ...VALORES_INICIALES_EVALUACION_PRIORIDAD,
        nucleoFamiliarTotal: 4,
        cantidadAdultosMayores: 1,
        personasDiscapacitadas: 1,
        aislamientoVial: true,
        nivelCompromisoVivienda: 'MODERADO',
      });

      expect(resultado.prioridadSugerida).toBe('ALTA');
      expect(resultado.factoresGatillantes).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/Personas con discapacidad afectadas/i),
          expect.stringMatching(/Adultos mayores afectados/i),
          expect.stringMatching(/Aislamiento vial/i),
        ])
      );
    });

    it('sugiere prioridad CRITICA cuando hay personas electrodependientes, riesgo eléctrico o vivienda inhabitable', () => {
      const resultado = calcularPrioridadSugerida({
        ...VALORES_INICIALES_EVALUACION_PRIORIDAD,
        personasElectrodependientes: 1,
        riesgoElectrico: true,
        nivelCompromisoVivienda: 'GRAVE_INHABITABLE',
      });

      expect(resultado.prioridadSugerida).toBe('CRITICA');
      expect(resultado.factoresGatillantes).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/Personas electrodependientes afectadas/i),
          expect.stringMatching(/Peligro eléctrico activo/i),
          expect.stringMatching(/Vivienda con daño grave o inhabitable/i),
        ])
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
  });
});

