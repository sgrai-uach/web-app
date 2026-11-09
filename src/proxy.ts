import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/utils/cookieUtils';

export const UNIFIED_LOGIN_PATH = process.env.NEXT_PUBLIC_LOGIN_URL || '/login';

function esRutaPublica(pathname: string): boolean {
  if (
    pathname === '/sw.js' ||
    pathname === '/site.webmanifest' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/manifest.json' ||
    pathname === '/favicon.ico' ||
    pathname.endsWith('.webmanifest')
  ) {
    return true;
  }
  return false;
}

export function proxy(request: NextRequest) {
  const { pathname, search, basePath } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const prefijoTerreno = basePath || '/terreno';

  // Redirigir /terreno/login hacia el portal de autenticación unificado (/login)
  if (pathname === '/login') {
    if (token) {
      return NextResponse.redirect(new URL(prefijoTerreno, request.nextUrl.origin));
    }
    const returnUrl = encodeURIComponent(prefijoTerreno);
    let targetOrigin = request.nextUrl.origin;
    if (request.nextUrl.port === '3002') {
      targetOrigin = `${request.nextUrl.protocol}//${request.nextUrl.hostname}:3000`;
    }
    return NextResponse.redirect(
      new URL(`${UNIFIED_LOGIN_PATH}?returnUrl=${returnUrl}`, targetOrigin)
    );
  }

  // Rutas públicas de infraestructura PWA
  if (esRutaPublica(pathname)) {
    return NextResponse.next();
  }

  // Si no cuenta con token de sesión, redirigir al login unificado (/login)
  if (!token) {
    const fullPath = `${prefijoTerreno}${pathname === '/' ? '' : pathname}${search}`;
    const returnUrl = encodeURIComponent(fullPath);
    let targetOrigin = request.nextUrl.origin;
    if (request.nextUrl.port === '3002') {
      targetOrigin = `${request.nextUrl.protocol}//${request.nextUrl.hostname}:3000`;
    }
    const loginUrl = new URL(
      `${UNIFIED_LOGIN_PATH}?returnUrl=${returnUrl}`,
      targetOrigin
    );
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
