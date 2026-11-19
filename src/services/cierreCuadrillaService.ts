import apiClient, { handleUnauthorizedSession } from '@/lib/api/client';
import {
  encolarAccionOutbox,
  guardarCatalogoLocal,
  guardarMisionLocal,
  obtenerCatalogoLocal,
  obtenerMisionLocalPorId,
} from '@/services/offlineQueue';
import {
  obtenerCoordenadasOpcionales,
  obtenerDetalleMision,
} from '@/services/misionesService';
import {
  cerrarMisionCuadrillaSchema,
  ESTADOS_TERRENO_CUADRILLA,
  type CerrarMisionCuadrillaInput,
} from '@/lib/validations/cierreCuadrilla';
import type {
  AdjuntoReportePreliminar,
  CerrarMisionCuadrillaPayload,
  CerrarMisionCuadrillaResponseData,
  EstadoTerrenoCierreCuadrilla,
  EvaluadorReporteTerreno,
  MaterialConsumidoFormItem,
  MisionLocal,
  RecursoAsignadoCuadrillaLocal,
  RecursoCatalogoConsumible,
  ReporteCierreCuadrillaLocal,
} from '@/types/offline';

export const CLAVE_CATALOGO_RECURSOS = 'recursos_inventario';

export class CierreCuadrillaServiceError extends Error {
  public readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'CierreCuadrillaServiceError';
    this.statusCode = statusCode;
  }
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function esUuidValido(valor?: string | null): valor is string {
  return typeof valor === 'string' && UUID_REGEX.test(valor.trim());
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

function normalizarEstadoTerrenoCuadrilla(val: unknown): EstadoTerrenoCierreCuadrilla {
  if (typeof val === 'string') {
    const upper = val.trim().toUpperCase();
    if ((ESTADOS_TERRENO_CUADRILLA as readonly string[]).includes(upper)) {
      return upper as EstadoTerrenoCierreCuadrilla;
    }
  }
  return 'FINALIZADO';
}

function normalizarMaterialesRemotos(raw: unknown): MaterialConsumidoFormItem[] {
  let lista: unknown = raw;
  if (typeof raw === 'string') {
    try {
      lista = JSON.parse(raw);
    } catch {
      lista = [];
    }
  }
  if (!Array.isArray(lista)) return [];
  const resultado: MaterialConsumidoFormItem[] = [];
  for (const item of lista) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const recursoId =
      typeof obj.recursoId === 'string'
        ? obj.recursoId
        : typeof obj.recurso_id === 'string'
          ? obj.recurso_id
          : '';
    const cantidad = Number(obj.cantidad ?? 0);
    if (!recursoId || !Number.isFinite(cantidad) || cantidad <= 0) continue;
    resultado.push({
      recurso_id: recursoId,
      ...(typeof obj.nombre === 'string' && obj.nombre.trim()
        ? { nombre: obj.nombre.trim() }
        : {}),
      cantidad,
      ...(typeof obj.unidad === 'string' && obj.unidad.trim()
        ? { unidad: obj.unidad.trim() }
        : {}),
      ...(typeof obj.observacion === 'string' && obj.observacion.trim()
        ? { observacion: obj.observacion.trim() }
        : {}),
    });
  }
  return resultado;
}

/**
 * Extrae el informe técnico final de cuadrilla (HU-68) desde `mision.datosAdicionales`,
 * priorizando el registro oficial de `reportesTerreno` con `tipoReporte === 'REPORTE_CUADRILLA'`,
 * o recurriendo al registro local en cola offline (`reporteCuadrilla`).
 */
