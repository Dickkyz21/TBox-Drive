// components/NoteCard.tsx
'use client';

import { useState } from 'react';
import type { StoredNote } from '@/lib/telegram';
import { formatRelative } from '@/lib/format';
import { getNoteColor } from '@/lib/notes';

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
  const color = getNoteColor(note.color);
  const taskLines = note.body
    .split('\n')
    .map((line) => line.trim().replace(/^[-*]\s+/, '').replace(/^\[[ xX]\]\s+/, ''))
    .filter(Boolean)
    .slice(0, 5);

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
    <div className={`group relative ${color.card} border rounded-sm p-4 shadow-[0_16px_35px_-22px_rgba(0,0,0,0.75)] hover:-translate-y-1 hover:rotate-0 transition-all flex flex-col min-h-[210px] rotate-[-1deg]`}>
      <span className={`absolute left-1/2 top-2 h-2.5 w-10 -translate-x-1/2 rounded-full ${color.pin} shadow-sm`} />
      <div className="flex items-start justify-between mb-3 pt-3">
        <h3 className="text-base font-bold leading-snug line-clamp-2 pr-2">
          {note.title}
        </h3>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-md text-slate-700 hover:text-slate-950 hover:bg-white/35 transition-colors"
            title="Edit"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5">
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onClick={() => setConfirmOpen(true)}
            className="p-1.5 rounded-md text-slate-700 hover:text-red-700 hover:bg-white/35 transition-colors"
            title="Hapus"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5">
              <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m1 0v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V7h10Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-2">
        {taskLines.length > 0 ? (
          taskLines.map((line, index) => (
            <div key={`${note.id}-${index}`} className="flex items-start gap-2 text-sm leading-relaxed">
              <span className="mt-1 h-3.5 w-3.5 shrink-0 rounded border-2 border-slate-600/70 bg-white/35" />
              <p className="line-clamp-2">{line}</p>
            </div>
          ))
        ) : (
          <p className={`text-sm italic ${color.muted}`}>Tidak ada isi</p>
        )}
      </div>

      <p className={`text-xs font-mono ${color.muted} mt-4 pt-3 border-t ${color.line}`}>
        {note.updatedAt !== note.createdAt ? 'Diedit ' : ''}
        {formatRelative(note.updatedAt)}
      </p>

      {confirmOpen && (
        <div className="absolute inset-0 bg-slate-950/90 rounded-sm flex flex-col items-center justify-center gap-3 p-4 backdrop-blur-sm">
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
