import type { ChipVariant } from '@/components/ui/Chip';

/**
 * Mapeo semántico canónico para que un mismo estado o prioridad tenga
 * exactamente el mismo color de chip en sgrai-web y sgrai-pwa.
 */
export function obtenerVarianteChipEstadoIncidente(estado?: string | null): ChipVariant {
  const norm = (estado || '').trim().toUpperCase();
  switch (norm) {
    case 'REPORTADO':
      return 'neutral';
    case 'VERIFICANDO':
      return 'info';
    case 'EN_ATENCION':
      return 'warning';
    case 'RESUELTO':
      return 'success';
    case 'NO_ABORDABLE':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function obtenerVarianteChipEstadoMision(estado?: string | null): ChipVariant {
  const norm = (estado || '').trim().toUpperCase();
  switch (norm) {
    case 'DESPACHADA':
    case 'ASIGNADA':
      return 'teal';
    case 'EN_CURSO':
    case 'EN_RUTA':
    case 'EN_TERRENO':
    case 'EN_PROCESO':
      return 'warning';
    case 'COMPLETADA':
    case 'FINALIZADA':
    case 'CERRADA':
      return 'success';
    case 'RECHAZADA':
    case 'CANCELADA':
      return 'danger';
    case 'PLANIFICADA':
    default:
      return 'neutral';
  }
}

export function obtenerVarianteChipPrioridad(prioridad?: string | null): ChipVariant {
  const norm = (prioridad || '').trim().toUpperCase();
  switch (norm) {
    case 'BAJA':
      return 'success';
    case 'MEDIA':
      return 'info';
    case 'ALTA':
      return 'warning';
    case 'CRITICA':
    case 'CRÍTICA':
      return 'danger';
    default:
      return 'neutral';
  }
}

