import { z } from 'zod';
import type { ReporteVerificacionTerrenoForm } from '@/types/offline';

export const DICTAMENES_ATENCION = ['REQUIERE_CUADRILLA', 'NO_ABORDABLE'] as const;

export const ESTADOS_TERRENO_VERIFICACION = [
  'CRITICO',
  'ESTABLE',
  'INACCESIBLE',
  'CONTROLADO',
  'FINALIZADO',
] as const;

export const RESUMEN_TECNICO_MIN = 10;
export const MOTIVO_NO_ABORDABLE_MIN = 15;

export const VALORES_INICIALES_REPORTE_VERIFICACION: ReporteVerificacionTerrenoForm = {
  dictamen: 'REQUIERE_CUADRILLA',
  motivo_no_abordable: '',
  resumen_tecnico: '',
  estado_terreno: 'ESTABLE',
  personas_afectadas: 0,
  danos_estimados: '',
  observaciones: '',
  requiere_asistencia_social: false,
  adjuntoIds: [],
  adjuntos: [],
};

export const adjuntoReporteSchema = z.object({
  id: z.string().uuid('El identificador del adjunto debe ser un UUID válido.').optional(),
  nombreArchivo: z.string().max(255).optional(),
  url: z.string().max(500).optional(),
  tipoMime: z.string().max(100).optional(),
  tamanoBytes: z.number().int().nonnegative().optional(),
});

export const crearReporteVerificacionSchema = z
  .object({
    dictamen: z.enum(DICTAMENES_ATENCION, {
      message: "Seleccione un dictamen válido ('REQUIERE_CUADRILLA' o 'NO_ABORDABLE').",
    }),
    motivo_no_abordable: z
      .string()
      .trim()
      .max(2000, 'El motivo de no abordabilidad no puede exceder los 2000 caracteres.')
      .optional()
      .default(''),
    resumen_tecnico: z
      .string({
        message: 'El resumen técnico del siniestro es obligatorio.',
      })
      .trim()
      .min(
        RESUMEN_TECNICO_MIN,
        `El resumen técnico del siniestro es obligatorio y debe contener al menos ${RESUMEN_TECNICO_MIN} caracteres.`
      )
      .max(2000, 'El resumen técnico no puede exceder los 2000 caracteres.'),
    estado_terreno: z.enum(ESTADOS_TERRENO_VERIFICACION, {
      message: 'Seleccione un estado del terreno válido.',
    }),
    personas_afectadas: z
      .number({ message: 'La cantidad de personas afectadas debe ser un número entero.' })
      .int('La cantidad de personas afectadas debe ser un número entero.')
      .min(0, 'La cantidad de personas afectadas no puede ser negativa.')
      .max(5000, 'La cantidad de personas afectadas excede el límite permitido.'),
    danos_estimados: z
      .string()
      .trim()
      .max(2000, 'Los daños estimados no pueden exceder los 2000 caracteres.')
      .optional()
      .default(''),
    observaciones: z
      .string()
      .trim()
      .max(2000, 'Las observaciones no pueden exceder los 2000 caracteres.')
      .optional()
      .default(''),
    requiere_asistencia_social: z.boolean().default(false),
    adjuntoIds: z
      .array(z.string().uuid('Cada identificador de adjunto debe ser un UUID válido.'))
      .max(20, 'No se pueden vincular más de 20 adjuntos por reporte.')
      .optional()
      .default([]),
    adjuntos: z
      .array(adjuntoReporteSchema)
      .max(20, 'No se pueden adjuntar más de 20 archivos por reporte.')
      .optional()
      .default([]),
    latitud: z.number().finite().min(-90).max(90).optional(),
    longitud: z.number().finite().min(-180).max(180).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.dictamen === 'NO_ABORDABLE' &&
      (data.motivo_no_abordable?.trim().length ?? 0) < MOTIVO_NO_ABORDABLE_MIN
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['motivo_no_abordable'],
        message: `El motivo de no abordabilidad es obligatorio y debe contener al menos ${MOTIVO_NO_ABORDABLE_MIN} caracteres.`,
      });
    }
  });

export type CrearReporteVerificacionInput = z.input<typeof crearReporteVerificacionSchema>;
export type CrearReporteVerificacionValidado = z.output<typeof crearReporteVerificacionSchema>;
