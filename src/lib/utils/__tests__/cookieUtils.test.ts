import { describe, it, expect, beforeEach } from 'vitest';
import {
  setAuthCookie,
  getAuthCookie,
  removeAuthCookie,
  AUTH_COOKIE_NAME,
} from '../cookieUtils';

describe('Utilidades de cookie de autenticación (cookieUtils)', () => {
  beforeEach(() => {
    // Limpiar cookies antes de cada test
    document.cookie = `${AUTH_COOKIE_NAME}=; max-age=0; path=/`;
  });

  it('guarda y recupera el token de sesión', () => {
    const dummyToken = 'jwt-token-prueba-123';
    setAuthCookie(dummyToken);

    expect(getAuthCookie()).toBe(dummyToken);
  });

  it('elimina la cookie correctamente al invocar removeAuthCookie', () => {
    setAuthCookie('token-a-eliminar');
    expect(getAuthCookie()).toBe('token-a-eliminar');

    removeAuthCookie();
    expect(getAuthCookie()).toBeNull();
  });
});
