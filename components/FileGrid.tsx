// components/FileGrid.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { StoredFile } from '@/lib/telegram';
import type { StoredFolder } from '@/lib/store';
import { FileCard } from './FileCard';
import { Pagination } from './Pagination';
import {
  CATEGORY_ACCENT,
  categoryOf,
  extOf,
  formatBytes,
  formatDate,
  isTextPreviewExt,
} from '@/lib/format';
import { FileIcon } from './FileIcon';

type SortKey = 'newest' | 'name' | 'size' | 'type';
type ViewMode = 'grid' | 'list';
type ContentItem =
  | { kind: 'folder'; folder: StoredFolder; fileCount: number }
  | { kind: 'file'; file: StoredFile };

function folderPath(folder: StoredFolder | null): string {
  return folder?.path || folder?.name || '';
}

function parentPath(path: string): string {
  const parts = path.split('/').filter(Boolean);
  parts.pop();
  return parts.join('/');
}

function childName(path: string): string {
  return path.split('/').filter(Boolean).pop() || path;
}

function joinPath(parent: string, name: string): string {
  return [...parent.split('/').filter(Boolean), name.trim()].filter(Boolean).join('/');
}

function isPreviewable(file: StoredFile): boolean {
  const category = categoryOf(file.name);
  const ext = extOf(file.name);
  return (
    category === 'image' ||
    category === 'video' ||
    file.mime === 'application/pdf' ||
    ext === 'pdf' ||
    isTextPreviewExt(file.name) ||
    (file.mime || '').startsWith('text/')
  );
}

