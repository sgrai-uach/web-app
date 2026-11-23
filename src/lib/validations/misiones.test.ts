import { describe, it, expect } from 'vitest';
import { rechazoMisionSchema } from './misiones';

describe('Validaciones de Misiones — rechazoMisionSchema (H41, H69)', () => {
  it('rechaza cuando la justificación está vacía o solo con espacios', () => {
    const resVacio = rechazoMisionSchema.safeParse({ justificacion_rechazo: '' });
    expect(resVacio.success).toBe(false);
    if (!resVacio.success) {
      expect(resVacio.error.issues[0].message).toContain('al menos 5 caracteres');
    }

    const resEspacios = rechazoMisionSchema.safeParse({ justificacion_rechazo: '     ' });
    expect(resEspacios.success).toBe(false);
  });

  it('rechaza cuando la justificación tiene menos de 5 caracteres tras trim', () => {
    const res = rechazoMisionSchema.safeParse({ justificacion_rechazo: '   ab  ' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toContain('al menos 5 caracteres');
    }
  });

  it('rechaza exactamente 4 caracteres', () => {
    const res = rechazoMisionSchema.safeParse({ justificacion_rechazo: '1234' });
    expect(res.success).toBe(false);
  });

  it('acepta exactamente 5 caracteres válidos y recorta espacios', () => {
    const res = rechazoMisionSchema.safeParse({ justificacion_rechazo: '  Falla  ' });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.justificacion_rechazo).toBe('Falla');
    }
  });

  it('acepta justificación con coordenadas GPS válidas en paridad', () => {
    const res = rechazoMisionSchema.safeParse({
      justificacion_rechazo: 'Desperfecto mecánico en neumático.',
      latitud: -39.81422,
      longitud: -73.24589,
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.latitud).toBe(-39.81422);
      expect(res.data.longitud).toBe(-73.24589);
    }
  });

  it('rechaza si se informa solo latitud o solo longitud, o valores fuera de rango WGS84', () => {
    const resSoloLat = rechazoMisionSchema.safeParse({
      justificacion_rechazo: 'Falla mecánica grave',
      latitud: -39.81,
    });
    expect(resSoloLat.success).toBe(false);

    const resFueraRango = rechazoMisionSchema.safeParse({
      justificacion_rechazo: 'Falla mecánica grave',
      latitud: -95,
      longitud: -73.24,
    });
    expect(resFueraRango.success).toBe(false);
  });
});
