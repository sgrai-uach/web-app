import { z } from 'zod';
import apiClient from '@/lib/api/client';
import {
  guardarCatalogoLocal,
  obtenerCatalogoLocal,
  encolarAccionOutbox,
  guardarMisionLocal,
} from '@/services/offlineQueue';
import {
  reclasificarTipologiaSchema,
  type ReclasificarTipologiaInput,
} from '@/lib/validations/tipologia';
import type {
  TipoIncidenteCatalogoItem,
  MisionLocal,
  ReclasificarTipologiaPayload,
} from '@/types/offline';

export const CLAVE_CATALOGO_TIPOS = 'tipos_incidente';

const uuidSchema = z.string().uuid({
  message: 'El identificador del incidente debe ser un UUID válido.',
});

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Catálogo oficial de contingencia sincronizado 1:1 con los 11 registros activos
 * de la tabla `tipo_incidente` en PostgreSQL (migración 003_catalogos_informante_avisos).
 */
export const CATALOGO_TIPOS_PREDETERMINADO: TipoIncidenteCatalogoItem[] = [
  {
    id: '40000000-0000-4000-8000-000000000001',
    nombre: 'Inundación',
    descripcion: 'Acumulación desmedida de agua por crecida de ríos o lluvias torrenciales',
    activo: true,
  },
  {
    id: '40000000-0000-4000-8000-000000000002',
    nombre: 'Deslizamiento de tierra',
    descripcion: 'Movimiento de masa de suelo o laderas en zonas de riesgo',
    activo: true,
  },
  {
    id: '40000000-0000-4000-8000-000000000003',
    nombre: 'Caída de árbol',
    descripcion: 'Obstrucción de vías o afectación a viviendas y tendido eléctrico por caída de árboles',
    activo: true,
  },
  {
    id: '40000000-0000-4000-8000-000000000004',
    nombre: 'Anegamiento de calzada',
    descripcion: 'Saturación de sumideros y acumulación de aguas lluvias en vías públicas',
    activo: true,
  },
  {
    id: '40000000-0000-4000-8000-000000000005',
    nombre: 'Incendio estructural / forestal',
    descripcion: 'Focos de fuego en estructuras o vegetación urbana/rural',
    activo: true,
  },
  {
    id: '40000000-0000-4000-8000-000000000006',
    nombre: 'Otro',
    descripcion: 'Cualquier otro incidente que requiera atención de emergencia municipal',
    activo: true,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000001',
    nombre: 'Anegamiento',
    descripcion: 'Acumulación de aguas lluvias en vías o propiedades',
    activo: true,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000003',
    nombre: 'Corte de energía',
    descripcion: 'Interrupción del suministro eléctrico o peligro por cables caídos',
    activo: true,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000004',
    nombre: 'Deslizamiento',
    descripcion: 'Movimiento de laderas, socavón o remoción de terreno',
    activo: true,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000005',
    nombre: 'Daño estructural',
    descripcion: 'Colapso parcial o daño grave en techumbre, muros o edificaciones',
    activo: true,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000006',
    nombre: 'Corte de agua potable',
    descripcion: 'Corte o rotura matriz en la red de agua potable',
    activo: true,
  },
];

function isCatalogoItem(item: unknown): item is TipoIncidenteCatalogoItem {
  return (
    typeof item === 'object' &&
    item !== null &&
    'id' in item &&
    'nombre' in item &&
    typeof (item as TipoIncidenteCatalogoItem).id === 'string' &&
    typeof (item as TipoIncidenteCatalogoItem).nombre === 'string'
  );
}

/**
 * Resuelve el nombre de una tipología desde IndexedDB o catálogo predeterminado
 * sin disparar peticiones HTTP redundantes.
 */
