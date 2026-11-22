import { describe, it, expect } from 'vitest';
import { rechazoMisionSchema } from './misiones';

describe('rechazoMisionSchema (Regla Crítica §3.3)', () => {
  it('rechaza cuando la justificación está vacía', () => {
    const res = rechazoMisionSchema.safeParse({ justificacion_rechazo: '' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toContain('al menos 5 caracteres');
    }
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

  it('acepta exactamente 5 caracteres válidos', () => {
    const res = rechazoMisionSchema.safeParse({ justificacion_rechazo: 'Falla' });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.justificacion_rechazo).toBe('Falla');
    }
  });

  it('acepta justificación con coordenadas GPS opcionales', () => {
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
});

