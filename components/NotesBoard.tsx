// components/NotesBoard.tsx
'use client';

import { useState } from 'react';
import type { StoredNote } from '@/lib/telegram';
import { Header } from './Header';
import { NoteCard } from './NoteCard';
import { NoteEditor } from './NoteEditor';

export function NotesBoard({
  initialNotes,
  fileCount,
}: {
  initialNotes: StoredNote[];
  fileCount: number;
}) {
  const [notes, setNotes] = useState<StoredNote[]>(initialNotes);
  const [editing, setEditing] = useState<StoredNote | null | 'new'>(null);

  function handleSaved(note: StoredNote) {
    setNotes((prev) => {
      const exists = prev.some((n) => n.id === note.id);
      if (exists) return prev.map((n) => (n.id === note.id ? note : n));
      return [note, ...prev];
    });
    setEditing(null);
  }

  function handleDeleted(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <div className="max-w-6xl mx-auto">
      <Header fileCount={fileCount} />
      <main className="px-6 sm:px-8 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink-500">{notes.length} catatan</p>
          <button
            onClick={() => setEditing('new')}
            className="flex items-center gap-1.5 text-sm font-medium bg-gradient-to-r from-tg-500 to-tg-600 text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Catatan Baru
          </button>
        </div>

        {notes.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-ink-500 text-sm">
              Belum ada catatan. Buat catatan pertamamu.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onEdit={() => setEditing(note)}
                onDeleted={handleDeleted}
              />
            ))}
          </div>
        )}
      </main>

      {editing !== null && (
        <NoteEditor
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
