// app/api/files/route.ts
import { NextResponse } from 'next/server';
import {
  addLog,
  addManyFilesToIndex,
  addManyNotesToIndex,
  isStoreConfigured,
  listFolders,
  listIndex,
} from '@/lib/store';
import { isConfigured, pullPendingUpdates } from '@/lib/telegram';

export async function GET() {
  if (!(await isConfigured())) {
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
      await addLog('sync', `${addedFiles} file, ${addedNotes} note dari Telegram`);
    }

    const folders = await listFolders();
    const folderPaths = new Map(folders.map((folder) => [folder.id, folder.path || folder.name]));
    const files = (await listIndex()).map((file) => ({
      ...file,
      folderPath: file.folderId ? folderPaths.get(file.folderId) || file.folderPath || null : null,
    }));
    return NextResponse.json({ files });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Gagal mengambil daftar file.' },
      { status: 500 }
    );
  }
}
