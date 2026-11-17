import { getAuthCookie } from '@/lib/utils/cookieUtils';
import { DEV_PATRULLA_TOKEN, DEV_PATRULLA_USER_ID, handleUnauthorizedSession } from '@/lib/api/client';
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
  EvaluadorReporteTerreno,
  TipoIncidenteCatalogoItem,
  MisionLocal,
} from '@/types/offline';

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
    const parsed: unknown = JSON.parse(raw);
    return extraerEvaluadorDeObjeto(parsed);
  } catch {
    return undefined;
  }
}

export const CLAVE_CATALOGO_TIPOS = 'tipos_incidente';

export const CATALOGO_TIPOS_PREDETERMINADO: TipoIncidenteCatalogoItem[] = [
  {
    id: '40000000-0000-4000-8000-000000000001',
    nombre: 'Inundación',
    descripcion: 'Acumulación desmedida de agua por crecida de ríos o lluvias torrenciales',
    activo: true,
  },
  {
    id: '40000000-0000-4000-8000-000000000002',
    nombre: 'Anegamiento de calzada',
    descripcion: 'Acumulación de aguas lluvia que obstaculiza el tránsito vehicular o peatonal',
    activo: true,
  },
  {
    id: '40000000-0000-4000-8000-000000000003',
    nombre: 'Caída de árbol',
    descripcion: 'Obstrucción de vías o afectación a viviendas y tendido eléctrico',
    activo: true,
  },
  {
    id: '40000000-0000-4000-8000-000000000004',
    nombre: 'Derrumbe / Remoción en masa',
    descripcion: 'Desprendimiento de ladera, deslizamiento de tierra o socavón en terreno',
    activo: true,
  },
  {
    id: '40000000-0000-4000-8000-000000000005',
    nombre: 'Incendio estructural',
    descripcion: 'Siniestro que compromete viviendas, recintos comunitarios o infraestructura',
    activo: true,
  },
  {
    id: '40000000-0000-4000-8000-000000000006',
    nombre: 'Desborde de cauce',
    descripcion: 'Aumento de caudal de ríos, esteros o canales que rebasa su lecho habitual',
    activo: true,
  },
  {
    id: '40000000-0000-4000-8000-000000000007',
    nombre: 'Corte de suministros críticos',
    descripcion: 'Interrupción masiva y prolongada de agua potable, electricidad o comunicaciones',
    activo: true,
  },
];

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

/**
 * Obtiene el catálogo oficial de tipos de incidente (HU-37).
 * Consulta la API y persiste el resultado en IndexedDB. En caso de corte de red,
 * lee la copia local de IndexedDB o utiliza el catálogo predeterminado de contingencia.
 */
