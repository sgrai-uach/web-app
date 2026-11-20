import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import * as seguridadService from '@/services/seguridadService';
import * as cookieUtils from '@/lib/utils/cookieUtils';

vi.mock('@/services/seguridadService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/seguridadService')>();
  return {
    ...actual,
    loginUsuario: vi.fn(),
    obtenerUsuarioActivo: vi.fn(),
  };
});
vi.mock('@/lib/utils/cookieUtils');

describe('AuthContext (Control de Sesión y RBAC de Terreno)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cookieUtils.getAuthCookie).mockReturnValue(null);
  });

  it('inicia en estado no autenticado cuando no hay cookie', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    expect(result.current.cargando).toBe(false);
    expect(result.current.autenticado).toBe(false);
    expect(result.current.usuario).toBeNull();
  });

  it('permite login exitoso con rol PATRULLA_VERIFICADORA', async () => {
    vi.mocked(seguridadService.loginUsuario).mockResolvedValue({
      token: 'token-patrulla',
      tipoToken: 'Bearer',
      expiraEn: '2026-10-28T00:00:00Z',
      usuario: {
        id: 'user-patrulla-1',
        rut: '11.111.111-1',
        nombre: 'Juan Patrullero',
        email: 'juan@valdivia.cl',
        rolId: 'rol-1',
        rolNombre: 'Patrulla Verificadora',
        rolCodigo: 'PATRULLA_VERIFICADORA',
        delegacionId: 'del-1',
        delegacionNombre: 'Valdivia Centro',
        permisos: ['misiones:terreno:verificar'],
      },
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    await act(async () => {
      await result.current.login({
        identificador: '11.111.111-1',
        password: 'Password123!',
      });
    });

    expect(result.current.autenticado).toBe(true);
    expect(result.current.esPatrulla).toBe(true);
    expect(result.current.esCuadrilla).toBe(false);
    expect(result.current.usuario?.nombre).toBe('Juan Patrullero');
    expect(cookieUtils.setAuthCookie).toHaveBeenCalledWith(
      'token-patrulla',
      '2026-10-28T00:00:00Z'
    );
  });

  it('rechaza login con 403 si el rol no es de terreno (ej: CALL_CENTER o ADMIN)', async () => {
    vi.mocked(seguridadService.loginUsuario).mockResolvedValue({
      token: 'token-admin',
      tipoToken: 'Bearer',
      expiraEn: '2026-10-28T00:00:00Z',
      usuario: {
        id: 'user-admin-1',
        rut: '22.222.222-2',
        nombre: 'Carlos Admin',
        email: 'admin@valdivia.cl',
        rolId: 'rol-admin',
        rolNombre: 'Administrador General',
        rolCodigo: 'ADMIN',
        delegacionId: null,
        delegacionNombre: null,
        permisos: ['todo'],
      },
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    let errorCapturado = '';
    await act(async () => {
      try {
        await result.current.login({
          identificador: '22.222.222-2',
          password: 'Password123!',
        });
      } catch (err: unknown) {
        errorCapturado = err instanceof Error ? err.message : String(err);
      }
    });

    expect(errorCapturado).toContain('Acceso restringido');
    expect(result.current.autenticado).toBe(false);
    expect(cookieUtils.setAuthCookie).not.toHaveBeenCalled();
  });

  it('preserva la cookie sgrai_auth_token si un rol de oficina (ej: ADMIN) accede a /terreno sin destruir su sesión web', async () => {
    vi.mocked(cookieUtils.getAuthCookie).mockReturnValue('token-admin-activo');
    vi.mocked(seguridadService.obtenerUsuarioActivo).mockResolvedValue({
      id: 'user-admin-1',
      rut: '22.222.222-2',
      nombre: 'Carlos Admin',
      email: 'admin@valdivia.cl',
      activo: true,
      rol: {
        id: 'rol-admin',
        nombre: 'Administrador General',
        codigo: 'ADMIN',
        esAdmin: true,
      },
      permisos: ['todo'],
      delegacionId: null,
      delegacionNombre: null,
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    await act(async () => {
      await result.current.recargarSesion();
    });

    expect(result.current.autenticado).toBe(false);
    expect(cookieUtils.removeAuthCookie).not.toHaveBeenCalled();
  });

  it('mapea correctamente unidadActiva=false cuando la patrulla verificadora fue desactivada (H85)', async () => {
    vi.mocked(cookieUtils.getAuthCookie).mockReturnValue('token-patrulla-inactiva');
    vi.mocked(seguridadService.obtenerUsuarioActivo).mockResolvedValue({
      id: 'user-patrulla-1',
      rut: '11.111.111-1',
      nombre: 'Juan Patrullero',
      email: 'juan@valdivia.cl',
      activo: true,
      rol: {
        id: 'rol-patrulla',
        nombre: 'Patrulla Verificadora',
        codigo: 'PATRULLA_VERIFICADORA',
        esAdmin: false,
      },
      permisos: ['misiones:terreno:verificar'],
      delegacionId: 'del-1',
      delegacionNombre: 'Valdivia Sur',
      unidadId: 'pat-1',
      unidadNombre: 'Patrulla Móvil 01',
      unidadActiva: false,
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    await act(async () => {
      await result.current.recargarSesion();
    });

    expect(result.current.autenticado).toBe(true);
    expect(result.current.esPatrulla).toBe(true);
    expect(result.current.usuario?.unidadNombre).toBe('Patrulla Móvil 01');
    expect(result.current.usuario?.unidadActiva).toBe(false);
    expect(result.current.unidadActiva).toBe(false);
  });

  it('mapea correctamente unidadActiva=true cuando la patrulla verificadora está activa (H85)', async () => {
    vi.mocked(cookieUtils.getAuthCookie).mockReturnValue('token-patrulla-activa');
    vi.mocked(seguridadService.obtenerUsuarioActivo).mockResolvedValue({
      id: 'user-patrulla-1',
      rut: '11.111.111-1',
      nombre: 'Juan Patrullero',
      email: 'juan@valdivia.cl',
      activo: true,
      rol: {
        id: 'rol-patrulla',
        nombre: 'Patrulla Verificadora',
        codigo: 'PATRULLA_VERIFICADORA',
        esAdmin: false,
      },
      permisos: ['misiones:terreno:verificar'],
      delegacionId: 'del-1',
      delegacionNombre: 'Valdivia Sur',
      unidadId: 'pat-1',
      unidadNombre: 'Patrulla Móvil 01',
      unidadActiva: true,
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    await act(async () => {
      await result.current.recargarSesion();
    });

    expect(result.current.autenticado).toBe(true);
    expect(result.current.esPatrulla).toBe(true);
    expect(result.current.usuario?.unidadActiva).toBe(true);
    expect(result.current.unidadActiva).toBe(true);
    expect(result.current.tieneUnidadAsignada).toBe(true);
    expect(result.current.estadoAsignacion).toBe('ACTIVA');
  });

  it('detecta estado SIN_ASIGNACION cuando el funcionario no tiene patrulla asignada', async () => {
    vi.mocked(cookieUtils.getAuthCookie).mockReturnValue('token-sin-patrulla');
    vi.mocked(seguridadService.obtenerUsuarioActivo).mockResolvedValue({
      id: 'user-sin-patrulla-1',
      rut: '12.345.678-9',
      nombre: 'Pedro Sin Asignacion',
      email: 'pedro@valdivia.cl',
      activo: true,
      rol: {
        id: 'rol-patrulla',
        nombre: 'Patrulla Verificadora',
        codigo: 'PATRULLA_VERIFICADORA',
        esAdmin: false,
      },
      permisos: ['misiones:terreno:verificar'],
      delegacionId: 'del-1',
      delegacionNombre: 'Valdivia Sur',
      unidadId: null,
      unidadNombre: null,
      unidadActiva: false,
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    await act(async () => {
      await result.current.recargarSesion();
    });

    expect(result.current.autenticado).toBe(true);
    expect(result.current.esPatrulla).toBe(true);
    expect(result.current.tieneUnidadAsignada).toBe(false);
    expect(result.current.estadoAsignacion).toBe('SIN_ASIGNACION');
    expect(result.current.unidadActiva).toBe(false);
  });
});
