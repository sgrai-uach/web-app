/**
 * Utilidades de formateo para convertir códigos/enums técnicos a lenguaje natural legible por humanos.
 * Regla de accesibilidad y diseño de terreno SGRAI.
 */

import {
  formatearEtiquetaSegura,
  ETIQUETAS_ESTADO,
  ETIQUETAS_PRIORIDAD,
  ETIQUETAS_TIPOLOGIA,
  ETIQUETAS_ROL,
  limpiarTituloMision,
} from './labels';

export { limpiarTituloMision };

/**
 * Convierte un código o enum de estado operativo a formato de lenguaje natural.
 * Ej: 'DISPONIBLE' -> 'Disponible', 'EN_CURSO' -> 'En curso', 'FINALIZADA' -> 'Finalizada'.
 */
export function formatearEstado(estado?: string | null): string {
  return formatearEtiquetaSegura(estado, ETIQUETAS_ESTADO);
}

/**
 * Convierte un código o enum de prioridad a formato de lenguaje natural.
 * Ej: 'CRITICA' -> 'Crítica', 'ALTA' -> 'Alta', 'MEDIA' -> 'Media', 'BAJA' -> 'Baja'.
 */
export function formatearPrioridad(prioridad?: string | null): string {
  return formatearEtiquetaSegura(prioridad, ETIQUETAS_PRIORIDAD);
}

/**
 * Convierte un código de tipología a lenguaje natural.
 */
export function formatearTipologia(tipologia?: string | null): string {
  return formatearEtiquetaSegura(tipologia, ETIQUETAS_TIPOLOGIA);
}

/**
 * Convierte un código de rol institucional a formato legible.
 */
export function formatearRol(rol?: string | null): string {
  return formatearEtiquetaSegura(rol, ETIQUETAS_ROL);
}

/**
 * Formatea fechas y timestamps en formato de 24 horas y sin segundos ("DD-MM-YYYY HH:mm").
 * Ejemplo: "30-10-2026 01:07".
 */
export function formatearFechaHora24h(fecha?: string | Date | null): string {
  if (!fecha) return 'Sin fecha';
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  if (isNaN(d.getTime())) return 'Fecha inválida';

  const pad = (n: number) => String(n).padStart(2, '0');
  const dia = pad(d.getDate());
  const mes = pad(d.getMonth() + 1);
  const anio = d.getFullYear();
  const horas = pad(d.getHours());
  const minutos = pad(d.getMinutes());

  return `${dia}-${mes}-${anio} ${horas}:${minutos}`;
}
