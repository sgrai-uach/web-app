import apiClient from '@/lib/api/client';
import {
  encolarAccionOutbox,
  guardarMisionLocal,
  obtenerMisionLocalPorId,
} from '@/services/offlineQueue';
import {
  MisionServiceError,
  obtenerCoordenadasOpcionales,
} from '@/services/misionesService';
import type {
  MisionLocal,
  ReportePatrullaRecuperacionLocal,
  RecuperacionMisionDetalleLocal,
} from '@/types/offline';

export interface ReportarCierreRecuperacionInput {
  resumenCierre: string;
  consumos: Array<{
    recursoId: string;
    cantidadConsumida: number;
  }>;
  misionActual?: MisionLocal;
}

export interface ResultadoReporteCierreRecuperacion {
  mision: MisionLocal;
  enColaOffline: boolean;
  mensaje: string;
}

/**
 * Extrae la información del operativo de recuperación y su reporte de patrulla
 * desde `mision.datosAdicionales.recuperacion`.
 */
export function obtenerRecuperacionDeMision(
  mision?: MisionLocal | null
): RecuperacionMisionDetalleLocal | null {
  const rec = mision?.datosAdicionales?.recuperacion;
  if (!rec || typeof rec !== 'object') return null;
  return rec as RecuperacionMisionDetalleLocal;
}

/**
 * Envía el reporte de término de operativo de recuperación desde la patrulla en terreno
 * hacia `POST /api/misiones/{id}/reportar-cierre-recuperacion`, con soporte Offline-First.
 */
export async function reportarCierreRecuperacionTerreno(
  misionId: string,
  input: ReportarCierreRecuperacionInput
): Promise<ResultadoReporteCierreRecuperacion> {
  const resumenLimpio = input.resumenCierre.trim();
  if (resumenLimpio.length < 10) {
    throw new MisionServiceError(
      400,
      'El resumen de cierre debe tener al menos 10 caracteres.'
    );
  }

  const coordenadas = await obtenerCoordenadasOpcionales(4000);
  const body = {
    resumenCierre: resumenLimpio,
    consumos: input.consumos,
    ...(typeof coordenadas.latitud === 'number'
      ? { latitud: coordenadas.latitud }
      : {}),
    ...(typeof coordenadas.longitud === 'number'
      ? { longitud: coordenadas.longitud }
      : {}),
  };

  const misionBase =
    input.misionActual || (await obtenerMisionLocalPorId(misionId));

  const estaOffline =
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    navigator.onLine === false;

  const construirMisionActualizada = (
    reporte: ReportePatrullaRecuperacionLocal,
    pendienteSync: boolean
  ): MisionLocal => {
    const recPrevia = obtenerRecuperacionDeMision(misionBase) ?? {
      id: '',
      codigo: misionBase?.codigoIncidente || 'REC',
      estado: 'EN_EJECUCION',
      sector: misionBase?.direccion || 'Valdivia',
      recursos: [],
    };

    return {
      ...(misionBase || {
        id: misionId,
        incidenteId: '',
        codigoIncidente: misionId,
        tipoMision: 'RECUPERACION',
        tipologia: 'Recuperación operativa',
        direccion: 'Valdivia',
        prioridad: 'MEDIA',
        estado: 'EN_CURSO',
        fechaDespacho: new Date().toISOString(),
        actualizadoEn: new Date().toISOString(),
      }),
      sincronizacionPendiente: pendienteSync,
      actualizadoEn: new Date().toISOString(),
      datosAdicionales: {
        ...(misionBase?.datosAdicionales || {}),
        recuperacion: {
          ...recPrevia,
          reportePatrulla: reporte,
        },
      },
    };
  };

  if (!estaOffline) {
    try {
      const { data, error, response } = await apiClient.POST(
        '/api/misiones/{id}/reportar-cierre-recuperacion',
        {
          params: { path: { id: misionId } },
          body,
        }
      );

      if (!error && data?.data) {
        const misionActualizada = construirMisionActualizada(
          data.data.reportePatrulla,
          false
        );
        await guardarMisionLocal(misionActualizada);

        return {
          mision: misionActualizada,
          enColaOffline: false,
          mensaje:
            data.message ||
            'Reporte de cierre enviado al Centro de Mando. Pendiente de confirmación formal.',
        };
      }

      const status = response?.status ?? 500;
      const errMsg =
        (error as { message?: string } | undefined)?.message ||
        'No fue posible enviar el reporte de cierre.';

      if (status >= 400 && status < 500) {
        throw new MisionServiceError(status, errMsg);
      }
    } catch (err) {
      if (err instanceof MisionServiceError) {
        throw err;
      }
    }
  }

  // Fallback Offline-First: encolar en IndexedDB
  await encolarAccionOutbox({
    tipo: 'REPORTAR_CIERRE_RECUPERACION',
    url: `/api/misiones/${misionId}/reportar-cierre-recuperacion`,
    metodo: 'POST',
    payload: body,
  });

  const reporteOffline: ReportePatrullaRecuperacionLocal = {
    resumen: resumenLimpio,
    consumos: input.consumos,
    reportadoEn: new Date().toISOString(),
    reportadoPor: null,
  };
  const misionOffline = construirMisionActualizada(reporteOffline, true);
  await guardarMisionLocal(misionOffline);

  return {
    mision: misionOffline,
    enColaOffline: true,
    mensaje:
      'Sin conexión: Reporte de cierre guardado localmente y encolado para envío automático al recuperar señal.',
  };
}
