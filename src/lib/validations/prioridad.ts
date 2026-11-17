import { z } from 'zod';
import type {
  EvaluacionTerrenoPrioridadForm,
  NivelCompromisoVivienda,
  PrioridadIncidente,
} from '@/types/offline';

export const PRIORIDADES_CANONICAS = [
  'BAJA',
  'MEDIA',
  'ALTA',
  'CRITICA',
] as const;

export const NIVELES_COMPROMISO_VIVIENDA = [
  'SIN_DANO',
  'LEVE',
  'MODERADO',
  'GRAVE_INHABITABLE',
] as const;

export const VALORES_INICIALES_EVALUACION_PRIORIDAD: EvaluacionTerrenoPrioridadForm = {
  familias: [
    {
      id: 'fam-1',
      referencia: '',
      nucleoFamiliarTotal: 0,
      cantidadNinos: 0,
      cantidadAdultosMayores: 0,
      personasDiscapacitadas: 0,
      personasElectrodependientes: 0,
      mascotasAfectadas: 0,
      nivelCompromisoVivienda: 'SIN_DANO',
      requiereAsistenciaSocial: false,
    },
  ],
  nucleoFamiliarTotal: 0,
  cantidadNinos: 0,
  cantidadAdultosMayores: 0,
  personasDiscapacitadas: 0,
  personasElectrodependientes: 0,
  mascotasAfectadas: 0,
  viviendasAfectadas: 1,
  nivelCompromisoVivienda: 'SIN_DANO',
  riesgoElectrico: false,
  riesgoEstructural: false,
  riesgoQuimicoSanitario: false,
  aislamientoVial: false,
  requiereEvacuacion: false,
  requiereAsistenciaSocial: false,
  requiereApoyoAdicional: false,
  detallesAdicionales: '',
};

const contadorEnteroSchema = z
  .number({ message: 'Debe ser un número válido.' })
  .int({ message: 'Debe ser un número entero.' })
  .min(0, { message: 'El valor no puede ser negativo.' })
  .max(999, { message: 'El valor excede el límite permitido.' });

export interface ContadoresFamiliaLimites {
  nucleoFamiliarTotal: number;
  cantidadNinos: number;
  cantidadAdultosMayores: number;
  personasDiscapacitadas: number;
  personasElectrodependientes: number;
}

/**
 * Calcula los límites derivados del tamaño del núcleo familiar para evitar
 * registrar más integrantes que el total declarado de la familia.
 */
export function calcularLimitesFamilia(fam: ContadoresFamiliaLimites) {
  const totalEtarios = fam.cantidadNinos + fam.cantidadAdultosMayores;
  const minimoNucleo = Math.max(
    totalEtarios,
    fam.personasDiscapacitadas,
    fam.personasElectrodependientes
  );

  return {
    totalEtarios,
    minimoNucleo,
    cupoEtarioDisponible: Math.max(0, fam.nucleoFamiliarTotal - totalEtarios),
  };
}

function validarLimitesNucleoFamiliar(
  data: ContadoresFamiliaLimites,
  ctx: z.RefinementCtx
) {
  if (data.cantidadNinos + data.cantidadAdultosMayores > data.nucleoFamiliarTotal) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'La suma de niños y adultos mayores no puede superar el tamaño del núcleo familiar.',
      path: ['cantidadNinos'],
    });
  }
  if (data.personasDiscapacitadas > data.nucleoFamiliarTotal) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'Las personas con discapacidad no pueden superar el tamaño del núcleo familiar.',
      path: ['personasDiscapacitadas'],
    });
  }
  if (data.personasElectrodependientes > data.nucleoFamiliarTotal) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'Las personas electrodependientes no pueden superar el tamaño del núcleo familiar.',
      path: ['personasElectrodependientes'],
    });
  }
}

export const familiaAfectadaSchema = z
  .object({
    id: z.string().default(() => Math.random().toString(36).substring(2, 9)),
    referencia: z.string().trim().max(100).optional().default(''),
    nucleoFamiliarTotal: contadorEnteroSchema,
    cantidadNinos: contadorEnteroSchema,
    cantidadAdultosMayores: contadorEnteroSchema,
    personasDiscapacitadas: contadorEnteroSchema,
    personasElectrodependientes: contadorEnteroSchema,
    mascotasAfectadas: contadorEnteroSchema,
    nivelCompromisoVivienda: z.enum(NIVELES_COMPROMISO_VIVIENDA),
    requiereAsistenciaSocial: z.boolean().default(false),
  })
  .superRefine(validarLimitesNucleoFamiliar);

