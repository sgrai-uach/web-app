import { z } from 'zod';

export const reclasificarTipologiaSchema = z.object({
  tipoIncidenteId: z
    .string({ message: 'Debe seleccionar un tipo de incidente del catálogo oficial.' })
    .uuid({ message: 'El identificador del tipo de incidente debe ser un UUID válido.' }),
  justificacion: z
    .string({ message: 'La justificación del cambio de tipología es obligatoria.' })
    .trim()
    .min(5, { message: 'La justificación debe contener al menos 5 caracteres.' })
    .max(1000, { message: 'La justificación no puede exceder los 1000 caracteres.' }),
  misionId: z
    .string()
    .uuid({ message: 'El identificador de la misión debe ser un UUID válido.' })
    .optional(),
});

export type ReclasificarTipologiaInput = z.infer<typeof reclasificarTipologiaSchema>;

