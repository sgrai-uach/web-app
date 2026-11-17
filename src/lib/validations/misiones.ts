import { z } from 'zod';

/**
 * Esquema de validación para el rechazo motivado de misiones tácticas en terreno (H41, H69).
 * Cumple estrictamente con la Regla de Negocio Crítica §3.3:
 * Justificación obligatoria con un mínimo de 5 caracteres útiles tras remover espacios circundantes.
 */
export const rechazoMisionSchema = z
  .object({
    justificacion_rechazo: z
      .string({
        error: 'La justificación de rechazo es obligatoria.',
      })
      .transform((val) => val.trim())
      .refine((val) => val.length >= 5, {
        message: 'La justificación de rechazo debe contener al menos 5 caracteres.',
      }),
    latitud: z
      .number()
      .finite('La latitud debe ser un número finito.')
      .min(-90, 'La latitud debe estar entre -90 y 90.')
      .max(90, 'La latitud debe estar entre -90 y 90.')
      .optional(),
    longitud: z
      .number()
      .finite('La longitud debe ser un número finito.')
      .min(-180, 'La longitud debe estar entre -180 y 180.')
      .max(180, 'La longitud debe estar entre -180 y 180.')
      .optional(),
  })
  .refine(
    (data) =>
      (data.latitud === undefined && data.longitud === undefined) ||
      (data.latitud !== undefined && data.longitud !== undefined),
    {
      message: 'Debe proporcionar tanto latitud como longitud si informa coordenadas GPS.',
      path: ['latitud'],
    }
  );

export type RechazoMisionInput = z.infer<typeof rechazoMisionSchema>;
