'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  loginUsuario,
  obtenerUsuarioActivo,
  SeguridadServiceError,
} from '@/services/seguridadService';
import {
  setAuthCookie,
  getAuthCookie,
  removeAuthCookie,
} from '@/lib/utils/cookieUtils';
import type {
  LoginRequest,
  UsuarioPerfilSesion,
  UsuarioActivoDetalle,
} from '@/types/seguridad';
import { esRolTerrenoPermitido } from '@/types/seguridad';

const SESSION_PROFILE_KEY = 'sgrai_usuario_sesion';

const PERFIL_DEMO_PATRULLA: UsuarioPerfilSesion = {
  id: '00000000-0000-4000-8000-000000000004',
  rut: '12.345.678-5',
  nombre: 'Operador Patrulla Terreno',
  email: 'patrulla@valdivia.cl',
  rolId: 'rol-patrulla-01',
  rolNombre: 'Patrulla Verificadora',
  rolCodigo: 'PATRULLA_VERIFICADORA',
  delegacionId: 'del-01',
  delegacionNombre: 'Valdivia Norte',
  unidadNombre: 'Patrulla Rápida Costa-1',
  unidadActiva: true,
  permisos: ['misiones:terreno:verificar', 'misiones:terreno:reportar'],
};

function leerPerfilGuardado(): UsuarioPerfilSesion | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UsuarioPerfilSesion;
  } catch {
    return null;
  }
}

function guardarPerfilSesion(perfil: UsuarioPerfilSesion | null): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    if (!perfil) {
      window.sessionStorage.removeItem(SESSION_PROFILE_KEY);
    } else {
      window.sessionStorage.setItem(SESSION_PROFILE_KEY, JSON.stringify(perfil));
    }
  } catch {
    // Ignorar errores de almacenamiento
  }
}

