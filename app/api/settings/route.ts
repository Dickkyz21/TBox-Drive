import { NextRequest, NextResponse } from 'next/server';
import {
  getEffectiveSettings,
  isDatabaseConfigured,
  maskSecret,
  saveRuntimeSettings,
} from '@/lib/settings';
import { SESSION_COOKIE_NAME } from '@/lib/auth';

export async function GET() {
  const settings = await getEffectiveSettings();
  return NextResponse.json({
    database: settings.database,
    appPassword: settings.appPassword,
    telegram: {
      configured: settings.telegram.configured,
      botTokenMasked: maskSecret(settings.telegram.botToken),
      chatIdMasked: maskSecret(settings.telegram.chatId),
      source: settings.telegram.source,
    },
  });
}

export async function PATCH(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: 'Database belum dikonfigurasi. Atur Upstash Redis environment variables di Vercel terlebih dahulu.' },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const saved = await saveRuntimeSettings({
      appPassword: typeof body.appPassword === 'string' ? body.appPassword : undefined,
      telegramBotToken: typeof body.telegramBotToken === 'string' ? body.telegramBotToken : undefined,
      telegramChatId: typeof body.telegramChatId === 'string' ? body.telegramChatId : undefined,
    });

    const settings = await getEffectiveSettings();
    const res = NextResponse.json({
      ok: true,
      database: settings.database,
      appPassword: settings.appPassword,
      telegram: {
        configured: settings.telegram.configured,
        botTokenMasked: maskSecret(settings.telegram.botToken),
        chatIdMasked: maskSecret(settings.telegram.chatId),
        source: settings.telegram.source,
      },
    });

    if (typeof body.appPassword === 'string' && body.appPassword.trim() && saved.appPasswordHash) {
      res.cookies.set(SESSION_COOKIE_NAME, saved.appPasswordHash, {
        httpOnly: true,
        secure: req.nextUrl.protocol === 'https:',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return res;
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Gagal menyimpan pengaturan.' },
      { status: 500 }
    );
  }
}
