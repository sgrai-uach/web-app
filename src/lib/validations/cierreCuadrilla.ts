import { z } from 'zod';
import { adjuntoReporteSchema } from './reporteVerificacion';
import type { CierreMisionCuadrillaForm } from '@/types/offline';

export const ESTADOS_TERRENO_CUADRILLA = [
  'FINALIZADO',
  'CONTROLADO',
  'ESTABLE',
  'REQUIERE_SEGUIMIENTO',
  'CRITICO',
  'INACCESIBLE',
] as const;

export const RESUMEN_FAENAS_MIN = 15;
export const TEXTAREA_MAX = 2000;
export const HORAS_HOMBRE_MAX = 1000;

export const VALORES_INICIALES_CIERRE_CUADRILLA: CierreMisionCuadrillaForm = {
  resumen_faenas: '',
  horas_hombre: 1,
  estado_terreno: 'FINALIZADO',
  materiales_consumidos: [],
  danos_estimados: '',
  observaciones: '',
  requiere_apoyo_adicional: false,
  requiere_asistencia_social: false,
  adjunto_ids: [],
  adjuntos: [],
};

export const materialConsumidoSchema = z.object({
  recurso_id: z
    .string({ message: 'Seleccione un material o recurso válido.' })
    .uuid('Seleccione un material o recurso válido.'),
  cantidad: z
    .number({ message: 'La cantidad consumida debe ser un número positivo.' })
    .finite('La cantidad debe ser un valor numérico válido.')
    .positive('La cantidad consumida debe ser mayor a 0.'),
  unidad: z
    .string()
    .trim()
    .max(50, 'La unidad no puede superar los 50 caracteres.')
    .optional(),
  observacion: z
    .string()
    .trim()
    .max(300, 'La observación del material no puede superar los 300 caracteres.')
    .optional(),
});

export const cerrarMisionCuadrillaSchema = z
  .object({
    resumen_faenas: z
      .string({ message: 'El resumen de faenas ejecutadas es obligatorio.' })
      .trim()
      .min(
        RESUMEN_FAENAS_MIN,
        `El resumen de faenas debe contener al menos ${RESUMEN_FAENAS_MIN} caracteres.`
      )
      .max(
        TEXTAREA_MAX,
        `El resumen de faenas no puede superar los ${TEXTAREA_MAX} caracteres.`
      ),
    horas_hombre: z
      .number({ message: 'Las horas hombre son obligatorias.' })
      .finite('Las horas hombre deben ser un número válido.')
      .positive('Las horas hombre deben ser mayores a 0.')
      .max(
        HORAS_HOMBRE_MAX,
        `Las horas hombre no pueden superar las ${HORAS_HOMBRE_MAX} horas.`
      ),
    estado_terreno: z.enum(ESTADOS_TERRENO_CUADRILLA, {
      message: 'Seleccione un estado final del terreno válido.',
    }),
    materiales_consumidos: z
      .array(materialConsumidoSchema)
      .max(50, 'No se pueden registrar más de 50 materiales en un mismo informe.')
      .optional()
      .default([]),
    observaciones: z
      .string()
      .trim()
      .max(
        TEXTAREA_MAX,
        `Las observaciones no pueden superar los ${TEXTAREA_MAX} caracteres.`
      )
      .optional()
      .default(''),
    danos_estimados: z
      .string()
      .trim()
      .max(
        TEXTAREA_MAX,
        `Los daños estimados no pueden superar los ${TEXTAREA_MAX} caracteres.`
      )
      .optional()
      .default(''),
    requiere_apoyo_adicional: z.boolean().optional().default(false),
    requiere_asistencia_social: z.boolean().optional().default(false),
    adjunto_ids: z
      .array(
        z.string().uuid('Cada identificador de adjunto debe ser un UUID válido.')
      )
      .max(20, 'No se pueden vincular más de 20 adjuntos por informe.')
      .optional()
      .default([]),
    adjuntos: z
      .array(adjuntoReporteSchema)
      .max(20, 'No se pueden adjuntar más de 20 archivos por informe.')
      .optional()
      .default([]),
    latitud: z
      .number({ message: 'La latitud debe ser un valor numérico.' })
      .finite('La latitud debe ser un número finito.')
      .min(-90, 'La latitud debe estar entre -90 y 90 grados.')
      .max(90, 'La latitud debe estar entre -90 y 90 grados.')
      .optional(),
    longitud: z
      .number({ message: 'La longitud debe ser un valor numérico.' })
      .finite('La longitud debe ser un número finito.')
      .min(-180, 'La longitud debe estar entre -180 y 180 grados.')
      .max(180, 'La longitud debe estar entre -180 y 180 grados.')
      .optional(),
  })
  .superRefine((data, ctx) => {
    const tieneLat = data.latitud !== undefined;
    const tieneLng = data.longitud !== undefined;
    if (tieneLat !== tieneLng) {
      ctx.addIssue({
        code: 'custom',
        path: [tieneLat ? 'longitud' : 'latitud'],
        message: 'Debe proporcionar tanto latitud como longitud si informa coordenadas GPS.',
      });
    }

    const recursosVistos = new Set<string>();
    for (let i = 0; i < (data.materiales_consumidos?.length ?? 0); i++) {
      const item = data.materiales_consumidos![i];
      if (recursosVistos.has(item.recurso_id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['materiales_consumidos', i, 'recurso_id'],
          message: 'El material seleccionado ya fue agregado en otra fila.',
        });
      }
      recursosVistos.add(item.recurso_id);
    }
  });

export type CerrarMisionCuadrillaInput = z.input<typeof cerrarMisionCuadrillaSchema>;
export type CerrarMisionCuadrillaValidado = z.output<typeof cerrarMisionCuadrillaSchema>;
