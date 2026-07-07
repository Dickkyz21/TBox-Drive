// app/api/file/[id]/delete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { deleteMessage } from '@/lib/telegram';
import { removeFromIndex, addLog, findInIndex } from '@/lib/store';

export async function POST(
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

    try {
      await deleteMessage(messageId);
    } catch (err: any) {
      // Tetap lanjut hapus dari index walau pesan Telegram sudah terlanjur
      // hilang (misalnya dihapus manual dari channel) supaya UI tidak nyangkut.
      console.error('Gagal menghapus pesan Telegram:', err.message);
    }

    await removeFromIndex(messageId);
    if (entry) await addLog('delete_file', entry.name);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Gagal menghapus file.' },
      { status: 500 }
    );
  }
}
