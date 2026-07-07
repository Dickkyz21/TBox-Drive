// app/api/sync/route.ts
import { NextResponse } from 'next/server';
import { pullPendingUpdates, isConfigured } from '@/lib/telegram';
import {
  addManyFilesToIndex,
  addManyNotesToIndex,
  addLog,
  isStoreConfigured,
} from '@/lib/store';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST() {
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
    const pulled = await pullPendingUpdates();
    const addedFiles = await addManyFilesToIndex(pulled.files);
    const addedNotes = await addManyNotesToIndex(pulled.notes);

    if (addedFiles > 0 || addedNotes > 0) {
      await addLog(
        'sync',
        `${addedFiles} file, ${addedNotes} note dipulihkan`
      );
    }

    return NextResponse.json({
      scannedFiles: pulled.files.length,
      scannedNotes: pulled.notes.length,
      addedFiles,
      addedNotes,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Gagal sinkronisasi dari Telegram.' },
      { status: 500 }
    );
  }
}
