import createClient from 'openapi-fetch';
import type { paths } from '@/types/api-generated';
import { getAuthCookie, removeAuthCookie } from '@/lib/utils/cookieUtils';

export function handleUnauthorizedSession() {
  if (typeof window === 'undefined') return;
  const hadToken = Boolean(getAuthCookie());
  removeAuthCookie();

  const pathname = window.location.pathname;
  if (!pathname.startsWith('/login') && !pathname.startsWith('/terreno/login')) {
    if (hadToken || pathname !== '/') {
      const returnUrl = encodeURIComponent(pathname + window.location.search);
      let loginHost = '';
      if (typeof window !== 'undefined' && window.location.port === '3002') {
        loginHost = `${window.location.protocol}//${window.location.hostname}:3000`;
      }
      try {
        window.location.assign(`${loginHost}/login?motivo=sesion_expirada&returnUrl=${returnUrl}`);
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
    if (token) {
      request.headers.set('Authorization', `Bearer ${token}`);
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
