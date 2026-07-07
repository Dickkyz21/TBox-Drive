// app/api/notes/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { editNote, deleteMessage, isConfigured } from '@/lib/telegram';
import {
  updateNoteInIndex,
  removeNoteFromIndex,
  findNoteInIndex,
  addLog,
  isStoreConfigured,
} from '@/lib/store';

const MAX_TITLE_LENGTH = 120;
const MAX_BODY_LENGTH = 3000;

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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
    const { id } = await context.params;
    const existing = await findNoteInIndex(id);
    if (!existing) {
      return NextResponse.json({ error: 'Note tidak ditemukan.' }, { status: 404 });
    }

    const { title, body } = await req.json();
    const trimmedTitle = (title ?? '').trim() || 'Tanpa judul';
    const trimmedBody = (body ?? '').trim();

    if (trimmedTitle.length > MAX_TITLE_LENGTH) {
      return NextResponse.json(
        { error: `Judul maksimal ${MAX_TITLE_LENGTH} karakter.` },
        { status: 400 }
      );
    }

    if (trimmedBody.length > MAX_BODY_LENGTH) {
      return NextResponse.json(
        { error: `Isi catatan maksimal ${MAX_BODY_LENGTH} karakter.` },
        { status: 400 }
      );
    }

    const { updatedAt } = await editNote(
      existing.messageId,
      id,
      trimmedTitle,
      trimmedBody,
      existing.createdAt
    );

    const updated = await updateNoteInIndex(id, {
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
    const removed = await removeNoteFromIndex(id);

    if (removed) {
      try {
        await deleteMessage(removed.messageId);
      } catch (err: any) {
        console.error('Gagal menghapus pesan note di Telegram:', err.message);
      }
      await addLog('delete_note', removed.title);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Gagal menghapus note.' },
      { status: 500 }
    );
  }
}
