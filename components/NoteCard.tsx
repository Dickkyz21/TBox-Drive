// components/NoteCard.tsx
'use client';

import { useState } from 'react';
import type { StoredNote } from '@/lib/telegram';
import { formatRelative } from '@/lib/format';

export function NoteCard({
  note,
  onEdit,
  onDeleted,
}: {
  note: StoredNote;
  onEdit: () => void;
  onDeleted: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/notes/${note.id}`, { method: 'DELETE' });
    if (res.ok) {
      onDeleted(note.id);
    } else {
      setDeleting(false);
    }
  }

  return (
    <div className="group relative bg-base-800/70 border border-base-700 rounded-xl p-4 hover:border-base-600 transition-colors flex flex-col min-h-[160px]">
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-semibold text-ink-100 line-clamp-1 pr-2">
          {note.title}
        </h3>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-md text-ink-500 hover:text-tg-500 hover:bg-base-700 transition-colors"
            title="Edit"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5">
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onClick={() => setConfirmOpen(true)}
            className="p-1.5 rounded-md text-ink-500 hover:text-danger-400 hover:bg-base-700 transition-colors"
            title="Hapus"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5">
              <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m1 0v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V7h10Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      <p className="text-xs text-ink-300 whitespace-pre-wrap line-clamp-5 flex-1">
        {note.body || <span className="text-ink-500 italic">Tidak ada isi</span>}
      </p>

      <p className="text-xs font-mono text-ink-500 mt-3 pt-3 border-t border-base-700/60">
        {note.updatedAt !== note.createdAt ? 'Diedit ' : ''}
        {formatRelative(note.updatedAt)}
      </p>

      {confirmOpen && (
        <div className="absolute inset-0 bg-base-900/95 rounded-xl flex flex-col items-center justify-center gap-3 p-4 backdrop-blur-sm">
          <p className="text-xs text-ink-300 text-center">
            Hapus catatan ini secara permanen?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmOpen(false)}
              className="text-xs px-3 py-1.5 rounded-lg border border-base-700 text-ink-300 hover:bg-base-800"
            >
              Batal
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs px-3 py-1.5 rounded-lg bg-danger-400/15 text-danger-400 hover:bg-danger-400/25 disabled:opacity-50"
            >
              {deleting ? 'Menghapus...' : 'Hapus'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
