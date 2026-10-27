import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/utils/cookieUtils';

function esRutaPublica(pathname: string): boolean {
  if (
    pathname === '/login' ||
    pathname === '/sw.js' ||
    pathname === '/site.webmanifest' ||
    pathname === '/favicon.ico'
  ) {
    return true;
  }
  return false;
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  // Si ya tiene sesión activa e intenta ir a login
  if (pathname === '/login' && token) {
    return NextResponse.next();
  }

  // Rutas públicas
  if (esRutaPublica(pathname)) {
    return NextResponse.next();
  }

  // Si la ruta raíz y no tiene token, mandar a login
  if (!token) {
    const returnUrl = encodeURIComponent(pathname + search);
    const loginUrl = new URL(`/login?returnUrl=${returnUrl}`, request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
