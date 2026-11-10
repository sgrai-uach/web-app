import { describe, it, expect } from 'vitest';
import { reclasificarTipologiaSchema } from '../tipologia';

describe('reclasificarTipologiaSchema (H37)', () => {
  const validUuid = '40000000-0000-4000-8000-000000000001';
  const validMisionUuid = '60000000-0000-4000-8000-000000000001';

  it('valida exitosamente un payload completo y válido', () => {
    const input = {
      tipoIncidenteId: validUuid,
      justificacion: 'Se constata desborde de cauce con ingreso de agua a viviendas.',
      misionId: validMisionUuid,
    };
    const resultado = reclasificarTipologiaSchema.safeParse(input);
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.tipoIncidenteId).toBe(validUuid);
      expect(resultado.data.justificacion).toBe(input.justificacion);
      expect(resultado.data.misionId).toBe(validMisionUuid);
    }
  });

  it('valida exitosamente sin misionId opcional', () => {
    const input = {
      tipoIncidenteId: validUuid,
      justificacion: 'Inundación confirmada en terreno.',
    };
    const resultado = reclasificarTipologiaSchema.safeParse(input);
    expect(resultado.success).toBe(true);
  });

  it('falla si tipoIncidenteId no es un UUID válido', () => {
    const input = {
      tipoIncidenteId: 'invalid-uuid',
      justificacion: 'Justificación válida de terreno.',
    };
    const resultado = reclasificarTipologiaSchema.safeParse(input);
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0].message).toContain('UUID válido');
    }
  });

  it('falla si la justificación tiene menos de 5 caracteres', () => {
    const input = {
      tipoIncidenteId: validUuid,
      justificacion: 'Test',
    };
    const resultado = reclasificarTipologiaSchema.safeParse(input);
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0].message).toContain('al menos 5 caracteres');
    }
  });

  it('falla si la justificación contiene sólo espacios en blanco', () => {
    const input = {
      tipoIncidenteId: validUuid,
      justificacion: '      ',
    };
    const resultado = reclasificarTipologiaSchema.safeParse(input);
    expect(resultado.success).toBe(false);
  });

  it('falla si la justificación excede 1000 caracteres', () => {
    const input = {
      tipoIncidenteId: validUuid,
      justificacion: 'a'.repeat(1001),
    };
    const resultado = reclasificarTipologiaSchema.safeParse(input);
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0].message).toContain('1000 caracteres');
    }
  });
});
