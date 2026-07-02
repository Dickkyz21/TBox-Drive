// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'td_session';
const PUBLIC_PATHS = ['/login', '/api/login'];

// Middleware berjalan di Vercel Edge Runtime, yang TIDAK mendukung modul
// Node.js seperti `crypto` (require('crypto')). Web Crypto API
// (crypto.subtle) dipakai sebagai gantinya — tersedia secara global di
// Edge Runtime maupun browser, tanpa perlu import apa pun. Hasil hash-nya
// identik dengan Node crypto.createHash('sha256') untuk input yang sama.
async function expectedToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function middleware(req: NextRequest) {
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

  // Jalur untuk script/automasi (bukan browser): header X-API-Key yang
  // cocok dengan APP_PASSWORD dianggap valid, tanpa perlu cookie session.
  // Hanya berlaku untuk endpoint /api/*, tidak untuk halaman.
  if (pathname.startsWith('/api')) {
    const apiKey = req.headers.get('x-api-key');
    if (apiKey && apiKey === password) {
      return NextResponse.next();
    }
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const expected = await expectedToken(password);
  const valid = token && token === expected;

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
