// app/api/file/[id]/delete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { deleteMessage } from '@/lib/telegram';
import { removeFromIndex, addLog, findInIndex } from '@/lib/store';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const messageId = Number(params.id);
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
}
