// app/api/files/route.ts
import { NextResponse } from 'next/server';
import { listIndex } from '@/lib/store';
import { isConfigured } from '@/lib/telegram';

export async function GET() {
  if (!(await isConfigured())) {
    return NextResponse.json(
      { error: 'Bot Telegram belum dikonfigurasi di server.' },
      { status: 500 }
    );
  }

  try {
    const files = await listIndex();
    return NextResponse.json({ files });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Gagal mengambil daftar file.' },
      { status: 500 }
    );
  }
}
