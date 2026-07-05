// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { uploadFile, isConfigured } from '@/lib/telegram';
import { addToIndex, addLog } from '@/lib/store';
import { formatBytes } from '@/lib/format';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Telegram Bot API membatasi upload via bot ke 50MB per file.
const MAX_SIZE = 50 * 1024 * 1024;

export async function POST(req: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: 'Bot Telegram belum dikonfigurasi di server.' },
      { status: 500 }
    );
  }

  try {
    const form = await req.formData();
    const file = form.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'File tidak ditemukan.' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'Ukuran file melebihi batas 50MB dari Telegram Bot API.' },
        { status: 413 }
      );
    }

    const filename =
      (form.get('filename') as string) ||
      (file as any).name ||
      'file-tanpa-nama';

    const stored = await uploadFile(file, filename, file.type);
    await addToIndex(stored);
    await addLog('upload', stored.name, formatBytes(stored.size));

    return NextResponse.json({ file: stored });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Gagal mengunggah file.' },
      { status: 500 }
    );
  }
}