export function obtenerReporteCierreCuadrillaMision(
  mision?: MisionLocal | null
): ReporteCierreCuadrillaLocal | null {
  if (!mision?.datosAdicionales) return null;

  const remotos = mision.datosAdicionales.reportesTerreno;
  if (Array.isArray(remotos) && remotos.length > 0) {
    const reportesCuadrilla = remotos
      .map((raw) => (raw || {}) as Record<string, unknown>)
      .filter((r) => r.tipoReporte === 'REPORTE_CUADRILLA')
      .sort(
        (a, b) =>
          new Date(String(b.creadoEn || 0)).getTime() -
          new Date(String(a.creadoEn || 0)).getTime()
      );

    const cierreRemoto = reportesCuadrilla[0];
    if (cierreRemoto) {
      const evaluador = extraerEvaluadorDeObjeto(cierreRemoto.evaluador);
      const adjuntosRaw = Array.isArray(cierreRemoto.adjuntos)
        ? (cierreRemoto.adjuntos as Record<string, unknown>[])
        : [];
      const adjuntos: AdjuntoReportePreliminar[] = adjuntosRaw.map((adj) => ({
        id: typeof adj.id === 'string' ? adj.id : undefined,
        nombreArchivo:
          typeof adj.nombreArchivo === 'string' ? adj.nombreArchivo : undefined,
        url: typeof adj.url === 'string' ? adj.url : undefined,
        tipoMime: typeof adj.tipoMime === 'string' ? adj.tipoMime : undefined,
        tamanoBytes:
          typeof adj.tamanoBytes === 'number' ? adj.tamanoBytes : undefined,
      }));

      const resumenTexto =
        typeof cierreRemoto.resumenFaenas === 'string' && cierreRemoto.resumenFaenas.trim()
          ? cierreRemoto.resumenFaenas
          : typeof cierreRemoto.resumenTecnico === 'string'
            ? cierreRemoto.resumenTecnico
            : '';

      const horasHombreNum = Number(
        cierreRemoto.horasHombre ?? cierreRemoto.horas_hombre ?? 1
      );

      return {
        id: typeof cierreRemoto.id === 'string' ? cierreRemoto.id : undefined,
        misionId: mision.id,
        etiquetaReporte:
          typeof cierreRemoto.etiquetaReporte === 'string'
            ? cierreRemoto.etiquetaReporte
            : 'Informe Técnico Final de Cuadrilla (Cierre de Misión)',
        resumen_faenas: resumenTexto,
        horas_hombre:
          Number.isFinite(horasHombreNum) && horasHombreNum > 0 ? horasHombreNum : 1,
        estado_terreno: normalizarEstadoTerrenoCuadrilla(cierreRemoto.estadoTerreno),
        materiales_consumidos: normalizarMaterialesRemotos(
          cierreRemoto.materialesConsumidos ?? cierreRemoto.materiales_consumidos
        ),
        danos_estimados:
          typeof cierreRemoto.danosEstimados === 'string'
            ? cierreRemoto.danosEstimados
            : '',
        observaciones:
          typeof cierreRemoto.observaciones === 'string'
            ? cierreRemoto.observaciones
            : '',
        requiere_apoyo_adicional: Boolean(cierreRemoto.requiereApoyoAdicional),
        requiere_asistencia_social: Boolean(cierreRemoto.requiereAsistenciaSocial),
        adjunto_ids: adjuntos
          .map((a) => a.id)
          .filter((id): id is string => esUuidValido(id)),
        adjuntos,
        ...(evaluador ? { evaluador } : {}),
        creadoEn:
          typeof cierreRemoto.creadoEn === 'string'
            ? cierreRemoto.creadoEn
            : mision.actualizadoEn || new Date().toISOString(),
        sincronizado: true,
      };
    }
  }

  const local = mision.datosAdicionales.reporteCuadrilla;
  if (local && typeof local === 'object') {
    return local as ReporteCierreCuadrillaLocal;
  }

  return null;
}

/**
 * Obtiene el catálogo de materiales e insumos consumibles para la cuadrilla (HU-68):
 * 1. Prioriza los recursos ya asignados a la cuadrilla (`misionActual.datosAdicionales.cuadrillaRecursos`).
 * 2. Si hay conexión (`navigator.onLine !== false`), consulta `GET /api/recursos` (`esIndividual: false`)
 *    y actualiza el caché IndexedDB `catalogos['recursos_inventario']`.
 * 3. Si no hay red o el servidor responde 403/error, degrada al caché local IndexedDB sin bloquear el formulario.
 */
