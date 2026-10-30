import { sincronizarMisiones } from './misionesService';
import type { UsuarioPerfilSesion } from '@/types/seguridad';

export interface MetricasPerfilTerreno {
  misionesAtendidas: number;
  misionesEnCurso: number;
  misionesPendientes: number;
  totalMisiones: number;
  especialidad: string;
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
