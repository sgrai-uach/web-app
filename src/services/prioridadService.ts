import apiClient from '@/lib/api/client';
import {
  encolarAccionOutbox,
  guardarMisionLocal,
} from '@/services/offlineQueue';
import {
  asignarPrioridadSchema,
  calcularPrioridadSugerida,
  VALORES_INICIALES_EVALUACION_PRIORIDAD,
  PRIORIDADES_CANONICAS,
  NIVELES_COMPROMISO_VIVIENDA,
  type AsignarPrioridadInput,
  type ResultadoCalculoPrioridad,
} from '@/lib/validations/prioridad';
import type {
  AsignarPrioridadPayload,
  CalcularPrioridadPayload,
  EvaluacionTerrenoPrioridadForm,
  MisionLocal,
  NivelCompromisoVivienda,
  PrioridadIncidente,
  ReportePrioridadTerrenoLocal,
} from '@/types/offline';

function esPrioridadValida(val: unknown): val is PrioridadIncidente {
  return (
    typeof val === 'string' &&
    (PRIORIDADES_CANONICAS as readonly string[]).includes(val.toUpperCase())
  );
}

function esNivelCompromisoValido(val: unknown): val is NivelCompromisoVivienda {
  return (
    typeof val === 'string' &&
    (NIVELES_COMPROMISO_VIVIENDA as readonly string[]).includes(val.toUpperCase())
  );
}

function extraerMensajeError(errorBody: unknown, fallback: string): string {
  if (
    typeof errorBody === 'object' &&
    errorBody !== null &&
    'message' in errorBody &&
    typeof (errorBody as { message?: unknown }).message === 'string'
  ) {
    return (errorBody as { message: string }).message;
  }
  return fallback;
}

