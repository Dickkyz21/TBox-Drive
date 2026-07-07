// lib/auth.ts
// Autentikasi sederhana: satu password (dari env APP_PASSWORD), disimpan
// sebagai cookie httpOnly setelah login berhasil. Cocok untuk pemilik
// tunggal / tim kecil, bukan multi-user.

import { cookies } from 'next/headers';
import crypto from 'crypto';

const COOKIE_NAME = 'td_session';

function expectedToken(): string | null {
  const password = process.env.APP_PASSWORD;
  if (!password) return null;
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function isAuthRequired(): boolean {
  return Boolean(process.env.APP_PASSWORD);
}

export function checkPassword(input: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return true; // tidak ada password diset -> akses terbuka
  return input === expected;
}

export function sessionCookieValue(): string {
  return expectedToken() ?? '';
}

export async function hasValidSession(): Promise<boolean> {
  if (!isAuthRequired()) return true;
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  return Boolean(token) && token === expectedToken();
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