async function resolverNombreTipologiaLocal(tipoIncidenteId: string): Promise<string> {
  try {
    const guardados = await obtenerCatalogoLocal<TipoIncidenteCatalogoItem>(CLAVE_CATALOGO_TIPOS);
    if (guardados && Array.isArray(guardados)) {
      const encontrado = guardados.find((t) => t.id === tipoIncidenteId);
      if (encontrado?.nombre) return encontrado.nombre;
    }
  } catch {
    // Continuar con catálogo predeterminado
  }

  const predeterminado = CATALOGO_TIPOS_PREDETERMINADO.find((t) => t.id === tipoIncidenteId);
  return predeterminado?.nombre || 'Reclasificada';
}

/**
 * Obtiene el catálogo oficial de tipos de incidente (HU-37).
 * Consulta la API vía `apiClient` y persiste el resultado en IndexedDB.
 * En caso de corte de red, lee la copia local de IndexedDB o utiliza el catálogo predeterminado.
 */
export async function obtenerCatalogoTiposIncidente(): Promise<TipoIncidenteCatalogoItem[]> {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  if (isOnline) {
    try {
      const { data, error } = await apiClient.GET('/api/incidentes/tipos', {
        params: {
          query: { catalogo: 'true' },
        },
      });

      if (!error && data && Array.isArray(data.data)) {
        const items = data.data.filter(isCatalogoItem);
        if (items.length > 0) {
          const activos = items.filter((t) => t.activo !== false);
          try {
            await guardarCatalogoLocal(CLAVE_CATALOGO_TIPOS, activos);
          } catch {
            // Ignorar fallo de almacenamiento si IndexedDB está bloqueado
          }
          return activos;
        }
      }
    } catch {
      // Continuar al fallback local en caso de error de red
    }
  }

  try {
    const guardados = await obtenerCatalogoLocal<TipoIncidenteCatalogoItem>(CLAVE_CATALOGO_TIPOS);
    if (guardados && Array.isArray(guardados) && guardados.length > 0) {
      return guardados.filter((t) => t.activo !== false);
    }
  } catch {
    // Si no está disponible IndexedDB, recurrir a catálogo predeterminado
  }

  return CATALOGO_TIPOS_PREDETERMINADO;
}