function mapearReportesRemotos(
  remotos: unknown[],
  mision: MisionLocal
): ReportePrioridadTerrenoLocal[] {
  const mapeados: ReportePrioridadTerrenoLocal[] = remotos.map((raw, idx) => {
    const r = (raw || {}) as Record<string, unknown>;
    const detalle =
      typeof r.detallesEvaluacion === 'object' && r.detallesEvaluacion !== null
        ? (r.detallesEvaluacion as Record<string, unknown>)
        : r;
    const riesgos =
      typeof detalle.riesgosActivos === 'object' && detalle.riesgosActivos !== null
        ? (detalle.riesgosActivos as Record<string, unknown>)
        : detalle;

    const version =
      typeof r.versionReporte === 'number' && r.versionReporte > 0
        ? r.versionReporte
        : idx + 1;

    const familiasRaw = Array.isArray(detalle.familias)
      ? detalle.familias
      : Array.isArray(r.familias)
        ? r.familias
        : null;

    const familiasCargadas =
      familiasRaw && familiasRaw.length > 0
        ? (familiasRaw as Record<string, unknown>[]).map((f, fIdx) => ({
            id: typeof f.id === 'string' ? f.id : `fam-${fIdx + 1}`,
            referencia: typeof f.referencia === 'string' ? f.referencia : '',
            nucleoFamiliarTotal: Number(f.nucleoFamiliarTotal ?? f.personasAfectadas ?? 0),
            cantidadNinos: Number(f.cantidadNinos ?? 0),
            cantidadAdultosMayores: Number(f.cantidadAdultosMayores ?? 0),
            personasDiscapacitadas: Number(f.personasDiscapacitadas ?? 0),
            personasElectrodependientes: Number(f.personasElectrodependientes ?? 0),
            mascotasAfectadas: Number(f.mascotasAfectadas ?? 0),
            nivelCompromisoVivienda: esNivelCompromisoValido(f.nivelCompromisoVivienda)
              ? (String(f.nivelCompromisoVivienda).toUpperCase() as NivelCompromisoVivienda)
              : 'SIN_DANO',
            requiereAsistenciaSocial: Boolean(f.requiereAsistenciaSocial),
          }))
        : [
            {
              id: 'fam-1',
              referencia: '',
              nucleoFamiliarTotal:
                typeof detalle.nucleoFamiliarTotal === 'number'
                  ? detalle.nucleoFamiliarTotal
                  : typeof detalle.personasAfectadas === 'number'
                    ? detalle.personasAfectadas
                    : VALORES_INICIALES_EVALUACION_PRIORIDAD.nucleoFamiliarTotal,
              cantidadNinos:
                typeof detalle.cantidadNinos === 'number'
                  ? detalle.cantidadNinos
                  : VALORES_INICIALES_EVALUACION_PRIORIDAD.cantidadNinos,
              cantidadAdultosMayores:
                typeof detalle.cantidadAdultosMayores === 'number'
                  ? detalle.cantidadAdultosMayores
                  : VALORES_INICIALES_EVALUACION_PRIORIDAD.cantidadAdultosMayores,
              personasDiscapacitadas:
                typeof detalle.personasDiscapacitadas === 'number'
                  ? detalle.personasDiscapacitadas
                  : VALORES_INICIALES_EVALUACION_PRIORIDAD.personasDiscapacitadas,
              personasElectrodependientes:
                typeof detalle.personasElectrodependientes === 'number'
                  ? detalle.personasElectrodependientes
                  : VALORES_INICIALES_EVALUACION_PRIORIDAD.personasElectrodependientes,
              mascotasAfectadas:
                typeof detalle.mascotasAfectadas === 'number'
                  ? detalle.mascotasAfectadas
                  : VALORES_INICIALES_EVALUACION_PRIORIDAD.mascotasAfectadas,
              nivelCompromisoVivienda: esNivelCompromisoValido(
                detalle.nivelCompromisoVivienda
              )
                ? (String(
                    detalle.nivelCompromisoVivienda
                  ).toUpperCase() as NivelCompromisoVivienda)
                : VALORES_INICIALES_EVALUACION_PRIORIDAD.nivelCompromisoVivienda,
              requiereAsistenciaSocial: Boolean(detalle.requiereAsistenciaSocial),
            },
          ];

    const evalBase: EvaluacionTerrenoPrioridadForm = {
      familias: familiasCargadas,
      nucleoFamiliarTotal:
        typeof detalle.nucleoFamiliarTotal === 'number'
          ? detalle.nucleoFamiliarTotal
          : typeof detalle.personasAfectadas === 'number'
            ? detalle.personasAfectadas
            : VALORES_INICIALES_EVALUACION_PRIORIDAD.nucleoFamiliarTotal,
      cantidadNinos:
        typeof detalle.cantidadNinos === 'number'
          ? detalle.cantidadNinos
          : VALORES_INICIALES_EVALUACION_PRIORIDAD.cantidadNinos,
      cantidadAdultosMayores:
        typeof detalle.cantidadAdultosMayores === 'number'
          ? detalle.cantidadAdultosMayores
          : VALORES_INICIALES_EVALUACION_PRIORIDAD.cantidadAdultosMayores,
      personasDiscapacitadas:
        typeof detalle.personasDiscapacitadas === 'number'
          ? detalle.personasDiscapacitadas
          : VALORES_INICIALES_EVALUACION_PRIORIDAD.personasDiscapacitadas,
      personasElectrodependientes:
        typeof detalle.personasElectrodependientes === 'number'
          ? detalle.personasElectrodependientes
          : VALORES_INICIALES_EVALUACION_PRIORIDAD.personasElectrodependientes,
      mascotasAfectadas:
        typeof detalle.mascotasAfectadas === 'number'
          ? detalle.mascotasAfectadas
          : VALORES_INICIALES_EVALUACION_PRIORIDAD.mascotasAfectadas,
      viviendasAfectadas:
        typeof detalle.viviendasAfectadas === 'number'
          ? detalle.viviendasAfectadas
          : VALORES_INICIALES_EVALUACION_PRIORIDAD.viviendasAfectadas,
      nivelCompromisoVivienda: esNivelCompromisoValido(detalle.nivelCompromisoVivienda)
        ? (String(
            detalle.nivelCompromisoVivienda
          ).toUpperCase() as NivelCompromisoVivienda)
        : VALORES_INICIALES_EVALUACION_PRIORIDAD.nivelCompromisoVivienda,
      riesgoElectrico: Boolean(riesgos.riesgoElectrico ?? detalle.riesgoElectrico),
      riesgoEstructural: Boolean(riesgos.riesgoEstructural ?? detalle.riesgoEstructural),
      riesgoQuimicoSanitario: Boolean(
        riesgos.riesgoQuimicoSanitario ?? detalle.riesgoQuimicoSanitario
      ),
      aislamientoVial: Boolean(riesgos.aislamientoVial ?? detalle.aislamientoVial),
      requiereEvacuacion: Boolean(detalle.requiereEvacuacion),
      requiereAsistenciaSocial: Boolean(detalle.requiereAsistenciaSocial),
      requiereApoyoAdicional: Boolean(detalle.requiereApoyoAdicional),
      detallesAdicionales:
        typeof detalle.detallesAdicionales === 'string'
          ? detalle.detallesAdicionales
          : typeof r.observaciones === 'string'
            ? r.observaciones
            : '',
    };

    const calculoBase = calcularPrioridadSugerida(evalBase);
    const prioSugerida = esPrioridadValida(r.prioridadSugerida)
      ? (r.prioridadSugerida.toUpperCase() as PrioridadIncidente)
      : calculoBase.prioridadSugerida;
    const prioAsignada = esPrioridadValida(r.prioridadAsignada || r.prioridad)
      ? (String(r.prioridadAsignada || r.prioridad).toUpperCase() as PrioridadIncidente)
      : esPrioridadValida(mision.prioridad)
        ? (mision.prioridad.toUpperCase() as PrioridadIncidente)
        : prioSugerida;

    return {
      id: typeof r.id === 'string' ? r.id : undefined,
      versionReporte: version,
      evaluacion: evalBase,
      prioridadSugerida: prioSugerida,
      prioridadAsignada: prioAsignada,
      factoresGatillantes: Array.isArray(r.factoresGatillantes)
        ? (r.factoresGatillantes as string[])
        : calculoBase.factoresGatillantes,
      justificacionPrioridad:
        typeof r.justificacionPrioridad === 'string'
          ? r.justificacionPrioridad
          : typeof detalle.justificacionPrioridad === 'string'
            ? detalle.justificacionPrioridad
            : '',
      creadoEn:
        typeof r.creadoEn === 'string' ? r.creadoEn : new Date().toISOString(),
      sincronizado: true,
    };
  });

  return mapeados.sort((a, b) => a.versionReporte - b.versionReporte);
}

