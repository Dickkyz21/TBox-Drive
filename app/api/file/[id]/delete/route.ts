// app/api/file/[id]/delete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { deleteMessage } from '@/lib/telegram';
import { removeFromIndex } from '@/lib/store';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const messageId = Number(params.id);

  try {
    await deleteMessage(messageId);
  } catch (err: any) {
    // Tetap lanjut hapus dari index walau pesan Telegram sudah terlanjur
    // hilang (misalnya dihapus manual dari channel) supaya UI tidak nyangkut.
    console.error('Gagal menghapus pesan Telegram:', err.message);
  }

  await removeFromIndex(messageId);
  return NextResponse.json({ ok: true });
}
