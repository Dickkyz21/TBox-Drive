// app/api/file/[id]/download/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDownloadUrl } from '@/lib/telegram';
import { findInIndex } from '@/lib/store';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const messageId = Number(params.id);
  const entry = await findInIndex(messageId);

  if (!entry) {
    return NextResponse.json({ error: 'File tidak ditemukan.' }, { status: 404 });
  }

  try {
    const url = await getDownloadUrl(entry.fileId);
    // Proxy isi file lewat server kita supaya nama file & header download
    // tetap konsisten (bukan nama acak dari Telegram), dan supaya domain
    // api.telegram.org tidak terekspos langsung ke pengguna akhir.
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
        'Content-Disposition': `attachment; filename="${encodeURIComponent(
          entry.name
        )}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Gagal menyiapkan unduhan.' },
      { status: 500 }
    );
  }
}
