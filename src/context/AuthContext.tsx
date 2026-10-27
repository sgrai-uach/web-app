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

export interface AuthContextValue {
  usuario: UsuarioPerfilSesion | null;
  token: string | null;
  cargando: boolean;
  autenticado: boolean;
  esPatrulla: boolean;
  esCuadrilla: boolean;
  unidadActiva: boolean;
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

    try {
      const detalle = await obtenerUsuarioActivo();
      const perfil = mapDetalleAUsuarioPerfil(detalle);

      if (!esRolTerrenoPermitido(perfil.rolCodigo)) {
        removeAuthCookie();
        setUsuario(null);
        setToken(null);
        return;
      }

      setToken(cookieToken);
      setUsuario(perfil);
    } catch {
      removeAuthCookie();
      setUsuario(null);
      setToken(null);
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
    setUsuario(null);
    setToken(null);
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }, []);

  const rolCodigoActual = usuario?.rolCodigo?.toUpperCase() || '';
  const esPatrulla = rolCodigoActual === 'PATRULLA_VERIFICADORA';
  const esCuadrilla = rolCodigoActual === 'DELEGADO_CUADRILLA';
  const unidadActiva = usuario?.unidadActiva !== false;
  const autenticado = Boolean(token && usuario);

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
