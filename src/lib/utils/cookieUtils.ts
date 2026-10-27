/**
 * Utilidades para la gestión segura de cookies de autenticación de sgrai-pwa.
 * Almacena el token JWT de sesión con SameSite=Lax y path=/.
 */

export const AUTH_COOKIE_NAME = 'sgrai_auth_token';

export function setAuthCookie(token: string, expiraEn?: string): void {
  if (typeof document === 'undefined') return;

  let maxAgeSeconds = 86400; // 24 horas por defecto

  if (expiraEn) {
    const expireDate = new Date(expiraEn);
    if (!isNaN(expireDate.getTime())) {
      const diffSeconds = Math.floor((expireDate.getTime() - Date.now()) / 1000);
      if (diffSeconds > 60) {
        maxAgeSeconds = diffSeconds;
      }
    }
  }

  const expireDate = new Date(Date.now() + maxAgeSeconds * 1000);
  let cookieString = `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=${maxAgeSeconds}; expires=${expireDate.toUTCString()}; SameSite=Lax`;

  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    cookieString += '; Secure';
  }

  document.cookie = cookieString;
}

export function getAuthCookie(): string | null {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    if (trimmed.startsWith(`${AUTH_COOKIE_NAME}=`)) {
      const value = trimmed.slice(AUTH_COOKIE_NAME.length + 1);
      return decodeURIComponent(value);
    }
  }

  return null;
}

export function removeAuthCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}
