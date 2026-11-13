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

export const familiaAfectadaSchema = z.object({
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
});

export const evaluacionTerrenoSchema = z.object({
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

export const asignarPrioridadSchema = evaluacionTerrenoSchema
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

  // Si solo hay 1 familia pero los contadores globales en la raíz son mayores (ej: llamadas directas o fixtures con ...VALORES_INICIALES),
  // respetamos los valores globales y los reflejamos en la familia.
  const soloUnaFamilia = evaluacion.familias.length === 1;
  const f0 = evaluacion.familias[0];
  const sumaFamilias =
    f0.nucleoFamiliarTotal +
    f0.cantidadNinos +
    f0.cantidadAdultosMayores +
    f0.personasDiscapacitadas +
    f0.personasElectrodependientes +
    f0.mascotasAfectadas;
  const sumaGlobal =
    (evaluacion.nucleoFamiliarTotal || 0) +
    (evaluacion.cantidadNinos || 0) +
    (evaluacion.cantidadAdultosMayores || 0) +
    (evaluacion.personasDiscapacitadas || 0) +
    (evaluacion.personasElectrodependientes || 0) +
    (evaluacion.mascotasAfectadas || 0);

  if (soloUnaFamilia && sumaGlobal > sumaFamilias) {
    return {
      ...evaluacion,
      familias: [
        {
          ...f0,
          nucleoFamiliarTotal: evaluacion.nucleoFamiliarTotal,
          cantidadNinos: evaluacion.cantidadNinos,
          cantidadAdultosMayores: evaluacion.cantidadAdultosMayores,
          personasDiscapacitadas: evaluacion.personasDiscapacitadas,
          personasElectrodependientes: evaluacion.personasElectrodependientes,
          mascotasAfectadas: evaluacion.mascotasAfectadas,
          nivelCompromisoVivienda: evaluacion.nivelCompromisoVivienda,
          requiereAsistenciaSocial: evaluacion.requiereAsistenciaSocial,
        },
      ],
    };
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
 * de los datos constatados por la Patrulla Verificadora en terreno (HU-38).
 */
export function calcularPrioridadSugerida(
  evaluacionRaw: EvaluacionTerrenoPrioridadForm
): ResultadoCalculoPrioridad {
  const evaluacion = consolidarEvaluacionFamilias(evaluacionRaw);
  const factoresCriticos: string[] = [];
  const factoresAltos: string[] = [];
  const factoresMedios: string[] = [];

  // 1. Factores de nivel CRÍTICO
  if (evaluacion.personasElectrodependientes > 0) {
    factoresCriticos.push(
      `Personas electrodependientes afectadas (${evaluacion.personasElectrodependientes})`
    );
  }
  if (evaluacion.requiereEvacuacion) {
    factoresCriticos.push('Requiere evacuación inmediata del sector');
  }
  if (evaluacion.nivelCompromisoVivienda === 'GRAVE_INHABITABLE') {
    factoresCriticos.push('Vivienda con daño grave o inhabitable');
  }
  if (evaluacion.riesgoElectrico) {
    factoresCriticos.push('Peligro eléctrico activo en terreno');
  }
  if (evaluacion.riesgoEstructural) {
    factoresCriticos.push('Riesgo de colapso estructural o remoción');
  }
  if (evaluacion.riesgoQuimicoSanitario) {
    factoresCriticos.push('Peligro químico o sanitario activo');
  }

  // 2. Factores de nivel ALTO
  if (evaluacion.personasDiscapacitadas > 0) {
    factoresAltos.push(
      `Personas con discapacidad afectadas (${evaluacion.personasDiscapacitadas})`
    );
  }
  if (evaluacion.cantidadAdultosMayores > 0) {
    factoresAltos.push(
      `Adultos mayores afectados (${evaluacion.cantidadAdultosMayores})`
    );
  }
  if (evaluacion.cantidadNinos >= 2) {
    factoresAltos.push(`Múltiples niños afectados (${evaluacion.cantidadNinos})`);
  }
  if (evaluacion.aislamientoVial) {
    factoresAltos.push('Aislamiento vial o corte de ruta de acceso');
  }
  if (evaluacion.nivelCompromisoVivienda === 'MODERADO') {
    factoresAltos.push('Vivienda con compromiso estructural moderado');
  }
  if (evaluacion.viviendasAfectadas >= 3) {
    factoresAltos.push(
      `Múltiples viviendas afectadas (${evaluacion.viviendasAfectadas})`
    );
  }
  if (evaluacion.nucleoFamiliarTotal >= 6) {
    factoresAltos.push(
      `Núcleo familiar extenso afectado (${evaluacion.nucleoFamiliarTotal} integrantes)`
    );
  }

  // 3. Factores de nivel MEDIO
  if (evaluacion.cantidadNinos === 1) {
    factoresMedios.push('Presencia de 1 niño en el núcleo afectado');
  }
  if (evaluacion.nucleoFamiliarTotal > 0 && evaluacion.nucleoFamiliarTotal < 6) {
    factoresMedios.push(
      `Núcleo familiar afectado (${evaluacion.nucleoFamiliarTotal} personas)`
    );
  }
  const tieneDanoOCompromiso =
    evaluacion.nivelCompromisoVivienda !== 'SIN_DANO' ||
    evaluacion.nucleoFamiliarTotal > 0 ||
    evaluacion.personasElectrodependientes > 0 ||
    evaluacion.personasDiscapacitadas > 0 ||
    evaluacion.cantidadAdultosMayores > 0 ||
    evaluacion.cantidadNinos > 0;

  if (evaluacion.viviendasAfectadas > 0 && evaluacion.viviendasAfectadas < 3 && tieneDanoOCompromiso) {
    factoresMedios.push(
      `Viviendas afectadas (${evaluacion.viviendasAfectadas})`
    );
  }
  if (evaluacion.nivelCompromisoVivienda === 'LEVE') {
    factoresMedios.push('Vivienda con daño leve');
  }
  if (evaluacion.mascotasAfectadas > 0) {
    factoresMedios.push(`Mascotas afectadas (${evaluacion.mascotasAfectadas})`);
  }
  if (evaluacion.requiereAsistenciaSocial) {
    factoresMedios.push('Requiere levantamiento social (FIBE)');
  }

  const todosLosFactores = [
    ...factoresCriticos,
    ...factoresAltos,
    ...factoresMedios,
  ];

  if (factoresCriticos.length > 0) {
    return {
      prioridadSugerida: 'CRITICA',
      factoresGatillantes: todosLosFactores,
    };
  }

  if (factoresAltos.length > 0) {
    return {
      prioridadSugerida: 'ALTA',
      factoresGatillantes: todosLosFactores,
    };
  }

  if (factoresMedios.length > 0) {
    return {
      prioridadSugerida: 'MEDIA',
      factoresGatillantes: todosLosFactores,
    };
  }

  return {
    prioridadSugerida: 'BAJA',
    factoresGatillantes: [
      'Sin personas vulnerables, sin daños habitacionales ni peligros activos constatados',
    ],
  };
}

