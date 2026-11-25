import { describe, it, expect } from 'vitest';
import {
  VALORES_INICIALES_REPORTE_VERIFICACION,
  crearReporteVerificacionSchema,
} from '../reporteVerificacion';

describe('Validaciones de informe técnico de verificación y cierre (H39)', () => {
  it('aprueba un reporte válido con dictamen REQUIERE_CUADRILLA y resumen >= 10 caracteres', () => {
    const parsed = crearReporteVerificacionSchema.safeParse({
      ...VALORES_INICIALES_REPORTE_VERIFICACION,
      dictamen: 'REQUIERE_CUADRILLA',
      resumen_tecnico:
        'Se constata caída de árbol sobre tendido eléctrico y obstrucción de calzada.',
      estado_terreno: 'CRITICO',
      personas_afectadas: 4,
      danos_estimados: 'Daño en cerco perimetral de dos viviendas.',
      observaciones: 'Acceso libre por calle paralela.',
      requiere_asistencia_social: true,
      adjuntoIds: [],
      adjuntos: [],
    });

    expect(parsed.success).toBe(true);
  });

  it('rechaza cuando resumen_tecnico tiene menos de 10 caracteres', () => {
    const parsed = crearReporteVerificacionSchema.safeParse({
      ...VALORES_INICIALES_REPORTE_VERIFICACION,
      dictamen: 'REQUIERE_CUADRILLA',
      resumen_tecnico: 'Muy corto',
      estado_terreno: 'ESTABLE',
      personas_afectadas: 0,
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toMatch(/al menos 10 caracteres/i);
    }
  });

  it('exige motivo_no_abordable de al menos 15 caracteres cuando dictamen es NO_ABORDABLE', () => {
    const parsedCorto = crearReporteVerificacionSchema.safeParse({
      ...VALORES_INICIALES_REPORTE_VERIFICACION,
      dictamen: 'NO_ABORDABLE',
      motivo_no_abordable: 'Predio privado',
      resumen_tecnico:
        'Inspección visual desde el exterior sin autorización de ingreso.',
      estado_terreno: 'INACCESIBLE',
      personas_afectadas: 0,
    });

    expect(parsedCorto.success).toBe(false);
    if (!parsedCorto.success) {
      expect(parsedCorto.error.issues[0]?.path).toContain('motivo_no_abordable');
      expect(parsedCorto.error.issues[0]?.message).toMatch(
        /al menos 15 caracteres/i
      );
    }

    const parsedValido = crearReporteVerificacionSchema.safeParse({
      ...VALORES_INICIALES_REPORTE_VERIFICACION,
      dictamen: 'NO_ABORDABLE',
      motivo_no_abordable:
        'Emergencia emplazada dentro de predio privado cercado sin autorización de ingreso.',
      resumen_tecnico:
        'Inspección visual desde vía pública confirma afectación exclusivamente privada.',
      estado_terreno: 'INACCESIBLE',
      personas_afectadas: 0,
    });

    expect(parsedValido.success).toBe(true);
  });

  it('rechaza valores negativos o decimales en personas_afectadas', () => {
    const parsedNeg = crearReporteVerificacionSchema.safeParse({
      ...VALORES_INICIALES_REPORTE_VERIFICACION,
      resumen_tecnico: 'Diagnóstico técnico de terreno verificado.',
      personas_afectadas: -1,
    });
    expect(parsedNeg.success).toBe(false);

    const parsedDecimal = crearReporteVerificacionSchema.safeParse({
      ...VALORES_INICIALES_REPORTE_VERIFICACION,
      resumen_tecnico: 'Diagnóstico técnico de terreno verificado.',
      personas_afectadas: 2.5,
    });
    expect(parsedDecimal.success).toBe(false);
  });

  it('valida los estados de terreno permitidos y conserva adjuntoIds/adjuntos', () => {
    const parsed = crearReporteVerificacionSchema.safeParse({
      ...VALORES_INICIALES_REPORTE_VERIFICACION,
      resumen_tecnico: 'Terreno controlado tras contención inicial.',
      estado_terreno: 'CONTROLADO',
      personas_afectadas: 2,
      requiere_asistencia_social: false,
      adjuntoIds: ['10000000-0000-4000-8000-000000000001'],
      adjuntos: [{ id: '10000000-0000-4000-8000-000000000001', nombreArchivo: 'foto1.jpg' }],
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.adjuntoIds).toEqual([
        '10000000-0000-4000-8000-000000000001',
      ]);
      expect(parsed.data.adjuntos).toHaveLength(1);
    }
  });

  it('exige estado_terreno como campo obligatorio (BUG-H39-PWA-02)', () => {
    const sinEstado = crearReporteVerificacionSchema.safeParse({
      dictamen: 'REQUIERE_CUADRILLA',
      resumen_tecnico: 'Diagnóstico técnico válido de terreno.',
      personas_afectadas: 2,
      requiere_asistencia_social: false,
    });

    expect(sinEstado.success).toBe(false);
  });
});
