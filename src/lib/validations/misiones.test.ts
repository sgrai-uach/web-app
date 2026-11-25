import { describe, it, expect } from 'vitest';
import { rechazoMisionSchema } from './misiones';

describe('Validaciones de Misiones — rechazoMisionSchema (H41, H69)', () => {
  it('rechaza una justificación vacía o solo con espacios', () => {
    const resVacio = rechazoMisionSchema.safeParse({ justificacion_rechazo: '' });
    expect(resVacio.success).toBe(false);
    if (!resVacio.success) {
      expect(resVacio.error.issues[0]?.message).toContain('al menos 5 caracteres');
    }

    const resEspacios = rechazoMisionSchema.safeParse({ justificacion_rechazo: '     ' });
    expect(resEspacios.success).toBe(false);
  });

  it('rechaza una justificación con menos de 5 caracteres útiles tras trim (incluyendo 4 chars)', () => {
    const resCorto = rechazoMisionSchema.safeParse({ justificacion_rechazo: '  abc  ' });
    expect(resCorto.success).toBe(false);
    if (!resCorto.success) {
      expect(resCorto.error.issues[0]?.message).toContain('al menos 5 caracteres');
    }

    const resCuatro = rechazoMisionSchema.safeParse({ justificacion_rechazo: '1234' });
    expect(resCuatro.success).toBe(false);
  });

  it('acepta exactamente 5 caracteres válidos y recorta espacios', () => {
    const resCinco = rechazoMisionSchema.safeParse({ justificacion_rechazo: 'Falla' });
    expect(resCinco.success).toBe(true);
    if (resCinco.success) {
      expect(resCinco.data.justificacion_rechazo).toBe('Falla');
    }

    const resEspaciado = rechazoMisionSchema.safeParse({
      justificacion_rechazo: '  Falla hidráulica en camión tolva  ',
    });
    expect(resEspaciado.success).toBe(true);
    if (resEspaciado.success) {
      expect(resEspaciado.data.justificacion_rechazo).toBe('Falla hidráulica en camión tolva');
    }
  });

  it('acepta coordenadas GPS válidas cuando se entregan ambas', () => {
    const res = rechazoMisionSchema.safeParse({
      justificacion_rechazo: 'Camión con desperfecto mecánico',
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
