import { NextRequest, NextResponse } from 'next/server';
import { deleteMessage } from '@/lib/telegram';
import {
  addLog,
  findInIndex,
  isStoreConfigured,
  listFolders,
  listIndex,
  removeFolder,
  removeFromIndex,
  updateFolder,
} from '@/lib/store';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isStoreConfigured()) {
    return NextResponse.json(
      { error: 'Redis belum dikonfigurasi di server.' },
      { status: 500 }
    );
  }

  try {
    const { id } = await context.params;
    const { name } = await req.json();
    const folder = await updateFolder(id, { name: String(name ?? '') });
    if (!folder) {
      return NextResponse.json({ error: 'Folder tidak ditemukan.' }, { status: 404 });
    }
    await addLog('rename_folder', folder.name);
    return NextResponse.json({ folder });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Gagal mengganti nama folder.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isStoreConfigured()) {
    return NextResponse.json(
      { error: 'Redis belum dikonfigurasi di server.' },
      { status: 500 }
    );
  }

  try {
    const { id } = await context.params;
    const folders = await listFolders();
    const targetFolder = folders.find((folder) => folder.id === id);
    if (!targetFolder) {
      return NextResponse.json({ error: 'Folder tidak ditemukan.' }, { status: 404 });
    }

    const files = await listIndex();
    const folderFiles = files.filter((file) => file.folderId === id);

    await Promise.all(
      folderFiles.map(async (file) => {
        try {
          await deleteMessage(file.messageId);
        } catch (err: any) {
          console.error('Gagal menghapus pesan Telegram dalam folder:', err.message);
        }
        const existing = await findInIndex(file.messageId);
        if (existing) await removeFromIndex(file.messageId);
      })
    );

    const folder = await removeFolder(id);

    await addLog('delete_folder', folder?.name ?? targetFolder.name, `${folderFiles.length} file`);
    return NextResponse.json({ ok: true, deletedFileIds: folderFiles.map((file) => file.messageId) });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Gagal menghapus folder.' },
      { status: 500 }
    );
  }
}