/**
 * Extrae el historial de reportes de evaluación de prioridad desde `mision.datosAdicionales`.
 * Prioriza `reportesTerreno` sincronizados desde la API cuando no hay mutaciones pendientes.
 */
export function obtenerReportesPrioridadMision(
  mision?: MisionLocal | null
): ReportePrioridadTerrenoLocal[] {
  if (!mision?.datosAdicionales) return [];

  const locales = mision.datosAdicionales.reportesPrioridad;
  const remotos = mision.datosAdicionales.reportesTerreno;

  if (!mision.sincronizacionPendiente && Array.isArray(remotos) && remotos.length > 0) {
    return mapearReportesRemotos(remotos, mision);
  }

  if (Array.isArray(locales) && locales.length > 0) {
    return [...(locales as ReportePrioridadTerrenoLocal[])].sort(
      (a, b) => a.versionReporte - b.versionReporte
    );
  }

  if (Array.isArray(remotos) && remotos.length > 0) {
    return mapearReportesRemotos(remotos, mision);
  }

  return [];
}

/**
 * Obtiene el último reporte de evaluación de prioridad (aquel con `versionReporte` más alto).
 */
export function obtenerUltimoReportePrioridad(
  mision?: MisionLocal | null
): ReportePrioridadTerrenoLocal | null {
  const lista = obtenerReportesPrioridadMision(mision);
  if (lista.length === 0) return null;
  return lista[lista.length - 1] || null;
}

