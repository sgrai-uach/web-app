import { z } from 'zod';

export const reclasificarTipologiaSchema = z
  .object({
    tipoIncidenteId: z
      .string({ message: 'Debe seleccionar un tipo de incidente del catálogo oficial.' })
      .uuid({ message: 'El identificador del tipo de incidente debe ser un UUID válido.' }),
    justificacion: z
      .string()
      .trim()
      .max(1000, { message: 'La justificación no puede exceder los 1000 caracteres.' })
      .optional()
      .default(''),
    misionId: z
      .string()
      .uuid({ message: 'El identificador de la misión debe ser un UUID válido.' })
      .optional(),
    esCambio: z.boolean().optional(),
  })
  .refine(
    (data) => {
      // Si es ratificación explícita sin cambio de tipología, la justificación es opcional
      if (data.esCambio === false) {
        return true;
      }
      // Si es reclasificación o mutación estándar, debe contener al menos 5 caracteres
      return (data.justificacion?.length ?? 0) >= 5;
    },
    {
      message: 'La justificación debe contener al menos 5 caracteres.',
      path: ['justificacion'],
    }
  );

export type ReclasificarTipologiaInput = z.infer<typeof reclasificarTipologiaSchema>;


