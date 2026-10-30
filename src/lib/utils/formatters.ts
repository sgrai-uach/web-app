/**
 * Utilidades de formateo para convertir códigos/enums técnicos a lenguaje natural legible por humanos.
 * Regla de accesibilidad y diseño de terreno SGRAI.
 */

/**
 * Convierte un código o enum de estado operativo a formato de lenguaje natural.
 * Ej: 'DISPONIBLE' -> 'Disponible', 'EN_CURSO' -> 'En curso', 'FINALIZADA' -> 'Finalizada'.
 */
export function formatearEstado(estado?: string | null): string {
  if (!estado) return '';
  const normalizado = estado.trim().toUpperCase();

  switch (normalizado) {
    case 'DISPONIBLE':
      return 'Disponible';
    case 'EN_CURSO':
      return 'En curso';
    case 'ASIGNADA':
      return 'Asignada';
    case 'FINALIZADA':
      return 'Finalizada';
    case 'CANCELADA':
      return 'Cancelada';
    case 'RECHAZADA':
      return 'Rechazada';
    case 'PLANIFICADA':
      return 'Planificada';
    case 'DESPACHADA':
      return 'Despachada';
    case 'EN_RUTA':
      return 'En ruta';
    case 'EN_TERRENO':
      return 'En terreno';
    case 'NO_DISPONIBLE':
      return 'No disponible';
    case 'EN_MANTENCION':
      return 'En mantención';
    default:
      return estado.charAt(0).toUpperCase() + estado.slice(1).toLowerCase().replace(/_/g, ' ');
  }
}

/**
 * Convierte un código o enum de prioridad a formato de lenguaje natural.
 * Ej: 'CRITICA' -> 'Crítica', 'ALTA' -> 'Alta', 'MEDIA' -> 'Media', 'BAJA' -> 'Baja'.
 */
export function formatearPrioridad(prioridad?: string | null): string {
  if (!prioridad) return '';
  const normalizado = prioridad.trim().toUpperCase();

  switch (normalizado) {
    case 'CRITICA':
      return 'Crítica';
    case 'ALTA':
      return 'Alta';
    case 'MEDIA':
      return 'Media';
    case 'BAJA':
      return 'Baja';
    default:
      return prioridad.charAt(0).toUpperCase() + prioridad.slice(1).toLowerCase();
  }
}
