import { NextRequest, NextResponse } from 'next/server';
import { getDownloadUrl } from '@/lib/telegram';
import { findInIndex } from '@/lib/store';
import { categoryOf, extOf } from '@/lib/format';

function previewContentType(filename: string, mime: string): string {
  if (mime) return mime;
  const ext = extOf(filename);
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'webm') return 'video/webm';
  if (ext === 'ogv') return 'video/ogg';
  if (categoryOf(filename) === 'video') return 'video/mp4';
  if (ext === 'txt' || ext === 'md' || ext === 'csv') return 'text/plain; charset=utf-8';
  if (ext === 'json') return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

function inlineDisposition(filename: string): string {
  const ascii = filename
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\]/g, '_')
    .trim() || 'preview';

  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(
  req: NextRequest,
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
    const range = req.headers.get('range');
    const upstream = await fetch(url, {
      headers: range ? { Range: range } : undefined,
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: 'Gagal mengambil file dari Telegram.' },
        { status: 502 }
      );
    }

    const headers = new Headers();
    headers.set('Content-Type', previewContentType(entry.name, entry.mime));
    headers.set('Content-Disposition', inlineDisposition(entry.name));
    headers.set('Cache-Control', 'private, max-age=300');

    const contentLength = upstream.headers.get('content-length');
    const contentRange = upstream.headers.get('content-range');
    const acceptRanges = upstream.headers.get('accept-ranges');
    if (contentLength) headers.set('Content-Length', contentLength);
    if (contentRange) headers.set('Content-Range', contentRange);
    if (acceptRanges) headers.set('Accept-Ranges', acceptRanges);

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: {
        ...Object.fromEntries(headers),
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Gagal menyiapkan preview.' },
      { status: 500 }
    );
  }
}
