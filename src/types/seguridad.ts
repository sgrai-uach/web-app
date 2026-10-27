/**
 * Tipos de Seguridad, Autenticación y RBAC para sgrai-pwa (Terreno).
 */

export const ROLES_TERRENO_PERMITIDOS = [
  'PATRULLA_VERIFICADORA',
  'DELEGADO_CUADRILLA',
] as const;

export type RolTerreno = (typeof ROLES_TERRENO_PERMITIDOS)[number];

export function esRolTerrenoPermitido(rolCodigo?: string | null): boolean {
  if (!rolCodigo) return false;
  return ROLES_TERRENO_PERMITIDOS.includes(rolCodigo.toUpperCase() as RolTerreno);
}

export interface LoginRequest {
  identificador: string;
  password: string;
}

export interface UsuarioPerfilSesion {
  id: string;
  rut: string;
  nombre: string;
  email: string;
  rolId: string;
  rolNombre: string;
  rolCodigo: string;
  delegacionId: string | null;
  delegacionNombre: string | null;
  permisos: string[];
}

export interface LoginResponseData {
  token: string;
  expiraEn: string;
  usuario: UsuarioPerfilSesion;
}

export interface LoginResponse {
  data: LoginResponseData;
}

export interface UsuarioActivoDetalle {
  id: string;
  rut: string;
  nombre: string;
  apellido?: string | null;
  email: string;
  activo?: boolean;
  delegacionId?: string | null;
  delegacion?: {
    id: string;
    nombre: string;
  } | null;
  rol?: {
    id: string;
    nombre: string;
    codigo: string;
    permisos?: string[];
  } | null;
  permisos?: string[];
}
