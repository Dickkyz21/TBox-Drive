// lib/auth.ts
// Autentikasi sederhana: satu password (dari env APP_PASSWORD), disimpan
// sebagai cookie httpOnly setelah login berhasil. Cocok untuk pemilik
// tunggal / tim kecil, bukan multi-user.

import { cookies } from 'next/headers';
import { getAppPasswordHash } from './settings';

const COOKIE_NAME = 'td_session';

async function expectedToken(): Promise<string | null> {
  return getAppPasswordHash();
}

export async function isAuthRequired(): Promise<boolean> {
  return Boolean(await expectedToken());
}

export async function checkPassword(input: string): Promise<boolean> {
  const expected = await expectedToken();
  if (!expected) return true;
  const inputHash = await import('crypto').then(({ default: crypto }) =>
    crypto.createHash('sha256').update(input).digest('hex')
  );
  return inputHash === expected;
}

export async function sessionCookieValue(): Promise<string> {
  return (await expectedToken()) ?? '';
}

export async function hasValidSession(): Promise<boolean> {
  if (!(await isAuthRequired())) return true;
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  return Boolean(token) && token === await expectedToken();
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