/**
 * Calcula la prioridad sugerida y sus factores gatillantes (HU-38).
 * Ejecuta primero el motor determinista local y, si hay conexión, consulta
 * `POST /api/incidentes/{id}/prioridad/calcular` vía `apiClient`.
 */
export async function solicitarCalculoPrioridad(
  incidenteId: string,
  evaluacion: EvaluacionTerrenoPrioridadForm
): Promise<ResultadoCalculoPrioridad> {
  const resultadoLocal = calcularPrioridadSugerida(evaluacion);
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  if (!isOnline || !incidenteId) {
    return resultadoLocal;
  }

  try {
    const { data, error } = await apiClient.POST(
      '/api/incidentes/{id}/prioridad/calcular',
      {
        params: { path: { id: incidenteId } },
        body: evaluacion as unknown as CalcularPrioridadPayload,
      }
    );

    if (!error && data?.data) {
      const prioRaw = data.data.prioridadSugerida;
      const factoresRaw = data.data.factoresGatillantes;

      if (esPrioridadValida(prioRaw)) {
        return {
          prioridadSugerida: prioRaw.toUpperCase() as PrioridadIncidente,
          factoresGatillantes:
            Array.isArray(factoresRaw) && factoresRaw.length > 0
              ? factoresRaw
              : resultadoLocal.factoresGatillantes,
        };
      }
    }
  } catch {
    // Usar cálculo local determinista si el endpoint remoto no responde o falla la red
  }

  return resultadoLocal;
}

export interface ResultadoAsignacionPrioridad {
  ok: boolean;
  offline: boolean;
  mensaje: string;
  versionReporte: number;
  reporte: ReportePrioridadTerrenoLocal;
  mision?: MisionLocal;
  data?: unknown;
}

/**
 * Envía el reporte de evaluación en terreno y asigna o modifica la prioridad del incidente (HU-38).
 */
