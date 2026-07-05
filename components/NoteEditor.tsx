// components/NoteEditor.tsx
'use client';

import { useState } from 'react';
import type { StoredNote } from '@/lib/telegram';

export function NoteEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: StoredNote | null;
  onClose: () => void;
  onSaved: (note: StoredNote) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!title.trim() && !body.trim()) {
      setError('Catatan tidak boleh kosong.');
      return;
    }
    setSaving(true);
    setError(null);

    try {
      let res: Response;
      if (initial) {
        res = await fetch(`/api/notes/${initial.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            body,
            messageId: initial.messageId,
            createdAt: initial.createdAt,
          }),
        });
      } else {
        res = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, body }),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Gagal menyimpan catatan.');
        setSaving(false);
        return;
      }

      onSaved(data.note);
    } catch {
      setError('Koneksi gagal saat menyimpan.');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-base-950/70 backdrop-blur-sm z-50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg bg-base-800 border border-base-700 rounded-2xl p-6 shadow-glow">
        <h2 className="font-display font-semibold text-lg mb-4">
          {initial ? 'Edit Catatan' : 'Catatan Baru'}
        </h2>

        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Judul"
          className="w-full bg-base-900 border border-base-700 rounded-lg px-3.5 py-2.5 text-sm font-medium text-ink-100 placeholder:text-ink-500/60 focus:border-tg-500 transition-colors mb-3"
        />

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Tulis catatan di sini..."
          rows={8}
          className="w-full bg-base-900 border border-base-700 rounded-lg px-3.5 py-2.5 text-sm text-ink-100 placeholder:text-ink-500/60 focus:border-tg-500 transition-colors resize-none"
        />

        {error && <p className="text-danger-400 text-sm mt-2">{error}</p>}

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            disabled={saving}
            className="text-sm px-4 py-2 rounded-lg border border-base-700 text-ink-300 hover:bg-base-700/50 transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-sm px-4 py-2 rounded-lg bg-gradient-to-r from-tg-500 to-tg-600 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}
