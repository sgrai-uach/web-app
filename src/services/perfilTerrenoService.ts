import { sincronizarMisiones } from './misionesService';
import { guardarCatalogoLocal, obtenerCatalogoLocal } from './offlineQueue';
import type {
  UsuarioPerfilSesion,
  HistorialUnidadOperador,
} from '@/types/seguridad';

export interface MetricasPerfilTerreno {
  misionesAtendidas: number;
  misionesEnCurso: number;
  misionesPendientes: number;
  totalMisiones: number;
  especialidad: string;
}

const HISTORIAL_CATALOGO_PREFIJO = 'historial_unidades_';

/**
 * Registra o actualiza en almacenamiento persistente (IndexedDB / LocalStorage)
 * la patrulla o cuadrilla a la que el usuario ha estado asignado.
 */
export async function registrarPatrullaEnHistorial(
  usuario: UsuarioPerfilSesion | null
): Promise<void> {
  if (!usuario || !usuario.unidadId || !usuario.unidadNombre) {
    return;
  }

  const clave = `${HISTORIAL_CATALOGO_PREFIJO}${usuario.id}`;
  const esCuadrilla = usuario.rolCodigo?.toUpperCase() === 'DELEGADO_CUADRILLA';
  const tipoUnidad = esCuadrilla ? 'CUADRILLA' : 'PATRULLA';
  const ahora = new Date().toISOString();

  let historial: HistorialUnidadOperador[] = [];
  try {
    const existentes = await obtenerCatalogoLocal<HistorialUnidadOperador>(clave);
    if (existentes && Array.isArray(existentes)) {
      historial = existentes;
    }
  } catch {
    // Si falla IndexedDB, intentar con localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const guardado = window.localStorage.getItem(clave);
        if (guardado) historial = JSON.parse(guardado);
      } catch {
        // Ignorar
      }
    }
  }

  const index = historial.findIndex(
    (item) => item.unidadId === usuario.unidadId || item.nombre === usuario.unidadNombre
  );

  const estadoMomento = usuario.unidadActiva === true ? 'ACTIVA' : 'DESACTIVADA';

  if (index >= 0) {
    historial[index] = {
      ...historial[index],
      unidadId: usuario.unidadId,
      nombre: usuario.unidadNombre,
      ultimaVezVisto: ahora,
      estadoAlMomento: estadoMomento,
    };
  } else {
    historial.unshift({
      unidadId: usuario.unidadId,
      nombre: usuario.unidadNombre,
      tipoUnidad,
      fechaPrimerRegistro: ahora,
      ultimaVezVisto: ahora,
      estadoAlMomento: estadoMomento,
    });
  }

  try {
    await guardarCatalogoLocal(clave, historial);
  } catch {
    // Fallback a localStorage
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(clave, JSON.stringify(historial));
    } catch {
      // Ignorar excepciones de cuota
    }
  }
}

/**
 * Obtiene el historial consolidado de patrullas a las que alguna vez estuvo asignado el funcionario.
 */
export async function obtenerHistorialUnidades(
  usuarioId: string
): Promise<HistorialUnidadOperador[]> {
  if (!usuarioId) return [];

  const clave = `${HISTORIAL_CATALOGO_PREFIJO}${usuarioId}`;

  try {
    const catalogo = await obtenerCatalogoLocal<HistorialUnidadOperador>(clave);
    if (catalogo && Array.isArray(catalogo) && catalogo.length > 0) {
      return catalogo.sort(
        (a, b) => new Date(b.ultimaVezVisto).getTime() - new Date(a.ultimaVezVisto).getTime()
      );
    }
  } catch {
    // Continuar con localStorage
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const guardado = window.localStorage.getItem(clave);
      if (guardado) {
        const parseado: HistorialUnidadOperador[] = JSON.parse(guardado);
        return parseado.sort(
          (a, b) => new Date(b.ultimaVezVisto).getTime() - new Date(a.ultimaVezVisto).getTime()
        );
      }
    } catch {
      // Retornar vacío
    }
  }

  return [];
}


/**
 * Calcula estadísticas operativas del operador en terreno a partir de la base de datos local
 * y determina la especialidad técnica en lenguaje natural.
 */
export async function obtenerMetricasPerfil(
  usuario: UsuarioPerfilSesion | null,
  esCuadrilla: boolean
): Promise<MetricasPerfilTerreno> {
  let misionesAtendidas = 0;
  let misionesEnCurso = 0;
  let misionesPendientes = 0;
  let totalMisiones = 0;

  try {
    const misiones = await sincronizarMisiones({
      tipoMision: esCuadrilla ? 'ATENCION_CUADRILLA' : 'VERIFICACION',
    });

    totalMisiones = misiones.length;

    for (const m of misiones) {
      const estado = m.estado?.toUpperCase() || '';
      if (estado === 'FINALIZADA' || estado === 'COMPLETADA' || estado === 'CERRADA') {
        misionesAtendidas++;
      } else if (estado === 'EN_CURSO' || estado === 'EN_TERRENO' || estado === 'EN_RUTA') {
        misionesEnCurso++;
      } else if (estado === 'ASIGNADA' || estado === 'DESPACHADA' || estado === 'PENDIENTE') {
        misionesPendientes++;
      }
    }
  } catch {
    // Si no hay acceso a almacenamiento local, retorna ceros
  }

  // Especialidad técnica en lenguaje natural
  let especialidad = 'Operaciones de Terreno y Triage Primario';
  if (esCuadrilla) {
    especialidad = 'Cuadrilla de Respuesta Operativa y Despeje';
  }

  return {
    misionesAtendidas,
    misionesEnCurso,
    misionesPendientes,
    totalMisiones,
    especialidad,
  };
}