export async function obtenerRecursosDisponiblesCuadrilla(
  misionActual?: MisionLocal | null
): Promise<RecursoCatalogoConsumible[]> {
  const asignadosRaw = Array.isArray(misionActual?.datosAdicionales?.cuadrillaRecursos)
    ? (misionActual!.datosAdicionales!.cuadrillaRecursos as RecursoAsignadoCuadrillaLocal[])
    : [];

  const mapa = new Map<string, RecursoCatalogoConsumible>();

  for (const item of asignadosRaw) {
    if (!item?.id || !item?.nombre) continue;
    const esIndividual =
      item.esIndividual !== undefined
        ? Boolean(item.esIndividual)
        : String(item.tipo || '').toUpperCase() === 'INDIVIDUAL';
    mapa.set(item.id, {
      id: item.id,
      nombre: item.nombre,
      tipo: item.tipo || (esIndividual ? 'INDIVIDUAL' : 'GRUPAL'),
      unidad: item.unidad ?? null,
      cantidadDisponible: Number(item.cantidadAsignada ?? 0),
      cantidadAsignada: Number(item.cantidadAsignada ?? 0),
      esIndividual,
      asignadoACuadrilla: true,
    });
  }

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  let catalogoRemotoOCache: Array<Record<string, unknown>> = [];

  if (isOnline) {
    try {
      const { data, error } = await apiClient.GET('/api/recursos', {
        params: {
          query: {
            limit: 100,
            esIndividual: false,
          },
        },
      });
      if (!error && data && Array.isArray(data.data)) {
        catalogoRemotoOCache = data.data as unknown as Array<Record<string, unknown>>;
        try {
          await guardarCatalogoLocal(CLAVE_CATALOGO_RECURSOS, catalogoRemotoOCache);
        } catch {
          // Ignorar fallo de caché en IndexedDB
        }
      }
    } catch {
      // Fallback a caché local
    }
  }

  if (catalogoRemotoOCache.length === 0) {
    try {
      const cache = await obtenerCatalogoLocal<Record<string, unknown>>(
        CLAVE_CATALOGO_RECURSOS
      );
      if (Array.isArray(cache)) {
        catalogoRemotoOCache = cache;
      }
    } catch {
      catalogoRemotoOCache = [];
    }
  }

  for (const raw of catalogoRemotoOCache) {
    if (!raw || typeof raw !== 'object') continue;
    const id = typeof raw.id === 'string' ? raw.id : '';
    const nombre = typeof raw.nombre === 'string' ? raw.nombre : '';
    if (!id || !nombre) continue;

    const esIndividual = Boolean(raw.esIndividual ?? raw.es_individual ?? false);
    const detalles =
      raw.detalles && typeof raw.detalles === 'object'
        ? (raw.detalles as Record<string, unknown>)
        : {};
    const unidad =
      typeof detalles.unidad === 'string' && detalles.unidad.trim()
        ? detalles.unidad.trim()
        : typeof raw.unidad === 'string' && raw.unidad.trim()
          ? raw.unidad.trim()
          : null;
    const cantidadDisponible = Number(
      raw.cantidadDisponible ??
        raw.cantidad_disponible ??
        raw.cantidadInventario ??
        raw.cantidad_inventario ??
        0
    );

    const existente = mapa.get(id);
    if (existente) {
      mapa.set(id, {
        ...existente,
        unidad: existente.unidad ?? unidad,
        esIndividual,
        estado: typeof raw.estado === 'string' ? raw.estado : existente.estado,
      });
    } else if (!esIndividual) {
      mapa.set(id, {
        id,
        nombre,
        tipo: esIndividual ? 'INDIVIDUAL' : 'GRUPAL',
        unidad,
        cantidadDisponible: Number.isFinite(cantidadDisponible) ? cantidadDisponible : 0,
        esIndividual: false,
        asignadoACuadrilla: false,
        estado: typeof raw.estado === 'string' ? raw.estado : undefined,
      });
    }
  }

  return Array.from(mapa.values());
}

export interface ResultadoCierreCuadrilla {
  ok: boolean;
  offline: boolean;
  mensaje: string;
  reporte: ReporteCierreCuadrillaLocal;
  mision?: MisionLocal;
  data?: CerrarMisionCuadrillaResponseData;
}

/**
 * Ejecuta el cierre formal de una misión operativa de cuadrilla con su Informe Técnico Final (HU-68).
 * - Valida el formulario con `cerrarMisionCuadrillaSchema`.
 * - Captura coordenadas GPS opcionales de forma no bloqueante (timeout 3000 ms).
 * - Filtra `adjunto_ids` para enviar exclusivamente UUIDs ya sincronizados (excluyendo `local-*`).
 * - En modo online invoca `apiClient.POST('/api/misiones/{id}/cerrar')` (`201 Created`).
 * - Ante errores de cliente (`400`, `401`, `403`, `404`, `409`), arroja `CierreCuadrillaServiceError` sin encolar en `outbox`.
 * - En modo offline o error `5xx` / falla de red, actualiza la misión optimistamente y encola `CERRAR_FAENA` en `outbox`.
 */
