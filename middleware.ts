// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const COOKIE_NAME = 'td_session';
const PUBLIC_PATHS = ['/login', '/api/login'];

function expectedToken(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next(); // tidak ada password diset

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const valid = token && token === expectedToken(password);

  if (!valid) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Belum login.' }, { status: 401 });
    }
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
