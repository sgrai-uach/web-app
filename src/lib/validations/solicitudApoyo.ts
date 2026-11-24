import { z } from 'zod';
import type { SolicitarApoyoPayload, SolicitudApoyoCuadrillaForm } from '@/types/offline';

export const DETALLE_APOYO_MIN = 5;
export const TEXTAREA_MAX = 2000;

export const VALORES_INICIALES_SOLICITUD_APOYO: SolicitudApoyoCuadrillaForm = {
  requiereApoyoAdicional: false,
  detalleApoyoRequerido: '',
  resumenTecnico: '',
  observaciones: '',
};

export const solicitudApoyoSchema = z
  .object({
    requiereApoyoAdicional: z.boolean({
      message: 'Debe indicar si requiere apoyo adicional.',
    }),
    detalleApoyoRequerido: z
      .string({
        message: 'El detalle de apoyo requerido debe ser texto.',
      })
      .max(
        TEXTAREA_MAX,
        `El detalle de apoyo requerido no puede superar los ${TEXTAREA_MAX} caracteres.`
      )
      .optional()
      .default(''),
    resumenTecnico: z
      .string()
      .max(
        TEXTAREA_MAX,
        `El resumen técnico no puede superar los ${TEXTAREA_MAX} caracteres.`
      )
      .optional()
      .default(''),
    observaciones: z
      .string()
      .max(
        TEXTAREA_MAX,
        `Las observaciones no pueden superar los ${TEXTAREA_MAX} caracteres.`
      )
      .optional()
      .default(''),
  })
  .superRefine((data, ctx) => {
    const detalleLimpio = (data.detalleApoyoRequerido || '').trim();
    if (data.requiereApoyoAdicional && detalleLimpio.length < DETALLE_APOYO_MIN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['detalleApoyoRequerido'],
        message: `Debe especificar el detalle de apoyo requerido con al menos ${DETALLE_APOYO_MIN} caracteres.`,
      });
    }
  });

export type SolicitudApoyoInput = z.input<typeof solicitudApoyoSchema>;

/**
 * Valida y normaliza el payload de solicitud de apoyo adicional (HU-44)
 * contra el contrato OpenAPI antes de enviarlo por HTTP o encolarlo en IndexedDB.
 */
export function validarPayloadSolicitudApoyo(
  input: SolicitudApoyoInput
): SolicitarApoyoPayload {
  const parsed = solicitudApoyoSchema.parse(input);
  const detalleLimpio = (parsed.detalleApoyoRequerido || '').trim();
  const resumenLimpio = (parsed.resumenTecnico || '').trim();
  const observacionesLimpias = (parsed.observaciones || '').trim();

  if (!parsed.requiereApoyoAdicional) {
    throw new Error(
      'Debe marcar la casilla "Requiere apoyo adicional" antes de enviar la solicitud.'
    );
  }

  return {
    requiereApoyoAdicional: true,
    detalleApoyoRequerido: detalleLimpio,
    ...(resumenLimpio ? { resumenTecnico: resumenLimpio } : {}),
    ...(observacionesLimpias ? { observaciones: observacionesLimpias } : {}),
  };
}
