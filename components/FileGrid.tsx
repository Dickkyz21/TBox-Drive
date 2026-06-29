// components/FileGrid.tsx
'use client';

import { useMemo, useState } from 'react';
import type { StoredFile } from '@/lib/telegram';
import { FileCard } from './FileCard';

export function FileGrid({
  files,
  onDeleted,
}: {
  files: StoredFile[];
  onDeleted: (messageId: number) => void;
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return files;
    const q = query.toLowerCase();
    return files.filter((f) => f.name.toLowerCase().includes(q));
  }, [files, query]);

  if (files.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-ink-500 text-sm">
          Belum ada file. Unggah file pertamamu di atas.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="relative mb-5">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500"
        >
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
          <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama file..."
          className="w-full bg-base-800/60 border border-base-700 rounded-lg pl-10 pr-3.5 py-2.5 text-sm text-ink-100 placeholder:text-ink-500/60 focus:border-tg-500 transition-colors"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-ink-500 text-sm py-10">
          Tidak ada file yang cocok dengan &quot;{query}&quot;.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map((file) => (
            <FileCard key={file.messageId} file={file} onDeleted={onDeleted} />
          ))}
        </div>
      )}
    </div>
  );
}
