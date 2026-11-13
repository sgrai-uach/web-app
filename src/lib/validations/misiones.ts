import { z } from 'zod';

/**
 * Esquema de validación para el rechazo motivado de misiones tácticas en terreno (H41, H69).
 * Cumple estrictamente con la Regla de Negocio Crítica §3.3:
 * Justificación obligatoria con un mínimo de 5 caracteres tras remover espacios circundantes.
 */
export const rechazoMisionSchema = z.object({
  justificacion_rechazo: z
    .string({
      error: 'La justificación de rechazo es obligatoria.',
    })
    .transform((val) => val.trim())
    .refine((val) => val.length >= 5, {
      message: 'La justificación de rechazo debe contener al menos 5 caracteres.',
    }),
  latitud: z.number().optional(),
  longitud: z.number().optional(),
});

export type RechazoMisionInput = z.infer<typeof rechazoMisionSchema>;

