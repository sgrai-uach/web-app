import { getAuthCookie } from '@/lib/utils/cookieUtils';
import {
  DEV_PATRULLA_TOKEN,
  DEV_PATRULLA_USER_ID,
  handleUnauthorizedSession,
} from '@/lib/api/client';
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
  EvaluacionTerrenoPrioridadForm,
  MisionLocal,
  NivelCompromisoVivienda,
  PrioridadIncidente,
  ReportePrioridadTerrenoLocal,
} from '@/types/offline';

function resolveApiUrl(): string {
  if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
    return '';
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
}

function buildAuthHeaders(): Record<string, string> {
  const token = getAuthCookie();
  if (token === DEV_PATRULLA_TOKEN) {
    return { 'x-user-id': DEV_PATRULLA_USER_ID };
  }
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

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

/**
 * Extrae el historial de reportes de evaluación de prioridad desde `mision.datosAdicionales`,
 * normalizando tanto reportes locales como `reportesTerreno` provenientes de la API.
 */
export function obtenerReportesPrioridadMision(
  mision?: MisionLocal | null
): ReportePrioridadTerrenoLocal[] {
  if (!mision?.datosAdicionales) return [];

  const locales = mision.datosAdicionales.reportesPrioridad;
  if (Array.isArray(locales) && locales.length > 0) {
    return [...(locales as ReportePrioridadTerrenoLocal[])].sort(
      (a, b) => a.versionReporte - b.versionReporte
    );
  }

  const remotos = mision.datosAdicionales.reportesTerreno;
  if (Array.isArray(remotos) && remotos.length > 0) {
    const mapeados: ReportePrioridadTerrenoLocal[] = remotos.map((raw, idx) => {
      const r = (raw || {}) as Record<string, unknown>;
      const version =
        typeof r.versionReporte === 'number' && r.versionReporte > 0
          ? r.versionReporte
          : idx + 1;

      const evalBase: EvaluacionTerrenoPrioridadForm = {
        nucleoFamiliarTotal:
          typeof r.nucleoFamiliarTotal === 'number'
            ? r.nucleoFamiliarTotal
            : typeof r.personasAfectadas === 'number'
              ? r.personasAfectadas
              : VALORES_INICIALES_EVALUACION_PRIORIDAD.nucleoFamiliarTotal,
        cantidadNinos:
          typeof r.cantidadNinos === 'number'
            ? r.cantidadNinos
            : VALORES_INICIALES_EVALUACION_PRIORIDAD.cantidadNinos,
        cantidadAdultosMayores:
          typeof r.cantidadAdultosMayores === 'number'
            ? r.cantidadAdultosMayores
            : VALORES_INICIALES_EVALUACION_PRIORIDAD.cantidadAdultosMayores,
        personasDiscapacitadas:
          typeof r.personasDiscapacitadas === 'number'
            ? r.personasDiscapacitadas
            : VALORES_INICIALES_EVALUACION_PRIORIDAD.personasDiscapacitadas,
        personasElectrodependientes:
          typeof r.personasElectrodependientes === 'number'
            ? r.personasElectrodependientes
            : VALORES_INICIALES_EVALUACION_PRIORIDAD.personasElectrodependientes,
        mascotasAfectadas:
          typeof r.mascotasAfectadas === 'number'
            ? r.mascotasAfectadas
            : VALORES_INICIALES_EVALUACION_PRIORIDAD.mascotasAfectadas,
        viviendasAfectadas:
          typeof r.viviendasAfectadas === 'number'
            ? r.viviendasAfectadas
            : VALORES_INICIALES_EVALUACION_PRIORIDAD.viviendasAfectadas,
        nivelCompromisoVivienda: esNivelCompromisoValido(r.nivelCompromisoVivienda)
          ? (r.nivelCompromisoVivienda.toUpperCase() as NivelCompromisoVivienda)
          : VALORES_INICIALES_EVALUACION_PRIORIDAD.nivelCompromisoVivienda,
        riesgoElectrico: Boolean(r.riesgoElectrico),
        riesgoEstructural: Boolean(r.riesgoEstructural),
        riesgoQuimicoSanitario: Boolean(r.riesgoQuimicoSanitario),
        aislamientoVial: Boolean(r.aislamientoVial),
        requiereEvacuacion: Boolean(r.requiereEvacuacion),
        requiereAsistenciaSocial: Boolean(r.requiereAsistenciaSocial),
        requiereApoyoAdicional: Boolean(r.requiereApoyoAdicional),
        detallesAdicionales:
          typeof r.detallesAdicionales === 'string'
            ? r.detallesAdicionales
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
            : '',
        creadoEn:
          typeof r.creadoEn === 'string' ? r.creadoEn : new Date().toISOString(),
        sincronizado: true,
      };
    });

    return mapeados.sort((a, b) => a.versionReporte - b.versionReporte);
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
 * Ejecuta primero el motor determinista local y, si hay conexión, consulta opcionalmente
 * `POST /api/incidentes/{id}/prioridad/calcular` sin bloquear la experiencia en terreno.
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
    const apiUrl = resolveApiUrl();
    const res = await fetch(
      `${apiUrl}/api/incidentes/${incidenteId}/prioridad/calcular`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders(),
        },
        body: JSON.stringify(evaluacion),
      }
    );

    if (res.ok) {
      const body = (await res.json().catch(() => ({}))) as {
        data?: {
          prioridadSugerida?: string;
          factoresGatillantes?: string[];
        };
        prioridadSugerida?: string;
        factoresGatillantes?: string[];
      };

      const prioRaw =
        body?.data?.prioridadSugerida || body?.prioridadSugerida;
      const factoresRaw =
        body?.data?.factoresGatillantes || body?.factoresGatillantes;

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
 * - Valida que si `prioridad !== prioridadSugerida`, `justificacionPrioridad` tenga al menos 5 caracteres.
 * - Incrementa automáticamente `versionReporte` cuando existen reportes previos para dejar trazabilidad en el Centro de Mando.
 * - En modo offline o ante caída de red, encola la mutación `AJUSTAR_PRIORIDAD` en IndexedDB (`outbox`).
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

  const payloadMutacion: Record<string, unknown> = {
    prioridad: validado.prioridad,
    prioridadSugerida: validado.prioridadSugerida,
    justificacionPrioridad: justificacionFinal,
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
    factoresGatillantes: factoresCalculados,
    versionReporte,
    misionId: misionUuidValido,
  };

  const ahoraIso = new Date().toISOString();

  const construirReporteLocal = (
    sincronizado: boolean,
    idRemoto?: string
  ): ReportePrioridadTerrenoLocal => ({
    id: idRemoto || `rep-prio-v${versionReporte}-${Date.now()}`,
    versionReporte,
    evaluacion: {
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
        versionReportePrioridad: versionReporte,
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
      payload: payloadMutacion,
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
    const apiUrl = resolveApiUrl();
    const res = await fetch(`${apiUrl}/api/incidentes/${incidenteId}/prioridad`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...buildAuthHeaders(),
      },
      body: JSON.stringify(payloadMutacion),
    });

    const body = (await res.json().catch(() => ({}))) as {
      message?: string;
      data?: {
        incidente?: {
          id?: string;
          prioridad?: string;
          actualizadoEn?: string;
        };
        reporte?: {
          id?: string;
          versionReporte?: number;
        };
        hito?: unknown;
      };
    };

    if (res.ok) {
      const reporteOnline = construirReporteLocal(true, body?.data?.reporte?.id);
      const misionActualizada = await actualizarMisionConReporte(
        reporteOnline,
        false,
        body?.data?.incidente?.actualizadoEn
      );

      return {
        ok: true,
        offline: false,
        versionReporte,
        reporte: reporteOnline,
        mision: misionActualizada,
        data: body?.data,
        mensaje:
          body?.message ||
          (versionReporte > 1
            ? `Actualización enviada al Centro de Mando (Reporte #${versionReporte}) y prioridad actualizada exitosamente.`
            : 'Evaluación de terreno enviada al Centro de Mando y prioridad actualizada exitosamente.'),
      };
    }

    // Soporte para modo demostración local (DEV_PATRULLA_TOKEN) cuando el backend local no tiene el incidente cargado
    const tokenActual = typeof window !== 'undefined' ? getAuthCookie() : null;
    const esModoDemoLocal =
      Boolean(tokenActual) && tokenActual === (DEV_PATRULLA_TOKEN || 'dev-patrulla-token');
    if (esModoDemoLocal && (res.status === 401 || res.status === 403 || res.status === 404)) {
      const reporteDemo = construirReporteLocal(true);
      const misionActualizada = await actualizarMisionConReporte(reporteDemo, false);
      return {
        ok: true,
        offline: false,
        versionReporte,
        reporte: reporteDemo,
        mision: misionActualizada,
        mensaje:
          versionReporte > 1
            ? `Actualización enviada al Centro de Mando (Reporte #${versionReporte}) y prioridad actualizada exitosamente.`
            : 'Evaluación de terreno enviada al Centro de Mando y prioridad actualizada exitosamente.',
      };
    }

    if (res.status === 401) {
      handleUnauthorizedSession();
      throw new Error('Sesión expirada o no autorizada.');
    }

    if (res.status === 403) {
      throw new Error(
        body?.message ||
          'No posee los permisos requeridos (misiones:terreno:verificar) para asignar o modificar la prioridad.'
      );
    }

    if (res.status === 409) {
      throw new Error(
        body?.message ||
          'La misión debe haber sido aceptada previamente (en curso) para evaluar y asignar prioridad.'
      );
    }

    throw new Error(
      body?.message || `Error del servidor (${res.status}) al actualizar la prioridad del incidente.`
    );
  } catch (err) {
    if (err instanceof TypeError || (err instanceof Error && err.message.includes('fetch'))) {
      await encolarAccionOutbox({
        tipo: 'AJUSTAR_PRIORIDAD',
        url: `/api/incidentes/${incidenteId}/prioridad`,
        metodo: 'PATCH',
        payload: payloadMutacion,
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