function FolderIcon({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M3.5 8.25A2.25 2.25 0 0 1 5.75 6h4.02c.55 0 1.08.2 1.49.57l1.1.98c.28.25.64.39 1.02.39h4.87A2.25 2.25 0 0 1 20.5 10.2v5.55A2.25 2.25 0 0 1 18.25 18H5.75a2.25 2.25 0 0 1-2.25-2.25v-7.5Z"
        fill="currentColor"
        opacity="0.16"
      />
      <path
        d="M3.5 8.25A2.25 2.25 0 0 1 5.75 6h4.02c.55 0 1.08.2 1.49.57l1.1.98c.28.25.64.39 1.02.39h4.87A2.25 2.25 0 0 1 20.5 10.2v5.55A2.25 2.25 0 0 1 18.25 18H5.75a2.25 2.25 0 0 1-2.25-2.25v-7.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FilePreviewPanel({
  file,
  onClose,
}: {
  file: StoredFile | null;
  onClose: () => void;
}) {
  const [textPreview, setTextPreview] = useState<string | null>(null);
  const [textError, setTextError] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);

  const category = file ? categoryOf(file.name) : 'other';
  const accent = CATEGORY_ACCENT[category];
  const ext = file ? extOf(file.name).toUpperCase() || 'FILE' : 'FILE';
  const previewUrl = file ? `/api/file/${file.messageId}/preview` : '';
  const downloadUrl = file ? `/api/file/${file.messageId}/download` : '';
  const isTextPreview = Boolean(
    file && (isTextPreviewExt(file.name) || (file.mime || '').startsWith('text/'))
  );
  const canEmbed = file ? isPreviewable(file) : false;

  useEffect(() => {
    let cancelled = false;
    setTextPreview(null);
    setTextError(null);

    if (!file || !isTextPreview) {
      setTextLoading(false);
      return;
    }

    setTextLoading(true);
    fetch(`/api/file/${file.messageId}/preview`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Gagal memuat preview teks.');
        return res.text();
      })
      .then((text) => {
        if (!cancelled) setTextPreview(text);
      })
      .catch((err) => {
        if (!cancelled) setTextError(err.message || 'Gagal memuat preview teks.');
      })
      .finally(() => {
        if (!cancelled) setTextLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [file, isTextPreview]);

  if (!file) return null;

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
          ) : category === 'video' ? (
            <div className="flex min-h-full items-center justify-center bg-black p-4">
              <video
                src={previewUrl}
                controls
                playsInline
                className="max-h-[82vh] w-full rounded-lg bg-black"
              >
                Browser tidak mendukung preview video ini.
              </video>
            </div>
          ) : isTextPreview ? (
            <div className="min-h-full bg-base-950 p-0">
              {textLoading ? (
                <div className="flex min-h-[70vh] items-center justify-center text-sm text-ink-500">
                  Memuat preview teks...
                </div>
              ) : textError ? (
                <div className="flex min-h-[70vh] items-center justify-center p-8 text-center">
                  <div>
                    <p className="text-sm font-semibold text-ink-100">Preview teks gagal dimuat</p>
                    <p className="mt-1 text-xs text-ink-500">{textError}</p>
                  </div>
                </div>
              ) : (
                <pre className="min-h-[70vh] whitespace-pre-wrap break-words p-5 font-mono text-xs leading-5 text-ink-300">
                  {textPreview}
                </pre>
              )}
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

function FolderCard({
  folder,
  fileCount,
  onOpen,
  onRenamed,
  onDeleted,
}: {
  folder: StoredFolder;
  fileCount: number;
  onOpen: (id: string) => void;
  onRenamed: (folder: StoredFolder, folders?: StoredFolder[]) => void;
  onDeleted: (id: string, deletedFileIds: number[], deletedFolderIds?: string[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const displayPath = folderPath(folder);
  const displayName = childName(displayPath || folder.name);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(folder.name);
  }, [folder.name]);

  async function handleRename() {
    if (!name.trim()) {
      setError('Nama folder wajib diisi.');
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/folders/${folder.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || 'Gagal mengganti nama folder.');
      return;
    }
    onRenamed(data.folder, data.folders);
    setEditing(false);
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/folders/${folder.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      onDeleted(folder.id, data.deletedFileIds || [], data.deletedFolderIds || [folder.id]);
    } else {
      setError(data.error || 'Gagal menghapus folder.');
      setDeleting(false);
    }
  }

  return (
    <div className="group relative overflow-hidden rounded-xl border border-base-700 bg-base-800/70 transition-colors hover:border-warn-400/40">
      <button
        type="button"
        onClick={() => onOpen(folder.id)}
        className="block w-full border-b border-base-700/70 bg-base-900 px-5 py-7 text-left"
      >
        <div className="mx-auto flex h-16 w-20 items-center justify-center rounded-lg border border-warn-400/20 bg-warn-400/10 text-warn-400">
          <FolderIcon className="h-11 w-11" />
        </div>
      </button>

      <div className="p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <button type="button" onClick={() => onOpen(folder.id)} className="min-w-0 text-left">
            <p className="truncate text-sm font-semibold text-ink-100" title={displayName}>
              {displayName}
            </p>
            <p className="mt-1 truncate text-xs font-mono text-ink-500" title={displayPath || displayName}>
              {fileCount} file{displayPath ? ` - ${displayPath}` : ''}
            </p>
          </button>
          <div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
            <button
              onClick={() => setEditing(true)}
              className="rounded-md p-1.5 text-ink-500 transition-colors hover:bg-base-700 hover:text-tg-500"
              title="Rename folder"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              onClick={() => setConfirmOpen(true)}
              className="rounded-md p-1.5 text-ink-500 transition-colors hover:bg-base-700 hover:text-danger-400"
              title="Hapus folder"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m1 0v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V7h10Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {editing && (
        <div className="absolute inset-0 flex flex-col justify-center gap-3 rounded-xl bg-base-900/95 p-4 backdrop-blur-sm">
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-lg border border-base-700 bg-base-950 px-3 py-2 text-sm text-ink-100 focus:border-tg-500"
          />
          {error && <p className="text-xs text-danger-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setName(folder.name);
                setEditing(false);
              }}
              className="rounded-lg border border-base-700 px-3 py-1.5 text-xs text-ink-300 hover:bg-base-800"
            >
              Batal
            </button>
            <button
              onClick={handleRename}
              disabled={saving}
              className="rounded-lg bg-tg-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-tg-600 disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      )}

      {confirmOpen && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-base-900/95 p-4 text-center backdrop-blur-sm">
          <p className="text-xs text-ink-300">
            Hapus folder ini beserta {fileCount} file di dalamnya?
          </p>
          {error && <p className="text-xs text-danger-400">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmOpen(false)}
              className="rounded-lg border border-base-700 px-3 py-1.5 text-xs text-ink-300 hover:bg-base-800"
            >
              Batal
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-lg bg-danger-400/15 px-3 py-1.5 text-xs text-danger-400 hover:bg-danger-400/25 disabled:opacity-50"
            >
              {deleting ? 'Menghapus...' : 'Hapus'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateFolderModal({
  open,
  onClose,
  onCreated,
  parentFolder,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (folder: StoredFolder) => void;
  parentFolder: StoredFolder | null;
}) {
  const [name, setName] = useState('Folder Baru');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;
  const parent = folderPath(parentFolder);

  async function handleCreate() {
    setSaving(true);
    setError(null);
    const res = await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: joinPath(parent, name) }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || 'Gagal membuat folder.');
      return;
    }
    onCreated(data.folder);
    setName('Folder Baru');
    onClose();
  }

  return (
    <>
      <button
        type="button"
        aria-label="Tutup tambah folder"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-base-950/70 backdrop-blur-sm"
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border border-base-700 bg-base-800 p-5 shadow-2xl">
          <h3 className="text-sm font-semibold text-ink-100">Folder Baru</h3>
          <p className="mt-1 text-xs text-ink-500">
            Folder dibuat di {parent ? `/${parent}` : 'Home'} dan bisa langsung diisi upload.
          </p>
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-4 w-full rounded-lg border border-base-700 bg-base-900 px-3.5 py-2.5 text-sm text-ink-100 focus:border-tg-500"
          />
          {error && <p className="mt-2 text-xs text-danger-400">{error}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-base-700 px-4 py-2 text-sm text-ink-300 hover:bg-base-700/50 disabled:opacity-50"
            >
              Batal
            </button>
            <button
              onClick={handleCreate}
              disabled={saving}
              className="rounded-lg bg-tg-500 px-4 py-2 text-sm font-medium text-white hover:bg-tg-600 disabled:opacity-50"
            >
              {saving ? 'Membuat...' : 'Buat Folder'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export function FileGrid({
  files,
  folders,
  currentFolderId,
  onFolderOpen,
  onFolderAdded,
  onFolderRenamed,
  onFolderDeleted,
  onDeleted,
}: {
  files: StoredFile[];
  folders: StoredFolder[];
  currentFolderId: string | null;
  onFolderOpen: (id: string | null) => void;
  onFolderAdded: (folder: StoredFolder) => void;
  onFolderRenamed: (folder: StoredFolder, folders?: StoredFolder[]) => void;
  onFolderDeleted: (id: string, deletedFileIds: number[], deletedFolderIds?: string[]) => void;
  onDeleted: (messageId: number) => void;
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [view, setView] = useState<ViewMode>('grid');
  const [preview, setPreview] = useState<StoredFile | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [createOpen, setCreateOpen] = useState(false);
  const currentFolder = folders.find((folder) => folder.id === currentFolderId) ?? null;
  const currentPath = folderPath(currentFolder);
  const knownFolderIds = useMemo(
    () => new Set(folders.map((folder) => folder.id)),
    [folders]
  );
  const filesInCurrentFolder = useMemo(
    () =>
      files.filter((file) =>
        currentFolderId
          ? file.folderId === currentFolderId
          : !file.folderId || !knownFolderIds.has(file.folderId)
      ),
    [currentFolderId, files, knownFolderIds]
  );
  const folderCounts = useMemo(() => {
    const counts = new Map<string, number>();
    files.forEach((file) => {
      if (!file.folderId || !knownFolderIds.has(file.folderId)) return;
      counts.set(file.folderId, (counts.get(file.folderId) ?? 0) + 1);
    });
    return counts;
  }, [files, knownFolderIds]);

  const childFolderCount = useMemo(
    () =>
      folders.filter((folder) =>
        currentFolderId
          ? parentPath(folderPath(folder)) === currentPath
          : parentPath(folderPath(folder)) === ''
      ).length,
    [currentFolderId, currentPath, folders]
  );

  const filtered = useMemo<ContentItem[]>(() => {
    const sortedFiles = [...filesInCurrentFolder].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'size') return b.size - a.size;
      if (sort === 'type') return categoryOf(a.name).localeCompare(categoryOf(b.name));
      return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
    });

    const childFolders: ContentItem[] = [...folders]
      .filter((folder) =>
        currentFolderId
          ? parentPath(folderPath(folder)) === currentPath
          : parentPath(folderPath(folder)) === ''
      )
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((folder) => ({
            kind: 'folder',
            folder,
            fileCount: folderCounts.get(folder.id) ?? 0,
          }));
    const items: ContentItem[] = [
      ...childFolders,
      ...sortedFiles.map((file) => ({ kind: 'file', file }) as ContentItem),
    ];

    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((item) =>
      item.kind === 'folder'
        ? `${item.folder.name} ${item.folder.path || ''}`.toLowerCase().includes(q)
        : item.file.name.toLowerCase().includes(q)
    );
  }, [currentFolderId, currentPath, filesInCurrentFolder, folderCounts, folders, query, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [currentFolderId, query, sort, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const summary = useMemo(() => {
    const totalSize = filesInCurrentFolder.reduce((sum, file) => sum + file.size, 0);
    const images = filesInCurrentFolder.filter((file) => categoryOf(file.name) === 'image').length;
    const documents = filesInCurrentFolder.filter((file) => categoryOf(file.name) === 'document').length;
    return { totalSize, images, documents };
  }, [filesInCurrentFolder]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border border-base-700 bg-base-800/45 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => onFolderOpen(null)}
            className={`rounded-lg px-3 py-2 font-medium ${
              currentFolderId
                ? 'text-ink-500 hover:bg-base-700 hover:text-ink-100'
                : 'bg-base-700 text-ink-100'
            }`}
          >
            Home
          </button>
          {currentFolder && (
            <>
              <span className="text-ink-500">/</span>
              <span className="truncate rounded-lg bg-tg-500/10 px-3 py-2 font-medium text-tg-500">
                {folderPath(currentFolder)}
              </span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-tg-500/40 px-4 py-2 text-sm font-medium text-tg-500 hover:bg-tg-500/10"
        >
          <FolderIcon className="h-4 w-4" />
          Folder Baru
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-base-700 bg-base-800/50 px-4 py-3">
          <p className="text-xs text-ink-500">{currentFolder ? 'File folder' : 'File Home'}</p>
          <p className="mt-1 text-xl font-semibold text-ink-100">{filesInCurrentFolder.length}</p>
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
          <p className="text-xs text-ink-500">Folder</p>
          <p className="mt-1 text-xl font-semibold text-ink-100">
            {childFolderCount}
          </p>
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
            placeholder="Cari folder atau file..."
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
          {query
            ? `Tidak ada item yang cocok dengan "${query}".`
            : 'Belum ada item di lokasi ini.'}
        </p>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {paginated.map((item) =>
            item.kind === 'folder' ? (
              <FolderCard
                key={item.folder.id}
                folder={item.folder}
                fileCount={item.fileCount}
                onOpen={onFolderOpen}
                onRenamed={onFolderRenamed}
                onDeleted={onFolderDeleted}
              />
            ) : (
              <FileCard
                key={item.file.messageId}
                file={item.file}
                onDeleted={onDeleted}
                onPreview={setPreview}
              />
            )
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-base-700 bg-base-800/45">
          {paginated.map((item) => {
            if (item.kind === 'folder') {
              return (
                <button
                  key={item.folder.id}
                  onClick={() => onFolderOpen(item.folder.id)}
                  className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-base-700/60 px-4 py-3 text-left last:border-b-0 hover:bg-base-800"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-warn-400/12 text-warn-400">
                    <FolderIcon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink-100" title={item.folder.path || item.folder.name}>
                      {childName(folderPath(item.folder) || item.folder.name)}
                    </span>
                    <span className="mt-0.5 block text-xs font-mono text-ink-500">
                      {item.fileCount} file{item.folder.path ? ` - ${item.folder.path}` : ''}
                    </span>
                  </span>
                  <span className="hidden text-xs font-mono text-ink-500 sm:block">
                    Folder
                  </span>
                </button>
              );
            }

            const file = item.file;
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

      <Pagination
        totalItems={filtered.length}
        page={currentPage}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        itemLabel="item"
      />

      <CreateFolderModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={onFolderAdded}
        parentFolder={currentFolder}
      />
      <FilePreviewPanel file={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