export interface AuthContextValue {
  usuario: UsuarioPerfilSesion | null;
  token: string | null;
  cargando: boolean;
  autenticado: boolean;
  esPatrulla: boolean;
  esCuadrilla: boolean;
  unidadActiva: boolean;
  tienePermiso: (permiso: string) => boolean;
  tieneAlgunPermiso: (permisos: string[]) => boolean;
  login: (credenciales: LoginRequest) => Promise<UsuarioPerfilSesion>;
  logout: () => void;
  recargarSesion: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioPerfilSesion | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);

  const mapDetalleAUsuarioPerfil = useCallback(
    (detalle: UsuarioActivoDetalle): UsuarioPerfilSesion => {
      return {
        id: detalle.id,
        rut: detalle.rut,
        nombre: detalle.nombre,
        email: detalle.email,
        rolId: detalle.rol?.id || '',
        rolNombre: detalle.rol?.nombre || '',
        rolCodigo: detalle.rol?.codigo || '',
        delegacionId: detalle.delegacionId || detalle.delegacion?.id || null,
        delegacionNombre: detalle.delegacion?.nombre || null,
        permisos: Array.isArray(detalle.permisos)
          ? detalle.permisos
          : detalle.rol?.permisos || [],
      };
    },
    []
  );

  // Inicialización de sesión desde cookie al montar
  const recargarSesion = useCallback(async () => {
    const cookieToken = getAuthCookie();
    if (!cookieToken) {
      setUsuario(null);
      setToken(null);
      setCargando(false);
      return;
    }

    if (cookieToken === 'dev-patrulla-token') {
      const guardado = leerPerfilGuardado() || PERFIL_DEMO_PATRULLA;
      setToken(cookieToken);
      setUsuario(guardado);
      setCargando(false);
      return;
    }

    try {
      const detalle = await obtenerUsuarioActivo();
      const perfil = mapDetalleAUsuarioPerfil(detalle);

      if (!esRolTerrenoPermitido(perfil.rolCodigo)) {
        // No eliminar la cookie sgrai_auth_token para preservar la sesión activa en sgrai-web (/gestion)
        setUsuario(null);
        setToken(null);
        try {
          if (typeof window !== 'undefined' && window.location) {
            window.location.assign('/gestion');
          }
        } catch {
          // Ignorado en pruebas unitarias
        }
        return;
      }

      guardarPerfilSesion(perfil);
      setToken(cookieToken);
      setUsuario(perfil);
    } catch {
      const perfilRespaldo = leerPerfilGuardado();
      if (perfilRespaldo && esRolTerrenoPermitido(perfilRespaldo.rolCodigo)) {
        setToken(cookieToken);
        setUsuario(perfilRespaldo);
      } else {
        removeAuthCookie();
        guardarPerfilSesion(null);
        setUsuario(null);
        setToken(null);
      }
    } finally {
      setCargando(false);
    }
  }, [mapDetalleAUsuarioPerfil]);

  useEffect(() => {
    void recargarSesion();
  }, [recargarSesion]);

  const login = useCallback(
    async (credenciales: LoginRequest): Promise<UsuarioPerfilSesion> => {
      setCargando(true);
      try {
        const respuesta = await loginUsuario(credenciales);

        // Validación estricta de perfil de terreno
        if (!esRolTerrenoPermitido(respuesta.usuario.rolCodigo)) {
          throw new SeguridadServiceError(
            403,
            'Acceso restringido: Esta aplicación móvil está reservada exclusivamente para Patrulla Verificadora y Delegado de Cuadrilla. Para otros roles, acceda a través del portal web institucional.'
          );
        }

        setAuthCookie(respuesta.token, respuesta.expiraEn);
        guardarPerfilSesion(respuesta.usuario);
        setToken(respuesta.token);
        setUsuario(respuesta.usuario);
        return respuesta.usuario;
      } finally {
        setCargando(false);
      }
    },
    []
  );

  const logout = useCallback(() => {
    removeAuthCookie();
    guardarPerfilSesion(null);
    setUsuario(null);
    setToken(null);
    try {
      if (typeof window !== 'undefined' && window.location) {
        const target = window.location.pathname.startsWith('/terreno')
          ? '/terreno/login'
          : '/login';
        window.location.assign(target);
      }
    } catch {
      // Ignorado en pruebas unitarias
    }
  }, []);

  const rolCodigoActual = usuario?.rolCodigo?.toUpperCase() || '';
  const esPatrulla = rolCodigoActual === 'PATRULLA_VERIFICADORA';
  const esCuadrilla = rolCodigoActual === 'DELEGADO_CUADRILLA';
  const unidadActiva = usuario?.unidadActiva !== false;
  const autenticado = Boolean(token && usuario);

  const tienePermiso = useCallback(
    (permiso: string): boolean => {
      if (!usuario) return false;
      const listaPermisos = usuario.permisos || [];
      if (listaPermisos.includes('*') || listaPermisos.includes(permiso)) {
        return true;
      }
      // Fallback por rol canónico de terreno cuando el token o mock no desglosa permisos granulares
      if (
        esPatrulla &&
        (permiso.startsWith('patrulla:') ||
          (listaPermisos.length === 0 && permiso === 'misiones:terreno:verificar'))
      ) {
        return true;
      }
      if (esCuadrilla && permiso.startsWith('cuadrilla:')) {
        return true;
      }
      return false;
    },
    [usuario, esPatrulla, esCuadrilla]
  );

  const tieneAlgunPermiso = useCallback(
    (permisos: string[]) => {
      if (permisos.length === 0) return true;
      return permisos.some((p) => tienePermiso(p));
    },
    [tienePermiso]
  );

  return (
    <AuthContext.Provider
      value={{
        usuario,
        token,
        cargando,
        autenticado,
        esPatrulla,
        esCuadrilla,
        unidadActiva,
        tienePermiso,
        tieneAlgunPermiso,
        login,
        logout,
        recargarSesion,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
