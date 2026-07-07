// components/FileGrid.tsx
'use client';

import { useMemo, useState } from 'react';
import type { StoredFile } from '@/lib/telegram';
import { FileCard } from './FileCard';
import {
  CATEGORY_ACCENT,
  categoryOf,
  extOf,
  formatBytes,
  formatDate,
} from '@/lib/format';
import { FileIcon } from './FileIcon';

type SortKey = 'newest' | 'name' | 'size' | 'type';
type ViewMode = 'grid' | 'list';

function isPreviewable(file: StoredFile): boolean {
  const category = categoryOf(file.name);
  const ext = extOf(file.name);
  return (
    category === 'image' ||
    file.mime === 'application/pdf' ||
    ['pdf', 'txt', 'md', 'csv', 'json'].includes(ext)
  );
}

function FilePreviewPanel({
  file,
  onClose,
}: {
  file: StoredFile | null;
  onClose: () => void;
}) {
  if (!file) return null;

  const category = categoryOf(file.name);
  const accent = CATEGORY_ACCENT[category];
  const ext = extOf(file.name).toUpperCase() || 'FILE';
  const previewUrl = `/api/file/${file.messageId}/preview`;
  const downloadUrl = `/api/file/${file.messageId}/download`;
  const canEmbed = isPreviewable(file);

  return (
    <>
      <button
        type="button"
        aria-label="Tutup preview"
        onClick={onClose}
        className="fixed inset-0 z-30 bg-base-950/60 backdrop-blur-sm"
      />
      <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-xl border-l border-base-700 bg-base-900 shadow-2xl">
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-base-700 px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-100">{file.name}</p>
            <p className="mt-1 text-xs font-mono text-ink-500">
              {formatBytes(file.size)} - {formatDate(file.uploadedAt)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-ink-500 hover:bg-base-800 hover:text-ink-100"
            title="Tutup preview"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-base-950">
          {category === 'image' ? (
            <div className="flex min-h-full items-center justify-center p-5">
              <img
                src={previewUrl}
                alt={file.name}
                className="max-h-full max-w-full rounded-lg border border-base-700 object-contain"
              />
            </div>
          ) : canEmbed ? (
            <iframe
              src={previewUrl}
              title={file.name}
              className="h-full min-h-[70vh] w-full bg-white"
            />
          ) : (
            <div className="flex min-h-full items-center justify-center p-8">
              <div className="text-center">
                <div
                  className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: `${accent}1A`, color: accent }}
                >
                  <FileIcon category={category} className="h-10 w-10" />
                </div>
                <p className="text-sm font-semibold text-ink-100">Preview belum tersedia</p>
                <p className="mt-1 text-xs text-ink-500">
                  Format {ext} bisa dibuka dengan mengunduh file.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-base-700 px-5 py-4">
          <div className="min-w-0 text-xs text-ink-500">
            <span className="font-mono">{file.mime || 'application/octet-stream'}</span>
          </div>
          <a
            href={downloadUrl}
            className="inline-flex items-center gap-2 rounded-lg border border-tg-500/40 px-3 py-2 text-sm font-medium text-tg-500 hover:bg-tg-500/10"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Unduh
          </a>
        </div>
      </div>
      </aside>
    </>
  );
}

export function FileGrid({
  files,
  onDeleted,
}: {
  files: StoredFile[];
  onDeleted: (messageId: number) => void;
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [view, setView] = useState<ViewMode>('grid');
  const [preview, setPreview] = useState<StoredFile | null>(null);

  const filtered = useMemo(() => {
    const sorted = [...files].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'size') return b.size - a.size;
      if (sort === 'type') return categoryOf(a.name).localeCompare(categoryOf(b.name));
      return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
    });

    if (!query.trim()) return sorted;
    const q = query.toLowerCase();
    return sorted.filter((f) => f.name.toLowerCase().includes(q));
  }, [files, query, sort]);

  const summary = useMemo(() => {
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const images = files.filter((file) => categoryOf(file.name) === 'image').length;
    const documents = files.filter((file) => categoryOf(file.name) === 'document').length;
    return { totalSize, images, documents };
  }, [files]);

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
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-base-700 bg-base-800/50 px-4 py-3">
          <p className="text-xs text-ink-500">Total file</p>
          <p className="mt-1 text-xl font-semibold text-ink-100">{files.length}</p>
        </div>
        <div className="rounded-lg border border-base-700 bg-base-800/50 px-4 py-3">
          <p className="text-xs text-ink-500">Ukuran</p>
          <p className="mt-1 text-xl font-semibold text-ink-100">{formatBytes(summary.totalSize)}</p>
        </div>
        <div className="rounded-lg border border-base-700 bg-base-800/50 px-4 py-3">
          <p className="text-xs text-ink-500">Gambar</p>
          <p className="mt-1 text-xl font-semibold text-ink-100">{summary.images}</p>
        </div>
        <div className="rounded-lg border border-base-700 bg-base-800/50 px-4 py-3">
          <p className="text-xs text-ink-500">Dokumen</p>
          <p className="mt-1 text-xl font-semibold text-ink-100">{summary.documents}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-base-700 bg-base-800/45 p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500"
          >
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
            <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama file..."
            className="w-full rounded-lg border border-base-700 bg-base-900 pl-10 pr-3.5 py-2.5 text-sm text-ink-100 placeholder:text-ink-500/60 transition-colors focus:border-tg-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-10 rounded-lg border border-base-700 bg-base-900 px-3 text-sm text-ink-300 focus:border-tg-500"
            title="Urutkan"
          >
            <option value="newest">Terbaru</option>
            <option value="name">Nama</option>
            <option value="size">Ukuran</option>
            <option value="type">Tipe</option>
          </select>

          <div className="flex rounded-lg border border-base-700 bg-base-900 p-1">
            <button
              onClick={() => setView('grid')}
              className={`rounded-md p-2 ${view === 'grid' ? 'bg-base-700 text-ink-100' : 'text-ink-500 hover:text-ink-100'}`}
              title="Grid"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                <path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </button>
            <button
              onClick={() => setView('list')}
              className={`rounded-md p-2 ${view === 'list' ? 'bg-base-700 text-ink-100' : 'text-ink-500 hover:text-ink-100'}`}
              title="List"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-ink-500 text-sm py-10">
          Tidak ada file yang cocok dengan &quot;{query}&quot;.
        </p>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((file) => (
            <FileCard
              key={file.messageId}
              file={file}
              onDeleted={onDeleted}
              onPreview={setPreview}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-base-700 bg-base-800/45">
          {filtered.map((file) => {
            const category = categoryOf(file.name);
            const accent = CATEGORY_ACCENT[category];
            return (
              <button
                key={file.messageId}
                onClick={() => setPreview(file)}
                className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-base-700/60 px-4 py-3 text-left last:border-b-0 hover:bg-base-800"
              >
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${accent}1A`, color: accent }}
                >
                  {category === 'image' ? (
                    <img
                      src={`/api/file/${file.messageId}/preview`}
                      alt=""
                      loading="lazy"
                      className="h-full w-full rounded-lg object-cover"
                    />
                  ) : (
                    <FileIcon category={category} className="h-5 w-5" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink-100">
                    {file.name}
                  </span>
                  <span className="mt-0.5 block text-xs font-mono text-ink-500">
                    {formatBytes(file.size)} - {file.mime || extOf(file.name) || 'file'}
                  </span>
                </span>
                <span className="hidden text-xs font-mono text-ink-500 sm:block">
                  {formatDate(file.uploadedAt)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <FilePreviewPanel file={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
