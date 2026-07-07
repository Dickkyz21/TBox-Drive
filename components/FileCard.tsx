// components/FileCard.tsx
'use client';

import { useState } from 'react';
import type { StoredFile } from '@/lib/telegram';
import { formatBytes, formatDate, categoryOf, CATEGORY_ACCENT } from '@/lib/format';
import { FileIcon } from './FileIcon';

export function FileCard({
  file,
  onDeleted,
}: {
  file: StoredFile;
  onDeleted: (messageId: number) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const category = categoryOf(file.name);
  const accent = CATEGORY_ACCENT[category];

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/file/${file.messageId}/delete`, {
      method: 'POST',
    });
    if (res.ok) {
      onDeleted(file.messageId);
    } else {
      setDeleting(false);
    }
  }

  return (
    <div className="group relative bg-base-800/70 border border-base-700 rounded-xl p-4 hover:border-base-600 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${accent}1A`, color: accent }}
        >
          <FileIcon category={category} className="w-5 h-5" />
        </div>

        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
          <a
            href={`/api/file/${file.messageId}/download`}
            className="p-1.5 rounded-md text-ink-500 hover:text-tg-500 hover:bg-base-700 transition-colors"
            title="Unduh"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
              <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={deleting}
            className="p-1.5 rounded-md text-ink-500 hover:text-danger-400 hover:bg-base-700 transition-colors"
            title="Hapus"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
              <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m1 0v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V7h10Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      <p className="text-sm font-medium text-ink-100 truncate" title={file.name}>
        {file.name}
      </p>
      <p className="text-xs font-mono text-ink-500 mt-1">
        {formatBytes(file.size)} · {formatDate(file.uploadedAt)}
      </p>

      {confirmOpen && (
        <div className="absolute inset-0 bg-base-900/95 rounded-xl flex flex-col items-center justify-center gap-3 p-4 backdrop-blur-sm">
          <p className="text-xs text-ink-300 text-center">
            Hapus file ini secara permanen?
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