const evaluacionTerrenoBaseSchema = z.object({
  familias: z.array(familiaAfectadaSchema).optional().default([]),
  nucleoFamiliarTotal: contadorEnteroSchema,
  cantidadNinos: contadorEnteroSchema,
  cantidadAdultosMayores: contadorEnteroSchema,
  personasDiscapacitadas: contadorEnteroSchema,
  personasElectrodependientes: contadorEnteroSchema,
  mascotasAfectadas: contadorEnteroSchema,
  viviendasAfectadas: contadorEnteroSchema,
  nivelCompromisoVivienda: z.enum(NIVELES_COMPROMISO_VIVIENDA, {
    message: 'Seleccione un nivel de compromiso de vivienda válido.',
  }),
  riesgoElectrico: z.boolean(),
  riesgoEstructural: z.boolean(),
  riesgoQuimicoSanitario: z.boolean(),
  aislamientoVial: z.boolean(),
  requiereEvacuacion: z.boolean(),
  requiereAsistenciaSocial: z.boolean(),
  requiereApoyoAdicional: z.boolean().optional().default(false),
  detallesAdicionales: z
    .string()
    .trim()
    .max(1000, { message: 'Los detalles adicionales no pueden exceder los 1000 caracteres.' })
    .optional()
    .default(''),
});

export const evaluacionTerrenoSchema = evaluacionTerrenoBaseSchema.superRefine(
  validarLimitesNucleoFamiliar
);

export const asignarPrioridadSchema = evaluacionTerrenoBaseSchema
  .extend({
    prioridad: z.enum(PRIORIDADES_CANONICAS, {
      message: 'Seleccione un nivel de prioridad canónico válido (BAJA, MEDIA, ALTA o CRITICA).',
    }),
    prioridadSugerida: z.enum(PRIORIDADES_CANONICAS, {
      message: 'La prioridad sugerida debe ser un nivel canónico válido.',
    }),
    justificacionPrioridad: z
      .string()
      .trim()
      .max(1000, { message: 'La justificación no puede exceder los 1000 caracteres.' })
      .optional()
      .default(''),
    factoresGatillantes: z.array(z.string()).optional().default([]),
    misionId: z
      .string()
      .uuid({ message: 'El identificador de la misión debe ser un UUID válido.' })
      .optional(),
    versionReporte: z.number().int().min(1).optional().default(1),
  })
  .superRefine(validarLimitesNucleoFamiliar)
  .refine(
    (data) => {
      if (data.prioridad === data.prioridadSugerida) {
        return true;
      }
      return (data.justificacionPrioridad?.trim().length ?? 0) >= 5;
    },
    {
      message:
        'La justificación técnica es obligatoria y debe contener al menos 5 caracteres al modificar la prioridad sugerida.',
      path: ['justificacionPrioridad'],
    }
  );

export type AsignarPrioridadInput = z.input<typeof asignarPrioridadSchema>;
export type AsignarPrioridadValidado = z.output<typeof asignarPrioridadSchema>;

export interface ResultadoCalculoPrioridad {
  prioridadSugerida: PrioridadIncidente;
  factoresGatillantes: string[];
}