export async function cerrarMisionCuadrilla(
  misionId: string,
  input: CerrarMisionCuadrillaInput,
  misionActual?: MisionLocal,
  adjuntosPendientesLocalIds?: string[]
): Promise<ResultadoCierreCuadrilla> {
  const inputNormalizado: CerrarMisionCuadrillaInput = {
    ...input,
    adjunto_ids: (input.adjunto_ids || []).filter((id) => esUuidValido(id)),
    adjuntos: (input.adjuntos || []).filter(
      (adj) => !adj.id || esUuidValido(adj.id)
    ),
  };

  const validado = cerrarMisionCuadrillaSchema.parse(inputNormalizado);
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  let latitud = validado.latitud;
  let longitud = validado.longitud;
  if (latitud === undefined || longitud === undefined) {
    const coords = await obtenerCoordenadasOpcionales(3000);
    latitud = coords.latitud;
    longitud = coords.longitud;
  }

  const danosLimpio = validado.danos_estimados?.trim() || undefined;
  const observacionesLimpio = validado.observaciones?.trim() || undefined;

  const materialesPayload = (validado.materiales_consumidos || []).map((mat) => ({
    recurso_id: mat.recurso_id,
    cantidad: mat.cantidad,
    ...(mat.unidad?.trim() ? { unidad: mat.unidad.trim() } : {}),
    ...(mat.observacion?.trim() ? { observacion: mat.observacion.trim() } : {}),
  }));

  const adjuntosSincronizadosPayload = (validado.adjuntos || [])
    .filter((a) => esUuidValido(a.id) && typeof a.url === 'string' && a.url.length > 0)
    .map((a) => ({
      id: a.id!,
      nombreArchivo: a.nombreArchivo || 'evidencia',
      url: a.url!,
      tipoMime: a.tipoMime || 'image/jpeg',
      tamanoBytes: typeof a.tamanoBytes === 'number' ? a.tamanoBytes : 0,
    }));

  const payloadApi: CerrarMisionCuadrillaPayload = {
    resumen_faenas: validado.resumen_faenas,
    horas_hombre: validado.horas_hombre,
    estado_terreno: validado.estado_terreno,
    materiales_consumidos: materialesPayload,
    ...(observacionesLimpio ? { observaciones: observacionesLimpio } : {}),
    ...(danosLimpio ? { danos_estimados: danosLimpio } : {}),
    requiere_apoyo_adicional: Boolean(validado.requiere_apoyo_adicional),
    requiere_asistencia_social: Boolean(validado.requiere_asistencia_social),
    ...(validado.adjunto_ids.length > 0
      ? { adjunto_ids: validado.adjunto_ids }
      : {}),
    ...(adjuntosSincronizadosPayload.length > 0
      ? { adjuntos: adjuntosSincronizadosPayload }
      : {}),
    ...(typeof latitud === 'number' && typeof longitud === 'number'
      ? { latitud, longitud }
      : {}),
  };

  const ahoraIso = new Date().toISOString();
  const evaluadorSesion = obtenerEvaluadorSesionLocal();

  const materialesConNombres: MaterialConsumidoFormItem[] = (
    input.materiales_consumidos || []
  ).map((m) => ({
    recurso_id: m.recurso_id,
    ...(typeof (m as MaterialConsumidoFormItem).nombre === 'string'
      ? { nombre: (m as MaterialConsumidoFormItem).nombre }
      : {}),
    cantidad: m.cantidad,
    ...(m.unidad?.trim() ? { unidad: m.unidad.trim() } : {}),
    ...(m.observacion?.trim() ? { observacion: m.observacion.trim() } : {}),
  }));

  const construirReporteLocal = (
    sincronizado: boolean,
    idRemoto?: string,
    evaluadorRemoto?: EvaluadorReporteTerreno,
    creadoEnServidor?: string,
    materialesRemotos?: MaterialConsumidoFormItem[]
  ): ReporteCierreCuadrillaLocal => {
    const evaluadorFinal = evaluadorRemoto ?? evaluadorSesion;
    return {
      id: idRemoto || `rep-cuadrilla-${Date.now()}`,
      misionId,
      etiquetaReporte: 'Informe Técnico Final de Cuadrilla (Cierre de Misión)',
      resumen_faenas: validado.resumen_faenas,
      horas_hombre: validado.horas_hombre,
      estado_terreno: validado.estado_terreno,
      materiales_consumidos:
        materialesRemotos && materialesRemotos.length > 0
          ? materialesRemotos
          : materialesConNombres,
      danos_estimados: danosLimpio || '',
      observaciones: observacionesLimpio || '',
      requiere_apoyo_adicional: Boolean(validado.requiere_apoyo_adicional),
      requiere_asistencia_social: Boolean(validado.requiere_asistencia_social),
      adjunto_ids: validado.adjunto_ids,
      adjuntos: validado.adjuntos,
      ...(evaluadorFinal ? { evaluador: evaluadorFinal } : {}),
      creadoEn: creadoEnServidor || ahoraIso,
      sincronizado,
    };
  };

  const actualizarMisionLocal = async (
    reporte: ReporteCierreCuadrillaLocal,
    pendienteSync: boolean,
    resRemota?: CerrarMisionCuadrillaResponseData
  ): Promise<MisionLocal | undefined> => {
    const base =
      misionActual ?? (await obtenerMisionLocalPorId(misionId));
    if (!base) return undefined;

    const reportesTerrenoPrevios = Array.isArray(
      base.datosAdicionales?.reportesTerreno
    )
      ? (base.datosAdicionales.reportesTerreno as Record<string, unknown>[])
      : [];

    const fechaCierreFinal =
      resRemota?.mision?.fechaCierre || reporte.creadoEn || ahoraIso;

    const reporteTerrenoRegistro: Record<string, unknown> = {
      id: reporte.id,
      misionId,
      tipoReporte: 'REPORTE_CUADRILLA',
      etiquetaReporte:
        reporte.etiquetaReporte ||
        'Informe Técnico Final de Cuadrilla (Cierre de Misión)',
      resumenTecnico: reporte.resumen_faenas,
      resumenFaenas: reporte.resumen_faenas,
      accionesRealizadas: reporte.resumen_faenas,
      horasHombre: reporte.horas_hombre,
      estadoTerreno: reporte.estado_terreno,
      materialesConsumidos: reporte.materiales_consumidos.map((m) => ({
        recursoId: m.recurso_id,
        recurso_id: m.recurso_id,
        nombre: m.nombre,
        cantidad: m.cantidad,
        unidad: m.unidad ?? null,
        observacion: m.observacion ?? null,
      })),
      danosEstimados: reporte.danos_estimados || null,
      observaciones: reporte.observaciones || null,
      requiereApoyoAdicional: reporte.requiere_apoyo_adicional,
      requiereAsistenciaSocial: reporte.requiere_asistencia_social,
      adjuntos: reporte.adjuntos,
      ...(reporte.evaluador ? { evaluador: reporte.evaluador } : {}),
      creadoEn: reporte.creadoEn,
    };

    const misionActualizada: MisionLocal = {
      ...base,
      estado: resRemota?.mision?.estado || 'COMPLETADA',
      sincronizacionPendiente: pendienteSync,
      actualizadoEn: resRemota?.mision?.actualizadoEn || fechaCierreFinal,
      datosAdicionales: {
        ...base.datosAdicionales,
        estadoCuadrilla: resRemota?.cuadrilla?.estado || 'DISPONIBLE',
        estadoIncidente:
          resRemota?.incidente?.estado ||
          (base.datosAdicionales?.estadoIncidente as string | undefined) ||
          'EN_ATENCION',
        fechaCierre: fechaCierreFinal,
        ...(reporte.id && !reporte.id.startsWith('rep-cuadrilla-')
          ? { reporteTerrenoId: reporte.id }
          : {}),
        reporteCuadrillaEnviado: true,
        reporteCuadrillaEnviadoEn: reporte.creadoEn,
        reporteCuadrilla: reporte,
        reportesTerreno: [
          ...reportesTerrenoPrevios.filter(
            (r) => r.tipoReporte !== 'REPORTE_CUADRILLA'
          ),
          reporteTerrenoRegistro,
        ],
      },
    };

    await guardarMisionLocal(misionActualizada);
    return misionActualizada;
  };

  const encolarYResponderOffline = async (
    mensajeOffline: string
  ): Promise<ResultadoCierreCuadrilla> => {
    const payloadOutbox: Record<string, unknown> = {
      ...(payloadApi as unknown as Record<string, unknown>),
      ...(Array.isArray(adjuntosPendientesLocalIds) &&
      adjuntosPendientesLocalIds.length > 0
        ? { _adjuntosPendientesLocalIds: adjuntosPendientesLocalIds }
        : {}),
    };

    await encolarAccionOutbox({
      tipo: 'CERRAR_FAENA',
      url: `/api/misiones/${misionId}/cerrar`,
      metodo: 'POST',
      payload: payloadOutbox,
    });

    const reporteOffline = construirReporteLocal(false);
    const misionActualizada = await actualizarMisionLocal(reporteOffline, true);

    return {
      ok: true,
      offline: true,
      reporte: reporteOffline,
      mision: misionActualizada,
      mensaje: mensajeOffline,
    };
  };

  if (!isOnline) {
    return encolarYResponderOffline(
      'Sin conexión: Informe técnico final guardado localmente y encolado para cerrar la misión al recuperar señal.'
    );
  }

  try {
    const { data, error, response } = await apiClient.POST(
      '/api/misiones/{id}/cerrar',
      {
        params: {
          path: { id: misionId },
        },
        body: payloadApi,
      }
    );

    if (!error && data && data.data) {
      const resData = data.data;
      const repRemoto = resData.reporteTerreno;
      const evaluadorRemoto = extraerEvaluadorDeObjeto(repRemoto?.evaluador);
      const materialesRemotos = normalizarMaterialesRemotos(
        repRemoto?.materialesConsumidos
      );

      const reporteOnline = construirReporteLocal(
        true,
        repRemoto?.id,
        evaluadorRemoto,
        repRemoto?.creadoEn,
        materialesRemotos
      );

      const misionActualizada = await actualizarMisionLocal(
        reporteOnline,
        false,
        resData
      );

      // Actualizar saldos en caché local de recursos si fueron descontados
      if (
        Array.isArray(resData.recursosActualizados) &&
        resData.recursosActualizados.length > 0
      ) {
        try {
          const cachePrevio =
            (await obtenerCatalogoLocal<Record<string, unknown>>(
              CLAVE_CATALOGO_RECURSOS
            )) || [];
          if (cachePrevio.length > 0) {
            const actualizadosPorId = new Map(
              resData.recursosActualizados.map((r) => [r.id, r])
            );
            const nuevoCache = cachePrevio.map((item) => {
              const id = typeof item.id === 'string' ? item.id : '';
              const cambio = actualizadosPorId.get(id);
              if (!cambio) return item;
              const disponibleActual = Math.max(
                0,
                Number(cambio.cantidadInventarioActual ?? 0) -
                  Number(cambio.cantidadEnUsoActual ?? 0)
              );
              return {
                ...item,
                cantidadInventario: cambio.cantidadInventarioActual,
                cantidad_inventario: cambio.cantidadInventarioActual,
                cantidadEnUso: cambio.cantidadEnUsoActual,
                cantidad_en_uso: cambio.cantidadEnUsoActual,
                cantidadDisponible: disponibleActual,
                cantidad_disponible: disponibleActual,
                estado: cambio.estado,
              };
            });
            await guardarCatalogoLocal(CLAVE_CATALOGO_RECURSOS, nuevoCache);
          }
        } catch {
          // Ignorar fallo secundario de actualización de catálogo local
        }
      }

      return {
        ok: true,
        offline: false,
        reporte: reporteOnline,
        mision: misionActualizada,
        data: resData,
        mensaje:
          data.message ||
          'Informe técnico final registrado y misión completada exitosamente. Cuadrilla disponible.',
      };
    }

    const status = response?.status ?? 500;
    const msgServidor =
      (error as { message?: string } | undefined)?.message ||
      (status === 401
        ? 'Sesión expirada o no autenticada.'
        : status === 403
          ? 'No posee el permiso requerido (misiones:terreno:ejecutar) o la misión pertenece a otra cuadrilla.'
          : status === 404
            ? 'La misión o alguno de los recursos indicados no fue encontrado.'
            : status === 409
              ? 'La misión no se encuentra en curso o el stock de materiales es insuficiente.'
              : `Error del servidor (${status}) al finalizar la misión.`);

    if (status === 401) {
      handleUnauthorizedSession();
      throw new CierreCuadrillaServiceError(401, msgServidor);
    }

    if (status === 400 || status === 403 || status === 404 || status === 409) {
      if (status === 409) {
        try {
          await obtenerDetalleMision(misionId);
        } catch {
          // Ignorar fallo secundario al refrescar detalle
        }
      }
      throw new CierreCuadrillaServiceError(status, msgServidor);
    }

    // Errores 5xx derivan al flujo offline
    return encolarYResponderOffline(
      'Fallo temporal del servidor: Informe técnico guardado localmente. Se sincronizará automáticamente.'
    );
  } catch (err) {
    if (err instanceof CierreCuadrillaServiceError) {
      throw err;
    }

    return encolarYResponderOffline(
      'Fallo de conexión: Informe técnico guardado localmente. Se sincronizará al recuperar señal.'
    );
  }
}