export async function asignarPrioridadEnTerreno(
  incidenteId: string,
  input: AsignarPrioridadInput,
  misionActual?: MisionLocal
): Promise<ResultadoAsignacionPrioridad> {
  const validado = asignarPrioridadSchema.parse(input);
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  const reportesPrevios = obtenerReportesPrioridadMision(misionActual);
  const maxVersionPrevia = reportesPrevios.reduce(
    (max, r) => (r.versionReporte > max ? r.versionReporte : max),
    0
  );
  const versionReporte =
    input.versionReporte !== undefined && input.versionReporte > maxVersionPrevia
      ? input.versionReporte
      : maxVersionPrevia + 1;

  const esDiscrepancia = validado.prioridad !== validado.prioridadSugerida;
  const justificacionFinal = esDiscrepancia
    ? validado.justificacionPrioridad.trim()
    : validado.justificacionPrioridad.trim() ||
      'Prioridad ratificada en terreno conforme a la sugerencia técnica del sistema.';

  const factoresCalculados =
    validado.factoresGatillantes && validado.factoresGatillantes.length > 0
      ? validado.factoresGatillantes
      : calcularPrioridadSugerida(validado).factoresGatillantes;

  const misionUuidValido =
    validado.misionId ||
    (misionActual?.id && /^[0-9a-fA-F-]{36}$/.test(misionActual.id)
      ? misionActual.id
      : undefined);

  const payloadMutacion: AsignarPrioridadPayload = {
    prioridad: validado.prioridad,
    prioridadSugerida: validado.prioridadSugerida,
    justificacionPrioridad: justificacionFinal,
    familias: validado.familias,
    nucleoFamiliarTotal: validado.nucleoFamiliarTotal,
    cantidadNinos: validado.cantidadNinos,
    cantidadAdultosMayores: validado.cantidadAdultosMayores,
    personasDiscapacitadas: validado.personasDiscapacitadas,
    personasElectrodependientes: validado.personasElectrodependientes,
    mascotasAfectadas: validado.mascotasAfectadas,
    viviendasAfectadas: validado.viviendasAfectadas,
    nivelCompromisoVivienda: validado.nivelCompromisoVivienda,
    riesgoElectrico: validado.riesgoElectrico,
    riesgoEstructural: validado.riesgoEstructural,
    riesgoQuimicoSanitario: validado.riesgoQuimicoSanitario,
    aislamientoVial: validado.aislamientoVial,
    requiereEvacuacion: validado.requiereEvacuacion,
    requiereAsistenciaSocial: validado.requiereAsistenciaSocial,
    requiereApoyoAdicional: validado.requiereApoyoAdicional,
    detallesAdicionales: validado.detallesAdicionales,
    ...(misionUuidValido ? { misionId: misionUuidValido } : {}),
  };

  const ahoraIso = new Date().toISOString();

  const construirReporteLocal = (
    sincronizado: boolean,
    idRemoto?: string,
    versionConfirmada?: number
  ): ReportePrioridadTerrenoLocal => ({
    id: idRemoto || `rep-prio-v${versionConfirmada ?? versionReporte}-${Date.now()}`,
    versionReporte: versionConfirmada ?? versionReporte,
    evaluacion: {
      familias: validado.familias || [],
      nucleoFamiliarTotal: validado.nucleoFamiliarTotal,
      cantidadNinos: validado.cantidadNinos,
      cantidadAdultosMayores: validado.cantidadAdultosMayores,
      personasDiscapacitadas: validado.personasDiscapacitadas,
      personasElectrodependientes: validado.personasElectrodependientes,
      mascotasAfectadas: validado.mascotasAfectadas,
      viviendasAfectadas: validado.viviendasAfectadas,
      nivelCompromisoVivienda: validado.nivelCompromisoVivienda,
      riesgoElectrico: validado.riesgoElectrico,
      riesgoEstructural: validado.riesgoEstructural,
      riesgoQuimicoSanitario: validado.riesgoQuimicoSanitario,
      aislamientoVial: validado.aislamientoVial,
      requiereEvacuacion: validado.requiereEvacuacion,
      requiereAsistenciaSocial: validado.requiereAsistenciaSocial,
      requiereApoyoAdicional: validado.requiereApoyoAdicional,
      detallesAdicionales: validado.detallesAdicionales,
    },
    prioridadSugerida: validado.prioridadSugerida,
    prioridadAsignada: validado.prioridad,
    factoresGatillantes: factoresCalculados,
    justificacionPrioridad: justificacionFinal,
    creadoEn: ahoraIso,
    sincronizado,
  });

  const actualizarMisionConReporte = async (
    reporte: ReportePrioridadTerrenoLocal,
    pendienteSync: boolean,
    fechaServidor?: string
  ): Promise<MisionLocal | undefined> => {
    if (!misionActual) return undefined;
    const nuevaListaReportes = [...reportesPrevios, reporte];
    const misionActualizada: MisionLocal = {
      ...misionActual,
      prioridad: validado.prioridad,
      sincronizacionPendiente: pendienteSync,
      actualizadoEn: fechaServidor || ahoraIso,
      datosAdicionales: {
        ...misionActual.datosAdicionales,
        prioridadEvaluada: true,
        prioridadSugerida: validado.prioridadSugerida,
        justificacionPrioridad: justificacionFinal,
        versionReportePrioridad: reporte.versionReporte,
        ultimoReportePrioridad: reporte,
        reportesPrioridad: nuevaListaReportes,
      },
    };
    await guardarMisionLocal(misionActualizada);
    return misionActualizada;
  };

  if (!isOnline) {
    await encolarAccionOutbox({
      tipo: 'AJUSTAR_PRIORIDAD',
      url: `/api/incidentes/${incidenteId}/prioridad`,
      metodo: 'PATCH',
      payload: payloadMutacion as Record<string, unknown>,
    });

    const reporteOffline = construirReporteLocal(false);
    const misionActualizada = await actualizarMisionConReporte(reporteOffline, true);

    return {
      ok: true,
      offline: true,
      versionReporte,
      reporte: reporteOffline,
      mision: misionActualizada,
      mensaje:
        versionReporte > 1
          ? `Actualización (Reporte #${versionReporte}) guardada localmente. Se sincronizará automáticamente al recuperar la conexión.`
          : 'Evaluación y prioridad guardadas localmente. Se sincronizarán automáticamente al recuperar la conexión.',
    };
  }

  try {
    const { data, error, response } = await apiClient.PATCH(
      '/api/incidentes/{id}/prioridad',
      {
        params: { path: { id: incidenteId } },
        body: payloadMutacion,
      }
    );

    if (!error && data) {
      const versionConfirmada =
        data.data?.reporteTerreno?.versionReporte ?? versionReporte;
      const reporteOnline = construirReporteLocal(
        true,
        data.data?.reporteTerreno?.id,
        versionConfirmada
      );
      const misionActualizada = await actualizarMisionConReporte(
        reporteOnline,
        false,
        data.data?.incidente?.actualizadoEn
      );

      return {
        ok: true,
        offline: false,
        versionReporte: versionConfirmada,
        reporte: reporteOnline,
        mision: misionActualizada,
        data: data.data,
        mensaje:
          data.message ||
          (versionConfirmada > 1
            ? `Actualización enviada al Centro de Mando (Reporte #${versionConfirmada}) y prioridad actualizada exitosamente.`
            : 'Evaluación de terreno enviada al Centro de Mando y prioridad actualizada exitosamente.'),
      };
    }

    const status = response?.status ?? 500;
    if (status === 401) {
      throw new Error('Sesión expirada o no autorizada.');
    }

    if (status === 403) {
      throw new Error(
        extraerMensajeError(
          error,
          'No posee los permisos requeridos (misiones:terreno:verificar) para asignar o modificar la prioridad.'
        )
      );
    }

    if (status === 409) {
      throw new Error(
        extraerMensajeError(
          error,
          'La misión debe haber sido aceptada previamente (en curso) para evaluar y asignar prioridad.'
        )
      );
    }

    throw new Error(
      extraerMensajeError(
        error,
        `Error del servidor (${status}) al actualizar la prioridad del incidente.`
      )
    );
  } catch (err) {
    if (err instanceof TypeError || (err instanceof Error && err.message.includes('fetch'))) {
      await encolarAccionOutbox({
        tipo: 'AJUSTAR_PRIORIDAD',
        url: `/api/incidentes/${incidenteId}/prioridad`,
        metodo: 'PATCH',
        payload: payloadMutacion as Record<string, unknown>,
      });

      const reporteOffline = construirReporteLocal(false);
      const misionActualizada = await actualizarMisionConReporte(reporteOffline, true);

      return {
        ok: true,
        offline: true,
        versionReporte,
        reporte: reporteOffline,
        mision: misionActualizada,
        mensaje:
          versionReporte > 1
            ? `Fallo de conexión: Actualización (Reporte #${versionReporte}) guardada localmente. Se sincronizará al recuperar señal.`
            : 'Fallo de conexión: Evaluación y prioridad guardadas localmente. Se sincronizarán al recuperar señal.',
      };
    }

    throw err;
  }
}