export function consolidarEvaluacionFamilias(
  evaluacion: EvaluacionTerrenoPrioridadForm
): EvaluacionTerrenoPrioridadForm {
  if (!evaluacion.familias || evaluacion.familias.length === 0) {
    return evaluacion;
  }

  let totalPersonas = 0;
  let totalNinos = 0;
  let totalAdultosMayores = 0;
  let totalDiscapacitados = 0;
  let totalElectrodependientes = 0;
  let totalMascotas = 0;
  let requiereFibeGlobal = evaluacion.requiereAsistenciaSocial;

  const ordenCompromiso: Record<NivelCompromisoVivienda, number> = {
    SIN_DANO: 0,
    LEVE: 1,
    MODERADO: 2,
    GRAVE_INHABITABLE: 3,
  };
  let maxCompromiso: NivelCompromisoVivienda = 'SIN_DANO';

  for (const fam of evaluacion.familias) {
    totalPersonas += fam.nucleoFamiliarTotal;
    totalNinos += fam.cantidadNinos;
    totalAdultosMayores += fam.cantidadAdultosMayores;
    totalDiscapacitados += fam.personasDiscapacitadas;
    totalElectrodependientes += fam.personasElectrodependientes;
    totalMascotas += fam.mascotasAfectadas;
    if (fam.requiereAsistenciaSocial) {
      requiereFibeGlobal = true;
    }
    if (ordenCompromiso[fam.nivelCompromisoVivienda] > ordenCompromiso[maxCompromiso]) {
      maxCompromiso = fam.nivelCompromisoVivienda;
    }
  }

  return {
    ...evaluacion,
    nucleoFamiliarTotal: totalPersonas,
    cantidadNinos: totalNinos,
    cantidadAdultosMayores: totalAdultosMayores,
    personasDiscapacitadas: totalDiscapacitados,
    personasElectrodependientes: totalElectrodependientes,
    mascotasAfectadas: totalMascotas,
    viviendasAfectadas: evaluacion.familias.length,
    nivelCompromisoVivienda: maxCompromiso,
    requiereAsistenciaSocial: requiereFibeGlobal,
  };
}

/**
 * Calcula en vivo la prioridad sugerida y sus factores gatillantes a partir
 * de los datos constatados por la Patrulla Verificadora en terreno (HU-38),
 * homologado 1:1 con `sgrai-api` (`prioridad.utils.ts`).
 */
