import { describe, it, expect } from 'vitest';
import { rechazoMisionSchema } from './misiones';

describe('Validaciones de Misiones — rechazoMisionSchema (H41, H69)', () => {
  it('rechaza una justificación vacía o solo con espacios', () => {
    const resVacio = rechazoMisionSchema.safeParse({ justificacion_rechazo: '' });
    expect(resVacio.success).toBe(false);

    const resEspacios = rechazoMisionSchema.safeParse({ justificacion_rechazo: '     ' });
    expect(resEspacios.success).toBe(false);
  });

  it('rechaza una justificación con menos de 5 caracteres útiles tras trim', () => {
    const resCorto = rechazoMisionSchema.safeParse({ justificacion_rechazo: '  abc  ' });
    expect(resCorto.success).toBe(false);
    if (!resCorto.success) {
      expect(resCorto.error.issues[0]?.message).toContain('al menos 5 caracteres');
    }
  });

  it('acepta una justificación válida de 5 o más caracteres y recorta espacios', () => {
    const res = rechazoMisionSchema.safeParse({
      justificacion_rechazo: '  Falla hidráulica en camión tolva  ',
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.justificacion_rechazo).toBe('Falla hidráulica en camión tolva');
    }
  });

  it('acepta coordenadas GPS válidas cuando se entregan ambas', () => {
    const res = rechazoMisionSchema.safeParse({
      justificacion_rechazo: 'Camión con desperfecto mecánico',
      latitud: -39.81422,
      longitud: -73.24589,
    });
    expect(res.success).toBe(true);
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
