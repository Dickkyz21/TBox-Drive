// app/api/notes/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { editNote, deleteMessage, isConfigured } from '@/lib/telegram';
import { updateNoteInIndex, removeNoteFromIndex, addLog } from '@/lib/store';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: 'Bot Telegram belum dikonfigurasi di server.' },
      { status: 500 }
    );
  }

  try {
    const { title, body, messageId, createdAt } = await req.json();
    const trimmedTitle = (title ?? '').trim() || 'Tanpa judul';
    const trimmedBody = (body ?? '').trim();

    const { updatedAt } = await editNote(
      messageId,
      params.id,
      trimmedTitle,
      trimmedBody,
      createdAt
    );

    const updated = await updateNoteInIndex(params.id, {
      title: trimmedTitle,
      body: trimmedBody,
      updatedAt,
    });

    if (!updated) {
      return NextResponse.json({ error: 'Note tidak ditemukan.' }, { status: 404 });
    }

    await addLog('edit_note', trimmedTitle);

    return NextResponse.json({ note: updated });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Gagal mengedit note.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const removed = await removeNoteFromIndex(params.id);

  if (removed) {
    try {
      await deleteMessage(removed.messageId);
    } catch (err: any) {
      console.error('Gagal menghapus pesan note di Telegram:', err.message);
    }
    await addLog('delete_note', removed.title);
  }

  return NextResponse.json({ ok: true });
}
