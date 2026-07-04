// app/api/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { checkPassword, sessionCookieValue, SESSION_COOKIE_NAME } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  if (!checkPassword(password ?? '')) {
    return NextResponse.json({ error: 'Password salah.' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, sessionCookieValue(), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 hari
  });
  return res;
}
