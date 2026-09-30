import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'pagos-cm-super-secret-key-2026-cole-mex'
);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('pagos_cm_session')?.value;

  let session: { id: string; role: string; usuario: string } | null = null;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      session = payload as unknown as { id: string; role: string; usuario: string };
    } catch {
      session = null;
    }
  }

  // Admin routes protection
  if (pathname.startsWith('/admin')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    if (session.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/alumno/dashboard', request.url));
    }
  }

  // Student routes protection
  if (pathname.startsWith('/alumno')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    if (session.role === 'ADMIN') {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  // Login or root page redirect if already logged in
  if (pathname === '/login' || pathname === '/') {
    if (session) {
      if (session.role === 'ADMIN') {
        return NextResponse.redirect(new URL('/admin', request.url));
      } else {
        return NextResponse.redirect(new URL('/alumno/dashboard', request.url));
      }
    } else if (pathname === '/') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/admin/:path*', '/alumno/:path*', '/login'],
};
