// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { uploadFile, isConfigured } from '@/lib/telegram';
import { addToIndex, addLog, isStoreConfigured, listFolders } from '@/lib/store';
import { formatBytes, mimeFromFilename } from '@/lib/format';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Telegram Bot API membatasi upload via bot ke 50MB per file.
const MAX_SIZE = 50 * 1024 * 1024;
const MAX_FILENAME_LENGTH = 180;

function normalizeFilename(value: string): string {
  const cleaned = value.replace(/[\r\n]/g, ' ').trim();
  if (!cleaned) return 'file-tanpa-nama';
  return cleaned.length > MAX_FILENAME_LENGTH
    ? cleaned.slice(0, MAX_FILENAME_LENGTH).trim()
    : cleaned;
}

export async function POST(req: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: 'Bot Telegram belum dikonfigurasi di server.' },
      { status: 500 }
    );
  }
  if (!isStoreConfigured()) {
    return NextResponse.json(
      { error: 'Redis belum dikonfigurasi di server.' },
      { status: 500 }
    );
  }

  try {
    const form = await req.formData();
    const file = form.get('file');
    const folderIdValue = form.get('folderId');
    const folderId =
      typeof folderIdValue === 'string' && folderIdValue.trim()
        ? folderIdValue.trim()
        : null;

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'File tidak ditemukan.' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'Ukuran file melebihi batas 50MB dari Telegram Bot API.' },
        { status: 413 }
      );
    }

    const filename = normalizeFilename(
      (form.get('filename') as string) ||
      (file as any).name ||
      'file-tanpa-nama'
    );

    if (folderId) {
      const folders = await listFolders();
      if (!folders.some((folder) => folder.id === folderId)) {
        return NextResponse.json(
          { error: 'Folder tujuan tidak ditemukan.' },
          { status: 404 }
        );
      }
    }

    const mime = mimeFromFilename(filename, file.type || 'application/octet-stream');
    const stored = await uploadFile(file, filename, mime, folderId);
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
