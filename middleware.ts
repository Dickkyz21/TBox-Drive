// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis/cloudflare';

const COOKIE_NAME = 'td_session';
const PUBLIC_PATHS = ['/login', '/api/login'];
const SETTINGS_KEY = 'teledrive:settings';

async function expectedToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function isValidDeviceKey(apiKey: string): Promise<boolean> {
  try {
    const url   = process.env.UPSTASH_REDIS_REST_URL   ?? process.env.KV_REST_API_URL   ?? '';
    const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? '';
    if (!url || !token) return false;
    const redis = new Redis({ url, token });
    const raw = await redis.hgetall('teledrive:devices');
    if (!raw) return false;
    return Object.values(raw).some((v: any) => {
      try {
        const d = typeof v === 'string' ? JSON.parse(v) : v;
        return d.apiKey === apiKey;
      } catch { return false; }
    });
  } catch { return false; }
}

async function runtimePasswordHash(): Promise<string | null> {
  try {
    const url   = process.env.UPSTASH_REDIS_REST_URL   ?? process.env.KV_REST_API_URL   ?? '';
    const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? '';
    if (!url || !token) return null;
    const redis = new Redis({ url, token });
    const raw: any = await redis.get(SETTINGS_KEY);
    const settings = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return settings?.appPasswordHash ?? null;
  } catch {
    return null;
  }
}

async function effectivePasswordHash(): Promise<string | null> {
  const runtimeHash = await runtimePasswordHash();
  if (runtimeHash) return runtimeHash;
  const password = process.env.APP_PASSWORD;
  return password ? expectedToken(password) : null;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.includes(pathname) ||
      pathname.startsWith('/_next') ||
      pathname.startsWith('/favicon')) {
    return NextResponse.next();
  }

  const expected = await effectivePasswordHash();
  if (!expected) return NextResponse.next();

  // Cek X-API-Key (untuk daemon / script / device)
  if (pathname.startsWith('/api')) {
    const apiKey = req.headers.get('x-api-key');
    if (apiKey) {
      // Cocok dengan password utama ATAU key perangkat yang terdaftar
      if (await expectedToken(apiKey) === expected || await isValidDeviceKey(apiKey)) {
        return NextResponse.next();
      }
      return NextResponse.json({ error: 'API key tidak valid.' }, { status: 401 });
    }
  }

  // Cek cookie session (untuk browser)
  const token = req.cookies.get(COOKIE_NAME)?.value;
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
