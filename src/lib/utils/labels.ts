/**
 * Módulo único y tipado de etiquetas de lenguaje natural para SGRAI PWA.
 * Regla UX: Ningún enum crudo ni valor interno debe exponerse en pantalla.
 */

export const ETIQUETAS_ESTADO: Record<string, string> = {
  PLANIFICADA: 'Planificada',
  DESPACHADA: 'Despachada',
  ASIGNADA: 'Asignada',
  EN_RUTA: 'En ruta',
  EN_TERRENO: 'En terreno',
  EN_CURSO: 'En curso',
  EN_PROCESO: 'En proceso',
  COMPLETADA: 'Finalizada',
  FINALIZADA: 'Finalizada',
  CERRADA: 'Cerrada',
  CANCELADA: 'Cancelada',
  RECHAZADA: 'Rechazada',
  DISPONIBLE: 'Disponible',
  NO_DISPONIBLE: 'No disponible',
  EN_MANTENCION: 'En mantención',
};

export const ETIQUETAS_PRIORIDAD: Record<string, string> = {
  CRITICA: 'Crítica',
  ALTA: 'Alta',
  MEDIA: 'Media',
  BAJA: 'Baja',
};

export const ETIQUETAS_TIPOLOGIA: Record<string, string> = {
  CAIDA_ARBOL: 'Caída de árbol',
  ANEGAMIENTO: 'Anegamiento',
  INUNDACION_VIAL: 'Inundación vial',
  DESLIZAMIENTO: 'Deslizamiento',
  CORTE_SUMINISTRO: 'Corte de suministro',
  POSTE_DANIADO: 'Poste dañado',
  COLAPSO_ESTRUCTURAL: 'Colapso estructural',
  ACCIDENTE_TRANSITO: 'Accidente de tránsito',
  INCENDIO_ESTRUCTURAL: 'Incendio estructural',
  INCENDIO_FORESTAL: 'Incendio forestal',
  DERRUMBE: 'Derrumbe',
  MICROBASURAL: 'Microbasural',
  OTRO: 'Otro incidente',
};

export const ETIQUETAS_ROL: Record<string, string> = {
  PATRULLA_VERIFICADORA: 'Patrulla Verificadora',
  DELEGADO_CUADRILLA: 'Delegado de Cuadrilla',
  ENCARGADO: 'Encargado',
  ADMIN: 'Administrador',
  ADMINISTRADOR: 'Administrador',
  CALL_CENTER: 'Call Center',
  SUPERVISOR: 'Supervisor',
};

export const ETIQUETAS_TIPO_MISION: Record<string, string> = {
  VERIFICACION: 'Verificación de terreno',
  ATENCION_CUADRILLA: 'Faena de cuadrilla',
  PREVENCION: 'Prevención territorial',
  RECUPERACION: 'Recuperación operativa',
  ASISTENCIA_SOCIAL: 'Asistencia social',
};

/**
 * Convierte un código o enum a texto legible en español natural con respaldo seguro.
 * Nunca muestra valores crudos en mayúsculas ni con guiones bajos.
 */
export function formatearEtiquetaSegura(
  valor?: string | null,
  diccionario?: Record<string, string>
): string {
  if (!valor) return '';
  const limpio = valor.trim();
  if (!limpio) return '';

  const normalizado = limpio.toUpperCase().replace(/\s+/g, '_');

  if (diccionario && diccionario[normalizado]) {
    return diccionario[normalizado];
  }

  // Búsqueda en los diccionarios canónicos del sistema
  if (ETIQUETAS_ESTADO[normalizado]) return ETIQUETAS_ESTADO[normalizado];
  if (ETIQUETAS_PRIORIDAD[normalizado]) return ETIQUETAS_PRIORIDAD[normalizado];
  if (ETIQUETAS_TIPOLOGIA[normalizado]) return ETIQUETAS_TIPOLOGIA[normalizado];
  if (ETIQUETAS_ROL[normalizado]) return ETIQUETAS_ROL[normalizado];
  if (ETIQUETAS_TIPO_MISION[normalizado]) return ETIQUETAS_TIPO_MISION[normalizado];

  // Respaldo seguro: reemplaza guiones bajos por espacios y deja la primera letra en mayúscula
  const sinGuiones = limpio.replace(/_/g, ' ').toLowerCase();
  return sinGuiones.charAt(0).toUpperCase() + sinGuiones.slice(1);
}

/**
 * Obtiene la etiqueta en lenguaje natural para un rol institucional.
 */
export function formatRolLabel(rol?: string | null): string {
  return formatearEtiquetaSegura(rol, ETIQUETAS_ROL);
}

/**
 * Limpia prefijos técnicos de títulos generados ("Triage Caída de árbol..." -> "Caída de árbol...")
 */
export function limpiarTituloMision(titulo?: string | null): string {
  if (!titulo) return '';
  return titulo
    .replace(/^triage\s*[:\-–]?\s*/i, '')
    .replace(/^evaluaci[oó]n\s+(?:de\s+)?[:\-–]?\s*/i, '')
    .replace(/^verificaci[oó]n\s*[:\-–]?\s*/i, '')
    .replace(/\s*-\s*INC-[A-Z0-9-]+$/i, '')
    .trim();
}
