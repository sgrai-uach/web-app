import { z } from 'zod';

/**
 * Tipos MIME autorizados para evidencia multimedia en terreno (H43).
 * Alineado con el contrato de validación de sgrai-api.
 */
export const MIME_PERMITIDOS_IMAGEN = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const MIME_PERMITIDOS_VIDEO = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
] as const;

export const MIME_PERMITIDOS_DOCUMENTO = ['application/pdf'] as const;

export const MIME_PERMITIDOS_EVIDENCIA = [
  ...MIME_PERMITIDOS_IMAGEN,
  ...MIME_PERMITIDOS_VIDEO,
  ...MIME_PERMITIDOS_DOCUMENTO,
] as const;

export type MimePermitidoEvidencia = (typeof MIME_PERMITIDOS_EVIDENCIA)[number];

/**
 * Peso máximo permitido por archivo: 10 MB (10 * 1024 * 1024 bytes).
 */
export const MAX_BYTES_EVIDENCIA = 10 * 1024 * 1024;

export const evidenciaOutboxPayloadSchema = z
  .object({
    adjuntoLocalId: z.string().min(1, 'El identificador local del adjunto es obligatorio.'),
    misionId: z.string().min(1, 'El identificador de la misión es obligatorio.'),
    incidente_id: z.string().uuid('El incidente_id debe ser un UUID válido.').optional(),
    reporte_terreno_id: z
      .string()
      .uuid('El reporte_terreno_id debe ser un UUID válido.')
      .optional(),
    nombreArchivo: z
      .string()
      .trim()
      .min(1, 'El nombre del archivo es obligatorio.'),
    tipoMime: z.enum(MIME_PERMITIDOS_EVIDENCIA, {
      error:
        'Formato de archivo no permitido. Solo se aceptan imágenes (JPEG, PNG, WebP), videos (MP4, WebM, MOV) o documentos PDF.',
    }),
    tamanoBytes: z
      .number()
      .int('El tamaño debe ser un número entero en bytes.')
      .positive('El archivo no puede estar vacío.')
      .max(
        MAX_BYTES_EVIDENCIA,
        'El archivo excede el límite máximo permitido de 10 MB.'
      ),
    dataUrl: z.string().min(1, 'El contenido binario del archivo es obligatorio.'),
  })
  .refine((data) => Boolean(data.incidente_id || data.reporte_terreno_id), {
    message: 'Debe asociar la evidencia a un incidente o a un reporte de terreno.',
    path: ['incidente_id'],
  });

export type EvidenciaOutboxPayloadInput = z.infer<typeof evidenciaOutboxPayloadSchema>;
