import createClient from 'openapi-fetch';
import type { paths } from '@/types/api-generated';
import { getAuthCookie, removeAuthCookie } from '@/lib/utils/cookieUtils';

export const DEV_PATRULLA_TOKEN = 'dev-patrulla-token';
export const DEV_PATRULLA_USER_ID = '00000000-0000-4000-8000-000000000004';

function extractUserIdFromJwt(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = typeof atob === 'function' ? atob(base64) : '';
    if (!json) return null;
    const payload = JSON.parse(json) as {
      sub?: string;
      id?: string;
      userId?: string;
      usuarioId?: string;
    };
    return payload.sub || payload.id || payload.userId || payload.usuarioId || null;
  } catch {
    return null;
  }
}

export function handleUnauthorizedSession() {
  if (typeof window === 'undefined') return;
  const currentToken = getAuthCookie();
  // Si está usando la sesión local de demostración en terreno, no destruir la sesión
  if (currentToken === DEV_PATRULLA_TOKEN) return;

  const hadToken = Boolean(currentToken);
  removeAuthCookie();

  const pathname = window.location.pathname;
  if (
    !pathname.startsWith('/login') &&
    !pathname.startsWith('/terreno/login')
  ) {
    if (hadToken || (pathname !== '/' && pathname !== '/terreno')) {
      const returnUrl = encodeURIComponent(pathname + window.location.search);
      const loginPath = pathname.startsWith('/terreno')
        ? '/terreno/login'
        : '/login';
      try {
        window.location.assign(
          `${loginPath}?motivo=sesion_expirada&returnUrl=${returnUrl}`
        );
      } catch {
        // Ignorar excepciones en entornos jsdom
      }
    }
  }
}

function resolveApiBaseUrl(): string {
  if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
    return '';
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
}

const apiClient = createClient<paths>({
  baseUrl: resolveApiBaseUrl(),
});

apiClient.use({
  async onRequest({ request }) {
    const token = getAuthCookie();
    if (token === DEV_PATRULLA_TOKEN) {
      request.headers.set('x-user-id', DEV_PATRULLA_USER_ID);
      request.headers.delete('Authorization');
      return request;
    }

    if (token) {
      request.headers.set('Authorization', `Bearer ${token}`);
      const userId = extractUserIdFromJwt(token);
      if (userId && !request.headers.get('x-user-id')) {
        request.headers.set('x-user-id', userId);
      }
    }
    if (request.headers.get('x-user-id') === '') {
      request.headers.delete('x-user-id');
    }
    return request;
  },
  async onResponse({ response }) {
    if (response.status === 401) {
      handleUnauthorizedSession();
    }
    return response;
  },
});

export default apiClient;
