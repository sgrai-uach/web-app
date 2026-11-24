import { describe, it, expect } from 'vitest';
import {
  DETALLE_APOYO_MIN,
  TEXTAREA_MAX,
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
      requiereCuadrillaAdicional: false,
      detalleApoyoRequerido:
        'Se solicita motoniveladora y cuadrilla adicional de despeje',
      resumenTecnico: 'Árbol caído obstruye dos pistas',
    });
  });

  it('acepta requiereCuadrillaAdicional=true y alinea TEXTAREA_MAX a 1000 caracteres', () => {
    expect(TEXTAREA_MAX).toBe(1000);
    const payload = validarPayloadSolicitudApoyo({
      requiereApoyoAdicional: true,
      requiereCuadrillaAdicional: true,
      detalleApoyoRequerido: 'Se requiere segunda cuadrilla forestal',
    });
    expect(payload.requiereCuadrillaAdicional).toBe(true);

    const excedido = solicitudApoyoSchema.safeParse({
      requiereApoyoAdicional: true,
      requiereCuadrillaAdicional: true,
      detalleApoyoRequerido: 'a'.repeat(1001),
    });
    expect(excedido.success).toBe(false);
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
