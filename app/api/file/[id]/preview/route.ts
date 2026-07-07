import { NextRequest, NextResponse } from 'next/server';
import { getDownloadUrl } from '@/lib/telegram';
import { findInIndex } from '@/lib/store';

function inlineDisposition(filename: string): string {
  const ascii = filename
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\]/g, '_')
    .trim() || 'preview';

  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const messageId = Number(id);

  if (!Number.isSafeInteger(messageId)) {
    return NextResponse.json({ error: 'ID file tidak valid.' }, { status: 400 });
  }

  try {
    const entry = await findInIndex(messageId);

    if (!entry) {
      return NextResponse.json({ error: 'File tidak ditemukan.' }, { status: 404 });
    }

    const url = await getDownloadUrl(entry.fileId);
    const upstream = await fetch(url);

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: 'Gagal mengambil file dari Telegram.' },
        { status: 502 }
      );
    }

    return new NextResponse(upstream.body, {
      headers: {
        'Content-Type': entry.mime || 'application/octet-stream',
        'Content-Disposition': inlineDisposition(entry.name),
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Gagal menyiapkan preview.' },
      { status: 500 }
    );
  }
}