export interface ResultadoReclasificacionTipologia {
  ok: boolean;
  offline: boolean;
  mensaje: string;
  mision?: MisionLocal;
  data?: unknown;
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
 * Reclasifica la tipología del incidente tras la evaluación presencial en terreno (HU-37).
 * Valida `incidenteId` como UUID, sanea `misionId` antes del parse Zod y valida que la
 * justificación cumpla >= 5 caracteres en reclasificaciones.
 */
export async function reclasificarTipologiaEnTerreno(
  incidenteId: string,
  input: ReclasificarTipologiaInput,
  misionActual?: MisionLocal
): Promise<ResultadoReclasificacionTipologia> {
  const incidenteIdValido = uuidSchema.parse(incidenteId);

  const misionIdCandidato = input.misionId ?? misionActual?.id;
  const misionIdLimpio =
    typeof misionIdCandidato === 'string' && UUID_REGEX.test(misionIdCandidato)
      ? misionIdCandidato
      : undefined;

  const validado = reclasificarTipologiaSchema.parse({
    ...input,
    misionId: misionIdLimpio,
  });

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const nuevoNombre = await resolverNombreTipologiaLocal(validado.tipoIncidenteId);

  const justificacionFinal =
    validado.justificacion && validado.justificacion.trim().length >= 5
      ? validado.justificacion.trim()
      : 'Tipología constatada y ratificada en terreno sin variaciones.';

  const payloadMutacion: ReclasificarTipologiaPayload = {
    tipoIncidenteId: validado.tipoIncidenteId,
    justificacion: justificacionFinal,
    ...(validado.misionId ? { misionId: validado.misionId } : {}),
  };

  if (!isOnline) {
    await encolarAccionOutbox({
      tipo: 'ACTUALIZAR_TIPOLOGIA',
      url: `/api/incidentes/${incidenteIdValido}/tipologia`,
      metodo: 'PATCH',
      payload: payloadMutacion as Record<string, unknown>,
    });

    let misionActualizada: MisionLocal | undefined = undefined;
    if (misionActual) {
      misionActualizada = {
        ...misionActual,
        tipologia: nuevoNombre,
        sincronizacionPendiente: true,
        actualizadoEn: new Date().toISOString(),
        datosAdicionales: {
          ...misionActual.datosAdicionales,
          tipologiaEvaluada: true,
          tipoIncidenteId: validado.tipoIncidenteId,
          justificacionTipologia: justificacionFinal,
          fechaEvaluacionTipologia: new Date().toISOString(),
          esReclasificacion: Boolean(validado.esCambio),
        },
      };
      await guardarMisionLocal(misionActualizada);
    }

    return {
      ok: true,
      offline: true,
      mensaje:
        'Tipología guardada localmente. Se sincronizará automáticamente al recuperar la conexión.',
      mision: misionActualizada,
    };
  }

  try {
    const { data, error, response } = await apiClient.PATCH(
      '/api/incidentes/{id}/tipologia',
      {
        params: {
          path: { id: incidenteIdValido },
        },
        body: payloadMutacion,
      }
    );

    if (!error && data) {
      const tipologiaServidor = data.data?.incidente?.tipoAfectacion || nuevoNombre;

      let misionActualizada: MisionLocal | undefined = undefined;
      if (misionActual) {
        misionActualizada = {
          ...misionActual,
          tipologia: tipologiaServidor,
          sincronizacionPendiente: false,
          actualizadoEn: data.data?.incidente?.actualizadoEn || new Date().toISOString(),
          datosAdicionales: {
            ...misionActual.datosAdicionales,
            tipologiaEvaluada: true,
            tipoIncidenteId: validado.tipoIncidenteId,
            justificacionTipologia: justificacionFinal,
            fechaEvaluacionTipologia: new Date().toISOString(),
            esReclasificacion: Boolean(validado.esCambio),
            hitoReclasificacion: data.data?.hito,
          },
        };
        await guardarMisionLocal(misionActualizada);
      }

      return {
        ok: true,
        offline: false,
        mensaje:
          data.message || 'Tipología del incidente reclasificada exitosamente en terreno.',
        mision: misionActualizada,
        data: data.data,
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
          'No posee los permisos requeridos (misiones:terreno:verificar) para reclasificar la tipología.'
        )
      );
    }

    if (status === 409) {
      throw new Error(
        extraerMensajeError(
          error,
          'La misión debe haber sido aceptada previamente (en curso) para reclasificar su tipología.'
        )
      );
    }

    throw new Error(
      extraerMensajeError(
        error,
        `Error del servidor (${status}) al reclasificar la tipología.`
      )
    );
  } catch (err) {
    if (err instanceof TypeError || (err instanceof Error && err.message.includes('fetch'))) {
      await encolarAccionOutbox({
        tipo: 'ACTUALIZAR_TIPOLOGIA',
        url: `/api/incidentes/${incidenteIdValido}/tipologia`,
        metodo: 'PATCH',
        payload: payloadMutacion as Record<string, unknown>,
      });

      let misionActualizada: MisionLocal | undefined = undefined;
      if (misionActual) {
        misionActualizada = {
          ...misionActual,
          tipologia: nuevoNombre,
          sincronizacionPendiente: true,
          actualizadoEn: new Date().toISOString(),
          datosAdicionales: {
            ...misionActual.datosAdicionales,
            tipologiaEvaluada: true,
            tipoIncidenteId: validado.tipoIncidenteId,
            justificacionTipologia: justificacionFinal,
            fechaEvaluacionTipologia: new Date().toISOString(),
            esReclasificacion: Boolean(validado.esCambio),
          },
        };
        await guardarMisionLocal(misionActualizada);
      }

      return {
        ok: true,
        offline: true,
        mensaje:
          'Fallo de conexión: Tipología guardada localmente. Se sincronizará automáticamente al recuperar la señal.',
        mision: misionActualizada,
      };
    }

    throw err;
  }
}
