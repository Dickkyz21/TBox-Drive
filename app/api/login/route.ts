// app/api/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { checkPassword, sessionCookieValue, SESSION_COOKIE_NAME } from '@/lib/auth';

export async function POST(req: NextRequest) {
  let password = '';
  try {
    const body = await req.json();
    password = body?.password ?? '';
  } catch {
    return NextResponse.json({ error: 'Payload login tidak valid.' }, { status: 400 });
  }

  if (!(await checkPassword(password))) {
    return NextResponse.json({ error: 'Password salah.' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, await sessionCookieValue(), {
    httpOnly: true,
    secure: req.nextUrl.protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 hari
  });
  return res;
}
