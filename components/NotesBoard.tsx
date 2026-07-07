// components/NotesBoard.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { StoredNote } from '@/lib/telegram';
import { Header } from './Header';
import { NoteCard } from './NoteCard';
import { NoteEditor } from './NoteEditor';
import { Pagination } from './Pagination';

export function NotesBoard({
  initialNotes,
  fileCount,
}: {
  initialNotes: StoredNote[];
  fileCount: number;
}) {
  const [notes, setNotes] = useState<StoredNote[]>(initialNotes);
  const [editing, setEditing] = useState<StoredNote | null | 'new'>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(1, Math.ceil(notes.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedNotes = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return notes.slice(start, start + pageSize);
  }, [notes, currentPage, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

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
      <main className="px-6 sm:px-8 py-8 space-y-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-tg-500 font-semibold">Task Notes</p>
            <h1 className="font-display text-2xl font-semibold text-ink-100 mt-1">Catatan To-Do</h1>
            <p className="text-sm text-ink-500 mt-1">{notes.length} sticky note aktif</p>
          </div>
          <button
            onClick={() => setEditing('new')}
            className="flex items-center justify-center gap-1.5 text-sm font-medium bg-gradient-to-r from-tg-500 to-tg-600 text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Catatan Baru
          </button>
        </div>

        {notes.length === 0 ? (
          <div className="mx-auto max-w-sm rotate-[-1deg] rounded-sm border border-yellow-100 bg-yellow-200 p-6 text-center text-slate-950 shadow-[0_18px_45px_-28px_rgba(0,0,0,0.85)]">
            <p className="text-sm font-semibold">
              Belum ada catatan. Buat catatan pertamamu.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginatedNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onEdit={() => setEditing(note)}
                onDeleted={handleDeleted}
              />
            ))}
          </div>
        )}

        <Pagination
          totalItems={notes.length}
          page={currentPage}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          itemLabel="catatan"
        />
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
