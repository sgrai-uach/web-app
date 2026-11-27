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
  EvaluadorReporteTerreno,
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

function extraerEvaluadorDeObjeto(raw: unknown): EvaluadorReporteTerreno | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const ev = raw as Record<string, unknown>;
  const nombre = typeof ev.nombre === 'string' ? ev.nombre.trim() : '';
  if (!nombre) return undefined;
  return {
    id: typeof ev.id === 'string' ? ev.id : undefined,
    nombre,
    email: typeof ev.email === 'string' ? ev.email : undefined,
    rut: typeof ev.rut === 'string' ? ev.rut : null,
  };
}

function obtenerEvaluadorSesionLocal(): EvaluadorReporteTerreno | undefined {
  if (typeof window === 'undefined' || !window.sessionStorage) return undefined;
  try {
    const raw = window.sessionStorage.getItem('sgrai_usuario_sesion');
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return extraerEvaluadorDeObjeto(parsed);
  } catch {
    return undefined;
  }
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

/**
 * Extrae el historial de reportes de evaluación de prioridad desde `mision.datosAdicionales`,
 * reconciliando los reportes remotos (`reportesTerreno`) provenientes del servidor —que incluyen
 * los reportes subidos por cualquier integrante de la patrulla junto con su autor (`evaluador`)—
 * con cualquier reporte local aún pendiente de sincronización en cola offline.
 */
export function obtenerReportesPrioridadMision(
  mision?: MisionLocal | null
): ReportePrioridadTerrenoLocal[] {
  if (!mision?.datosAdicionales) return [];

  const localesRaw = mision.datosAdicionales.reportesPrioridad;
  const locales: ReportePrioridadTerrenoLocal[] = Array.isArray(localesRaw)
    ? (localesRaw as ReportePrioridadTerrenoLocal[])
    : [];
  const localesPorVersion = new Map<number, ReportePrioridadTerrenoLocal>();
  for (const loc of locales) {
    if (typeof loc?.versionReporte === 'number') {
      localesPorVersion.set(loc.versionReporte, loc);
    }
  }

  const remotosRaw = mision.datosAdicionales.reportesTerreno;
  const remotosFiltrados = Array.isArray(remotosRaw)
    ? remotosRaw.filter((raw) => {
        const r = (raw || {}) as Record<string, unknown>;
        return r.tipoReporte !== 'VERIFICACION_CIERRE';
      })
    : [];

  const remotosMapeados: ReportePrioridadTerrenoLocal[] = remotosFiltrados.map((raw, idx) => {
    const r = (raw || {}) as Record<string, unknown>;
    const detalles = (
      r.detallesEvaluacion && typeof r.detallesEvaluacion === 'object'
        ? r.detallesEvaluacion
        : r.evaluacion && typeof r.evaluacion === 'object'
          ? r.evaluacion
          : undefined
    ) as Record<string, unknown> | undefined;

    const riesgos = (
      detalles?.riesgosActivos && typeof detalles.riesgosActivos === 'object'
        ? detalles.riesgosActivos
        : r.riesgosActivos && typeof r.riesgosActivos === 'object'
          ? r.riesgosActivos
          : undefined
    ) as Record<string, unknown> | undefined;

    const version =
      typeof r.versionReporte === 'number' && r.versionReporte > 0
        ? r.versionReporte
        : idx + 1;

    const tieneCamposDetalleEnRemoto = Boolean(
      detalles ||
        typeof r.nucleoFamiliarTotal === 'number' ||
        typeof r.personasAfectadas === 'number'
    );

    const localMismoVersion = localesPorVersion.get(version);

    const fuenteFamilias = Array.isArray(detalles?.familias)
      ? detalles.familias
      : Array.isArray(r.familias)
        ? r.familias
        : null;

    const num = (val: unknown, fallback: number): number =>
      typeof val === 'number' && Number.isFinite(val) ? val : fallback;

    const nucleoTotal = num(
      detalles?.nucleoFamiliarTotal ?? r.nucleoFamiliarTotal ?? r.personasAfectadas,
      VALORES_INICIALES_EVALUACION_PRIORIDAD.nucleoFamiliarTotal
    );
    const cantNinos = num(
      detalles?.cantidadNinos ?? r.cantidadNinos,
      VALORES_INICIALES_EVALUACION_PRIORIDAD.cantidadNinos
    );
    const cantAdultos = num(
      detalles?.cantidadAdultosMayores ?? r.cantidadAdultosMayores,
      VALORES_INICIALES_EVALUACION_PRIORIDAD.cantidadAdultosMayores
    );
    const cantDiscap = num(
      detalles?.personasDiscapacitadas ?? r.personasDiscapacitadas,
      VALORES_INICIALES_EVALUACION_PRIORIDAD.personasDiscapacitadas
    );
    const cantElectro = num(
      detalles?.personasElectrodependientes ?? r.personasElectrodependientes,
      VALORES_INICIALES_EVALUACION_PRIORIDAD.personasElectrodependientes
    );
    const cantMascotas = num(
      detalles?.mascotasAfectadas ?? r.mascotasAfectadas,
      VALORES_INICIALES_EVALUACION_PRIORIDAD.mascotasAfectadas
    );
    const compViviendaRaw =
      detalles?.nivelCompromisoVivienda ?? r.nivelCompromisoVivienda;
    const compVivienda: NivelCompromisoVivienda = esNivelCompromisoValido(compViviendaRaw)
      ? (compViviendaRaw.toUpperCase() as NivelCompromisoVivienda)
      : VALORES_INICIALES_EVALUACION_PRIORIDAD.nivelCompromisoVivienda;

    const familiasCargadas =
      fuenteFamilias && fuenteFamilias.length > 0
        ? (fuenteFamilias as Record<string, unknown>[]).map((f, fIdx) => ({
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
          }))
        : [
            {
              id: 'fam-1',
              referencia: '',
              nucleoFamiliarTotal: nucleoTotal,
              cantidadNinos: cantNinos,
              cantidadAdultosMayores: cantAdultos,
              personasDiscapacitadas: cantDiscap,
              personasElectrodependientes: cantElectro,
              mascotasAfectadas: cantMascotas,
              nivelCompromisoVivienda: compVivienda,
            },
          ];

    const evalBase: EvaluacionTerrenoPrioridadForm =
      !tieneCamposDetalleEnRemoto && localMismoVersion
        ? localMismoVersion.evaluacion
        : {
            familias: familiasCargadas,
            nucleoFamiliarTotal: nucleoTotal,
            cantidadNinos: cantNinos,
            cantidadAdultosMayores: cantAdultos,
            personasDiscapacitadas: cantDiscap,
            personasElectrodependientes: cantElectro,
            mascotasAfectadas: cantMascotas,
            viviendasAfectadas: num(
              detalles?.viviendasAfectadas ?? r.viviendasAfectadas,
              familiasCargadas.length || VALORES_INICIALES_EVALUACION_PRIORIDAD.viviendasAfectadas
            ),
            nivelCompromisoVivienda: compVivienda,
            riesgoElectrico: Boolean(
              riesgos?.riesgoElectrico ?? detalles?.riesgoElectrico ?? r.riesgoElectrico
            ),
            riesgoEstructural: Boolean(
              riesgos?.riesgoEstructural ?? detalles?.riesgoEstructural ?? r.riesgoEstructural
            ),
            riesgoQuimicoSanitario: Boolean(
              riesgos?.riesgoQuimicoSanitario ??
                detalles?.riesgoQuimicoSanitario ??
                r.riesgoQuimicoSanitario
            ),
            aislamientoVial: Boolean(
              riesgos?.aislamientoVial ?? detalles?.aislamientoVial ?? r.aislamientoVial
            ),
            requiereEvacuacion: Boolean(
              detalles?.requiereEvacuacion ?? r.requiereEvacuacion
            ),
            requiereApoyoAdicional: Boolean(
              detalles?.requiereApoyoAdicional ?? r.requiereApoyoAdicional
            ),
            detallesAdicionales:
              typeof detalles?.detallesAdicionales === 'string'
                ? detalles.detallesAdicionales
                : typeof r.detallesAdicionales === 'string'
                  ? r.detallesAdicionales
                  : typeof r.observaciones === 'string'
                    ? r.observaciones
                    : '',
          };

    const calculoBase = calcularPrioridadSugerida(evalBase);
    const prioSugerida = esPrioridadValida(
      r.prioridadSugerida ?? detalles?.prioridadSugerida
    )
      ? (String(r.prioridadSugerida ?? detalles?.prioridadSugerida).toUpperCase() as PrioridadIncidente)
      : localMismoVersion?.prioridadSugerida ?? calculoBase.prioridadSugerida;
    const prioAsignada = esPrioridadValida(
      r.prioridadAsignada ?? detalles?.prioridadAsignada ?? r.prioridad
    )
      ? (String(
          r.prioridadAsignada ?? detalles?.prioridadAsignada ?? r.prioridad
        ).toUpperCase() as PrioridadIncidente)
      : localMismoVersion?.prioridadAsignada ??
        (esPrioridadValida(mision.prioridad)
          ? (mision.prioridad.toUpperCase() as PrioridadIncidente)
          : prioSugerida);

    const factoresRemotos = Array.isArray(detalles?.factoresGatillantes)
      ? (detalles.factoresGatillantes as string[])
      : Array.isArray(r.factoresGatillantes)
        ? (r.factoresGatillantes as string[])
        : localMismoVersion?.factoresGatillantes ?? calculoBase.factoresGatillantes;

    const evaluador =
      extraerEvaluadorDeObjeto(r.evaluador) ?? localMismoVersion?.evaluador;

    return {
      id: typeof r.id === 'string' ? r.id : localMismoVersion?.id,
      versionReporte: version,
      evaluacion: evalBase,
      prioridadSugerida: prioSugerida,
      prioridadAsignada: prioAsignada,
      factoresGatillantes: factoresRemotos,
      justificacionPrioridad:
        typeof r.justificacionPrioridad === 'string'
          ? r.justificacionPrioridad
          : typeof detalles?.justificacionPrioridad === 'string'
            ? detalles.justificacionPrioridad
            : localMismoVersion?.justificacionPrioridad ?? '',
      ...(evaluador ? { evaluador } : {}),
      creadoEn:
        typeof r.creadoEn === 'string'
          ? r.creadoEn
          : localMismoVersion?.creadoEn ?? new Date().toISOString(),
      sincronizado: true,
    };
  });

  // Reconciliación: prioridad a reportes del servidor; preservar reportes locales pendientes (offline)
  const porVersion = new Map<number, ReportePrioridadTerrenoLocal>();
  for (const loc of locales) {
    if (loc.sincronizado !== false || remotosMapeados.length === 0) {
      porVersion.set(loc.versionReporte, loc);
    }
  }
  for (const rem of remotosMapeados) {
    porVersion.set(rem.versionReporte, rem);
  }

  const pendientesOffline =
    remotosMapeados.length > 0
      ? locales.filter(
          (loc) =>
            loc.sincronizado === false &&
            !remotosMapeados.some((rem) => rem.id && loc.id && rem.id === loc.id)
        )
      : [];

  const combinados = [...porVersion.values()];
  for (const pend of pendientesOffline) {
    if (!porVersion.has(pend.versionReporte)) {
      combinados.push(pend);
    } else {
      combinados.push({
        ...pend,
        versionReporte:
          combinados.reduce((m, r) => Math.max(m, r.versionReporte), 0) + 1,
      });
    }
  }

  return combinados.sort((a, b) => a.versionReporte - b.versionReporte);
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

export interface PersonasAfectadasPreviasInfo {
  cantidad: number;
  tieneEvaluacionPrevia: boolean;
  versionReporte?: number;
  evaluadorNombre?: string;
}

/**
 * Rescata la estimación de personas afectadas desde la evaluación de prioridad previa (HU-38)
 * para precargarla en el formulario de informe técnico y cierre (HU-39).
 */
export function obtenerPersonasAfectadasPrevias(
  mision?: MisionLocal | null
): PersonasAfectadasPreviasInfo {
  const ultimoReporte = obtenerUltimoReportePrioridad(mision);
  const previasApi = mision?.datosAdicionales?.personasAfectadasPrevias;

  if (ultimoReporte) {
    const totalEval = Math.max(
      0,
      Math.trunc(ultimoReporte.evaluacion.nucleoFamiliarTotal ?? 0)
    );
    const cantidad =
      totalEval === 0 && typeof previasApi === 'number' && Number.isFinite(previasApi) && previasApi > 0
        ? Math.trunc(previasApi)
        : totalEval;

    return {
      cantidad,
      tieneEvaluacionPrevia: true,
      versionReporte: ultimoReporte.versionReporte,
      evaluadorNombre: ultimoReporte.evaluador?.nombre,
    };
  }

  if (typeof previasApi === 'number' && Number.isFinite(previasApi)) {
    return {
      cantidad: Math.max(0, Math.trunc(previasApi)),
      tieneEvaluacionPrevia:
        Boolean(mision?.datosAdicionales?.prioridadEvaluada) || previasApi > 0,
      versionReporte:
        typeof mision?.datosAdicionales?.versionReportePrioridad === 'number'
          ? mision.datosAdicionales.versionReportePrioridad
          : undefined,
    };
  }

  return {
    cantidad: 0,
    tieneEvaluacionPrevia: false,
  };
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
    requiereApoyoAdicional: validado.requiereApoyoAdicional,
    detallesAdicionales: validado.detallesAdicionales,
    ...(misionUuidValido ? { misionId: misionUuidValido } : {}),
  };

  const ahoraIso = new Date().toISOString();
  const evaluadorSesion = obtenerEvaluadorSesionLocal();

  const construirReporteLocal = (
    sincronizado: boolean,
    idRemoto?: string,
    versionConfirmada?: number,
    evaluadorRemoto?: EvaluadorReporteTerreno
  ): ReportePrioridadTerrenoLocal => {
    const versionFinal = versionConfirmada ?? versionReporte;
    const evaluadorFinal = evaluadorRemoto ?? evaluadorSesion;
    return {
      id: idRemoto || `rep-prio-v${versionFinal}-${Date.now()}`,
      versionReporte: versionFinal,
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
        requiereApoyoAdicional: validado.requiereApoyoAdicional,
        detallesAdicionales: validado.detallesAdicionales,
      },
      prioridadSugerida: validado.prioridadSugerida,
      prioridadAsignada: validado.prioridad,
      factoresGatillantes: factoresCalculados,
      justificacionPrioridad: justificacionFinal,
      ...(evaluadorFinal ? { evaluador: evaluadorFinal } : {}),
      creadoEn: ahoraIso,
      sincronizado,
    };
  };

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
      const reporteTerrenoObj = data.data?.reporteTerreno as
        | { id?: string; versionReporte?: number; evaluador?: unknown }
        | undefined;
      const versionConfirmada =
        reporteTerrenoObj?.versionReporte ?? versionReporte;
      const evaluadorRemoto = extraerEvaluadorDeObjeto(
        reporteTerrenoObj?.evaluador
      );
      const reporteOnline = construirReporteLocal(
        true,
        reporteTerrenoObj?.id,
        versionConfirmada,
        evaluadorRemoto
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
