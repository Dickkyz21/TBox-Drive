// app/api/notes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sendNote, isConfigured } from '@/lib/telegram';
import { addNoteToIndex, listNotes, addLog } from '@/lib/store';
import type { StoredNote } from '@/lib/telegram';

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function GET() {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: 'Bot Telegram belum dikonfigurasi di server.' },
      { status: 500 }
    );
  }

  try {
    const notes = await listNotes();
    return NextResponse.json({ notes });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Gagal mengambil daftar note.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: 'Bot Telegram belum dikonfigurasi di server.' },
      { status: 500 }
    );
  }

  try {
    const { title, body } = await req.json();
    const trimmedTitle = (title ?? '').trim();
    const trimmedBody = (body ?? '').trim();

    if (!trimmedTitle && !trimmedBody) {
      return NextResponse.json(
        { error: 'Note tidak boleh kosong.' },
        { status: 400 }
      );
    }

    const id = newId();
    const finalTitle = trimmedTitle || 'Tanpa judul';

    const { messageId, createdAt } = await sendNote(id, finalTitle, trimmedBody);

    const note: StoredNote = {
      messageId,
      id,
      title: finalTitle,
      body: trimmedBody,
      createdAt,
      updatedAt: createdAt,
    };

    await addNoteToIndex(note);
    await addLog('create_note', finalTitle);

    return NextResponse.json({ note });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Gagal membuat note.' },
      { status: 500 }
    );
  }
}