export async function obtenerCatalogoTiposIncidente(): Promise<TipoIncidenteCatalogoItem[]> {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  if (isOnline) {
    try {
      const apiUrl = resolveApiUrl();
      const res = await fetch(`${apiUrl}/api/incidentes/tipos?catalogo=true`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders(),
        },
      });

      if (res.ok) {
        const body = (await res.json()) as { data?: TipoIncidenteCatalogoItem[] };
        if (body?.data && Array.isArray(body.data) && body.data.length > 0) {
          const activos = body.data.filter((t) => t.activo !== false);
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

  // Fallback offline a IndexedDB
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

/**
 * Reclasifica la tipología del incidente tras la evaluación presencial en terreno (HU-37).
 * Valida que la justificación cumpla >= 5 caracteres. En modo offline encola la mutación
 * en el outbox de IndexedDB para despacho posterior.
 */
export async function reclasificarTipologiaEnTerreno(
  incidenteId: string,
  input: ReclasificarTipologiaInput,
  misionActual?: MisionLocal
): Promise<ResultadoReclasificacionTipologia> {
  const validado = reclasificarTipologiaSchema.parse(input);
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // Resolver nombre de la nueva tipología desde catálogo en memoria o predeterminado
  let nuevoNombre = 'Reclasificada';
  try {
    const tipos = await obtenerCatalogoTiposIncidente();
    const encontrado = tipos.find((t) => t.id === validado.tipoIncidenteId);
    if (encontrado) nuevoNombre = encontrado.nombre;
  } catch {
    // Usar nombre genérico si no se resuelve
  }

  const justificacionFinal =
    validado.justificacion && validado.justificacion.trim().length >= 5
      ? validado.justificacion.trim()
      : 'Tipología constatada y ratificada en terreno sin variaciones.';

  const misionUuidValido =
    validado.misionId ||
    (misionActual?.id && /^[0-9a-fA-F-]{36}$/.test(misionActual.id)
      ? misionActual.id
      : undefined);

  const payloadMutacion = {
    tipoIncidenteId: validado.tipoIncidenteId,
    justificacion: justificacionFinal,
    misionId: misionUuidValido,
  };

  const ahoraIso = new Date().toISOString();
  const evaluadorSesion = obtenerEvaluadorSesionLocal();

  const construirYGuardarMision = async (opciones: {
    tipologiaNombre: string;
    pendienteSync: boolean;
    actualizadoEn?: string;
    fechaEvaluacion?: string;
    evaluador?: EvaluadorReporteTerreno;
    hitoReclasificacion?: unknown;
  }): Promise<MisionLocal | undefined> => {
    if (!misionActual) return undefined;
    const evaluadorFinal = opciones.evaluador ?? evaluadorSesion;
    const misionActualizada: MisionLocal = {
      ...misionActual,
      tipologia: opciones.tipologiaNombre,
      sincronizacionPendiente: opciones.pendienteSync,
      actualizadoEn: opciones.actualizadoEn || ahoraIso,
      datosAdicionales: {
        ...misionActual.datosAdicionales,
        tipologiaEvaluada: true,
        tipologiaConstatada: opciones.tipologiaNombre,
        tipoIncidenteId: validado.tipoIncidenteId,
        justificacionTipologia: justificacionFinal,
        fechaEvaluacionTipologia: opciones.fechaEvaluacion || ahoraIso,
        esReclasificacion: Boolean(validado.esCambio),
        ...(evaluadorFinal ? { evaluadorTipologia: evaluadorFinal } : {}),
        ...(opciones.hitoReclasificacion !== undefined
          ? { hitoReclasificacion: opciones.hitoReclasificacion }
          : {}),
      },
    };
    await guardarMisionLocal(misionActualizada);
    return misionActualizada;
  };

  if (!isOnline) {
    // FLUJO OFFLINE: Encolar en Outbox de IndexedDB
    await encolarAccionOutbox({
      tipo: 'ACTUALIZAR_TIPOLOGIA',
      url: `/api/incidentes/${incidenteId}/tipologia`,
      metodo: 'PATCH',
      payload: payloadMutacion,
    });

    const misionActualizada = await construirYGuardarMision({
      tipologiaNombre: nuevoNombre,
      pendienteSync: true,
    });

    return {
      ok: true,
      offline: true,
      mensaje:
        'Tipología guardada localmente. Se sincronizará automáticamente al recuperar la conexión.',
      mision: misionActualizada,
    };
  }

  // FLUJO ONLINE: Enviar petición PATCH a la API
  try {
    const apiUrl = resolveApiUrl();
    const res = await fetch(`${apiUrl}/api/incidentes/${incidenteId}/tipologia`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...buildAuthHeaders(),
      },
      body: JSON.stringify(payloadMutacion),
    });

    const body = await res.json().catch(() => ({}));

    if (res.ok) {
      const tipologiaServidor =
        body?.data?.incidente?.tipoAfectacion || nuevoNombre;
      const evaluadorRemoto =
        extraerEvaluadorDeObjeto(body?.data?.hito?.metadatos?.evaluador) ??
        extraerEvaluadorDeObjeto(body?.data?.hito?.registradoPor);

      const misionActualizada = await construirYGuardarMision({
        tipologiaNombre: tipologiaServidor,
        pendienteSync: false,
        actualizadoEn: body?.data?.incidente?.actualizadoEn || ahoraIso,
        fechaEvaluacion: body?.data?.hito?.creadoEn || ahoraIso,
        evaluador: evaluadorRemoto,
        hitoReclasificacion: body?.data?.hito,
      });

      return {
        ok: true,
        offline: false,
        mensaje: body?.message || 'Tipología del incidente reclasificada exitosamente en terreno.',
        mision: misionActualizada,
        data: body?.data,
      };
    }

    if (res.status === 401) {
      handleUnauthorizedSession();
      throw new Error('Sesión expirada o no autorizada.');
    }

    if (res.status === 403) {
      throw new Error(
        body?.message || 'No posee los permisos requeridos (misiones:terreno:verificar) para reclasificar la tipología.'
      );
    }

    if (res.status === 409) {
      throw new Error(
        body?.message || 'La misión debe haber sido aceptada previamente (en curso) para reclasificar su tipología.'
      );
    }

    throw new Error(
      body?.message || `Error del servidor (${res.status}) al reclasificar la tipología.`
    );
  } catch (err) {
    // Si ocurre un error de conectividad durante el fetch, registrar en cola offline
    if (err instanceof TypeError || (err instanceof Error && err.message.includes('fetch'))) {
      await encolarAccionOutbox({
        tipo: 'ACTUALIZAR_TIPOLOGIA',
        url: `/api/incidentes/${incidenteId}/tipologia`,
        metodo: 'PATCH',
        payload: payloadMutacion,
      });

      const misionActualizada = await construirYGuardarMision({
        tipologiaNombre: nuevoNombre,
        pendienteSync: true,
      });

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
