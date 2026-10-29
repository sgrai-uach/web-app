import createClient from 'openapi-fetch';
import type { paths } from '@/types/api-generated';
import { getAuthCookie, removeAuthCookie } from '@/lib/utils/cookieUtils';

export function handleUnauthorizedSession() {
  if (typeof window === 'undefined') return;
  const hadToken = Boolean(getAuthCookie());
  removeAuthCookie();

  const pathname = window.location.pathname;
  if (!pathname.startsWith('/login')) {
    if (hadToken || pathname !== '/') {
      const returnUrl = encodeURIComponent(pathname + window.location.search);
      try {
        window.location.assign(`/login?motivo=sesion_expirada&returnUrl=${returnUrl}`);
      } catch {
        // Ignorar excepciones en entornos jsdom
      }
    }
  }
}

const apiClient = createClient<paths>({
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
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
