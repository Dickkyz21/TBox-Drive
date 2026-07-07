// components/NoteEditor.tsx
'use client';

import { useState } from 'react';
import type { StoredNote } from '@/lib/telegram';
import { DEFAULT_NOTE_COLOR, NOTE_COLORS, getNoteColor, type NoteColor } from '@/lib/notes';

const MAX_TITLE_LENGTH = 120;
const MAX_BODY_LENGTH = 3000;

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
  const [color, setColor] = useState<NoteColor>(initial?.color ?? DEFAULT_NOTE_COLOR);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeColor = getNoteColor(color);

  async function handleSave() {
    if (!title.trim() && !body.trim()) {
      setError('Catatan tidak boleh kosong.');
      return;
    }
    if (title.trim().length > MAX_TITLE_LENGTH) {
      setError(`Judul maksimal ${MAX_TITLE_LENGTH} karakter.`);
      return;
    }
    if (body.trim().length > MAX_BODY_LENGTH) {
      setError(`Isi catatan maksimal ${MAX_BODY_LENGTH} karakter.`);
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
          body: JSON.stringify({ title, body, color }),
        });
      } else {
        res = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, body, color }),
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
      <div className="w-full max-w-2xl bg-base-800 border border-base-700 rounded-2xl p-5 sm:p-6 shadow-glow">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="font-display font-semibold text-lg">
            {initial ? 'Edit Catatan' : 'Catatan Baru'}
          </h2>
          <div className="flex items-center gap-2">
            {NOTE_COLORS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setColor(item.id)}
                className={`h-6 w-6 rounded-full ${item.swatch} border-2 transition-transform ${
                  color === item.id
                    ? 'border-white scale-110'
                    : 'border-base-600 hover:scale-105'
                }`}
                title={item.label}
              />
            ))}
          </div>
        </div>

        <div className={`${activeColor.card} rounded-sm border p-4 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.85)]`}>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={MAX_TITLE_LENGTH}
            placeholder="Judul"
            className="w-full bg-transparent border-b border-slate-700/25 px-0 pb-3 text-base font-bold text-slate-950 placeholder:text-slate-700/60 focus:border-slate-900/45 transition-colors mb-3"
          />

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={MAX_BODY_LENGTH}
            placeholder="- Tulis task pertama&#10;- Tulis task berikutnya"
            rows={9}
            className="w-full bg-transparent text-sm leading-7 text-slate-950 placeholder:text-slate-700/60 transition-colors resize-none"
          />
        </div>

        <div className="mt-2 flex items-center justify-between gap-3">
          {error ? (
            <p className="text-danger-400 text-sm">{error}</p>
          ) : (
            <span />
          )}
          <p className="text-xs text-ink-500 shrink-0">
            {body.length}/{MAX_BODY_LENGTH}
          </p>
        </div>

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
