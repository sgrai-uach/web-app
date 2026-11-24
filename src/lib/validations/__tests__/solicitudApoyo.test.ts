import { describe, it, expect } from 'vitest';
import {
  DETALLE_APOYO_MIN,
  VALORES_INICIALES_SOLICITUD_APOYO,
  solicitudApoyoSchema,
  validarPayloadSolicitudApoyo,
} from '../solicitudApoyo';

describe('solicitudApoyo (HU-44 Zod validations)', () => {
  it('rechaza cuando requiereApoyoAdicional es true y detalleApoyoRequerido está vacío o tiene menos de 5 caracteres', () => {
    const vacio = solicitudApoyoSchema.safeParse({
      ...VALORES_INICIALES_SOLICITUD_APOYO,
      requiereApoyoAdicional: true,
      detalleApoyoRequerido: '',
    });
    expect(vacio.success).toBe(false);
    if (!vacio.success) {
      expect(vacio.error.issues[0].path).toContain('detalleApoyoRequerido');
      expect(vacio.error.issues[0].message).toMatch(
        new RegExp(`${DETALLE_APOYO_MIN} caracteres`)
      );
    }

    const soloEspaciosYCorto = solicitudApoyoSchema.safeParse({
      requiereApoyoAdicional: true,
      detalleApoyoRequerido: '   abcd  ',
    });
    expect(soloEspaciosYCorto.success).toBe(false);
  });

  it('valida exitosamente cuando requiereApoyoAdicional es true y el detalle tiene >= 5 caracteres', () => {
    const payload = validarPayloadSolicitudApoyo({
      requiereApoyoAdicional: true,
      detalleApoyoRequerido:
        '  Se solicita motoniveladora y cuadrilla adicional de despeje  ',
      resumenTecnico: '  Árbol caído obstruye dos pistas  ',
      observaciones: '',
    });

    expect(payload).toEqual({
      requiereApoyoAdicional: true,
      detalleApoyoRequerido:
        'Se solicita motoniveladora y cuadrilla adicional de despeje',
      resumenTecnico: 'Árbol caído obstruye dos pistas',
    });
  });

  it('lanza error en validarPayloadSolicitudApoyo si la casilla no está marcada', () => {
    expect(() =>
      validarPayloadSolicitudApoyo({
        requiereApoyoAdicional: false,
        detalleApoyoRequerido: 'Detalle válido de prueba',
      })
    ).toThrow(/Requiere apoyo adicional/i);
  });
});
