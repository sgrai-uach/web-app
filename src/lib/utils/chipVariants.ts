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

export function obtenerVarianteChipEstadoTerreno(estado?: string | null): ChipVariant {
  const norm = (estado || '').trim().toUpperCase();
  switch (norm) {
    case 'FINALIZADO':
    case 'CONTROLADO':
      return 'success';
    case 'ESTABLE':
      return 'info';
    case 'REQUIERE_SEGUIMIENTO':
      return 'warning';
    case 'CRITICO':
    case 'CRÍTICO':
    case 'INACCESIBLE':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function obtenerVarianteChipTipoMision(tipoMision?: string | null): ChipVariant {
  const norm = (tipoMision || '').trim().toUpperCase();
  switch (norm) {
    case 'PREVENCION':
      return 'teal';
    case 'VERIFICACION':
    case 'ASISTENCIA_SOCIAL':
      return 'info';
    case 'ATENCION_CUADRILLA':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function obtenerVarianteChipEstadoPatrulla(estado?: string | null): ChipVariant {
  const norm = (estado || '').trim().toUpperCase();
  switch (norm) {
    case 'DISPONIBLE':
      return 'success';
    case 'EN_PREVENCION':
      return 'teal';
    case 'EN_VERIFICACION':
    case 'EN_MISION':
      return 'warning';
    case 'EN_RECUPERACION':
      return 'info';
    case 'NO_DISPONIBLE':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function obtenerVarianteChipEstadoRecurso(estado?: string | null): ChipVariant {
  const norm = (estado || '').trim().toUpperCase();
  switch (norm) {
    case 'DISPONIBLE':
      return 'success';
    case 'BAJO_STOCK':
      return 'warning';
    case 'ASIGNADO':
      return 'info';
    case 'EN_MANTENCION':
    case 'NO_DISPONIBLE':
      return 'danger';
    default:
      return 'neutral';
  }
}

