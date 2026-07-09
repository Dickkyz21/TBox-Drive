import { NextRequest, NextResponse } from 'next/server';
import {
  addFolder,
  addLog,
  ensureFolderByPath,
  isStoreConfigured,
  listFolders,
} from '@/lib/store';
import { isConfigured } from '@/lib/telegram';

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
    const folders = await listFolders();
    return NextResponse.json({ folders });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Gagal mengambil daftar folder.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isStoreConfigured()) {
    return NextResponse.json(
      { error: 'Redis belum dikonfigurasi di server.' },
      { status: 500 }
    );
  }

  try {
    const { name, path } = await req.json();
    const folder = path
      ? await ensureFolderByPath(String(path))
      : await addFolder(String(name ?? 'Folder Baru'));
    if (!path) await addLog('create_folder', folder.name);
    return NextResponse.json({ folder });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Gagal membuat folder.' },
      { status: 500 }
    );
  }
}
