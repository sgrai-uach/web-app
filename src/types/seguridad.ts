/**
 * Tipos de Seguridad, Autenticación y RBAC para sgrai-pwa (Terreno).
 */

import type { components } from './api-generated';

export const ROLES_TERRENO_PERMITIDOS = [
  'PATRULLA_VERIFICADORA',
  'DELEGADO_CUADRILLA',
] as const;

export type RolTerreno = (typeof ROLES_TERRENO_PERMITIDOS)[number];

export function esRolTerrenoPermitido(rolCodigo?: string | null): boolean {
  if (!rolCodigo) return false;
  return ROLES_TERRENO_PERMITIDOS.includes(rolCodigo.toUpperCase() as RolTerreno);
}

export type LoginRequest = components['schemas']['LoginRequest'];
export type LoginResponseData = components['schemas']['LoginData'];
export type LoginResponse = components['schemas']['LoginResponse'];
export type UsuarioActivoDetalle = components['schemas']['UsuarioActivoItem'];
export type UsuarioPerfilSesion = components['schemas']['UsuarioPerfilSesion'];

export type EstadoAsignacionUnidad = 'ACTIVA' | 'DESACTIVADA' | 'SIN_ASIGNACION';

export interface HistorialUnidadOperador {
  unidadId: string;
  nombre: string;
  tipoUnidad: 'PATRULLA' | 'CUADRILLA';
  fechaPrimerRegistro: string;
  ultimaVezVisto: string;
  estadoAlMomento: 'ACTIVA' | 'DESACTIVADA';
  delegacion?: string | null;
}