export function calcularPrioridadSugerida(
  evaluacionRaw: EvaluacionTerrenoPrioridadForm
): ResultadoCalculoPrioridad {
  const evaluacion = consolidarEvaluacionFamilias(evaluacionRaw);
  let puntajeTotal = 0;
  const factoresGatillantes: string[] = [];
  let forzarCritica = false;

  // 1. Tamaño del núcleo familiar afectado
  if (evaluacion.nucleoFamiliarTotal >= 8) {
    puntajeTotal += 20;
    factoresGatillantes.push(
      `Núcleo familiar numeroso afectado: ${evaluacion.nucleoFamiliarTotal} personas (+20 pts)`
    );
  } else if (evaluacion.nucleoFamiliarTotal >= 4) {
    puntajeTotal += 12;
    factoresGatillantes.push(
      `Núcleo familiar afectado: ${evaluacion.nucleoFamiliarTotal} personas (+12 pts)`
    );
  } else if (evaluacion.nucleoFamiliarTotal >= 1) {
    puntajeTotal += 5;
    factoresGatillantes.push(
      `Personas afectadas en el núcleo: ${evaluacion.nucleoFamiliarTotal} (+5 pts)`
    );
  }

  // 2. Niños, niñas y adolescentes (< 14 años)
  if (evaluacion.cantidadNinos > 0) {
    const ptsNinos = Math.min(24, evaluacion.cantidadNinos * 6);
    puntajeTotal += ptsNinos;
    factoresGatillantes.push(`Niños afectados: ${evaluacion.cantidadNinos} (+${ptsNinos} pts)`);
  }

  // 3. Adultos mayores (>= 65 años)
  if (evaluacion.cantidadAdultosMayores > 0) {
    const ptsMayores = Math.min(28, evaluacion.cantidadAdultosMayores * 7);
    puntajeTotal += ptsMayores;
    factoresGatillantes.push(
      `Adultos mayores afectados: ${evaluacion.cantidadAdultosMayores} (+${ptsMayores} pts)`
    );
  }

  // 4. Personas con discapacidad o movilidad reducida
  if (evaluacion.personasDiscapacitadas > 0) {
    const ptsDiscapacidad = Math.min(36, evaluacion.personasDiscapacitadas * 12);
    puntajeTotal += ptsDiscapacidad;
    factoresGatillantes.push(
      `Personas con discapacidad o movilidad reducida: ${evaluacion.personasDiscapacitadas} (+${ptsDiscapacidad} pts)`
    );
  }

  // 5. Personas electrodependientes (Disparo directo a CRITICA)
  if (evaluacion.personasElectrodependientes > 0) {
    const ptsElectro = evaluacion.personasElectrodependientes * 50;
    puntajeTotal += ptsElectro;
    forzarCritica = true;
    factoresGatillantes.push(
      `Pacientes electrodependientes en riesgo vital: ${evaluacion.personasElectrodependientes} (+${ptsElectro} pts — Prioridad CRÍTICA directa)`
    );
  }

  // 6. Mascotas o animales afectados
  if (evaluacion.mascotasAfectadas >= 4) {
    const ptsMascotas = Math.min(10, 5 + (evaluacion.mascotasAfectadas - 4));
    puntajeTotal += ptsMascotas;
    factoresGatillantes.push(
      `Mascotas/animales afectados: ${evaluacion.mascotasAfectadas} (+${ptsMascotas} pts)`
    );
  } else if (evaluacion.mascotasAfectadas >= 1) {
    const ptsMascotas = evaluacion.mascotasAfectadas * 2;
    puntajeTotal += ptsMascotas;
    factoresGatillantes.push(
      `Mascotas afectadas: ${evaluacion.mascotasAfectadas} (+${ptsMascotas} pts)`
    );
  }

  // 7. Nivel de compromiso habitacional y cantidad de viviendas
  if (evaluacion.nivelCompromisoVivienda === 'GRAVE_INHABITABLE') {
    puntajeTotal += 45;
    factoresGatillantes.push('Compromiso de vivienda GRAVE / INHABITABLE (+45 pts)');
  } else if (evaluacion.nivelCompromisoVivienda === 'MODERADO') {
    puntajeTotal += 22;
    factoresGatillantes.push('Compromiso de vivienda MODERADO (+22 pts)');
  } else if (evaluacion.nivelCompromisoVivienda === 'LEVE') {
    puntajeTotal += 8;
    factoresGatillantes.push('Compromiso de vivienda LEVE (+8 pts)');
  }

  if (evaluacion.viviendasAfectadas >= 6) {
    puntajeTotal += 20;
    factoresGatillantes.push(
      `Afectación multi-vivienda severa: ${evaluacion.viviendasAfectadas} inmuebles (+20 pts)`
    );
  } else if (evaluacion.viviendasAfectadas >= 3) {
    puntajeTotal += 10;
    factoresGatillantes.push(
      `Múltiples viviendas afectadas: ${evaluacion.viviendasAfectadas} inmuebles (+10 pts)`
    );
  }

  // 8. Evacuación y riesgos activos en el sitio
  if (evaluacion.requiereEvacuacion) {
    puntajeTotal += 35;
    factoresGatillantes.push('Requiere evacuación inmediata de residentes (+35 pts)');
    if (
      evaluacion.personasDiscapacitadas > 0 ||
      evaluacion.cantidadAdultosMayores > 0 ||
      evaluacion.cantidadNinos > 0 ||
      evaluacion.nivelCompromisoVivienda === 'GRAVE_INHABITABLE'
    ) {
      forzarCritica = true;
    }
  }

  if (evaluacion.riesgoEstructural) {
    puntajeTotal += 25;
    factoresGatillantes.push('Riesgo estructural / peligro de colapso activo (+25 pts)');
  }
  if (evaluacion.riesgoElectrico) {
    puntajeTotal += 20;
    factoresGatillantes.push('Riesgo eléctrico activo en el lugar (+20 pts)');
  }
  if (evaluacion.riesgoQuimicoSanitario) {
    puntajeTotal += 15;
    factoresGatillantes.push('Riesgo químico o sanitario activo (+15 pts)');
  }
  if (evaluacion.aislamientoVial) {
    puntajeTotal += 15;
    factoresGatillantes.push('Aislamiento vial / bloqueo de accesos (+15 pts)');
  }

  if (factoresGatillantes.length === 0) {
    factoresGatillantes.push(
      'Sin afectación humana directa ni riesgos críticos detectados (0 pts)'
    );
  }

  let prioridadSugerida: PrioridadIncidente;
  if (forzarCritica || puntajeTotal >= 60) {
    prioridadSugerida = 'CRITICA';
  } else if (puntajeTotal >= 35) {
    prioridadSugerida = 'ALTA';
  } else if (puntajeTotal >= 15) {
    prioridadSugerida = 'MEDIA';
  } else {
    prioridadSugerida = 'BAJA';
  }

  return {
    prioridadSugerida,
    factoresGatillantes,
  };
}

