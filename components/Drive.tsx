// components/Drive.tsx
'use client';

import { useEffect, useState } from 'react';
import type { StoredFile } from '@/lib/telegram';
import type { StoredFolder } from '@/lib/store';
import { Header } from './Header';
import { Dropzone } from './Dropzone';
import { FileGrid } from './FileGrid';

export function Drive({
  initialFiles,
  initialFolders,
}: {
  initialFiles: StoredFile[];
  initialFolders: StoredFolder[];
}) {
  const [files, setFiles] = useState<StoredFile[]>(initialFiles);
  const [folders, setFolders] = useState<StoredFolder[]>(initialFolders);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const currentFolder = folders.find((folder) => folder.id === currentFolderId) ?? null;

  async function refreshDrive(silent = false) {
    setRefreshing(true);
    try {
      const [filesRes, foldersRes] = await Promise.all([
        fetch('/api/files', { cache: 'no-store' }),
        fetch('/api/folders', { cache: 'no-store' }),
      ]);
      const [filesData, foldersData] = await Promise.all([filesRes.json(), foldersRes.json()]);
      if (!filesRes.ok) throw new Error(filesData.error || 'Gagal refresh file.');
      if (!foldersRes.ok) throw new Error(foldersData.error || 'Gagal refresh folder.');

      setFiles(filesData.files || []);
      setFolders(foldersData.folders || []);
      setLastSyncedAt(new Date());
      setRefreshError(null);
      if (currentFolderId && !(foldersData.folders || []).some((folder: StoredFolder) => folder.id === currentFolderId)) {
        setCurrentFolderId(null);
      }
    } catch (err: any) {
      setRefreshError(err.message || 'Auto refresh gagal.');
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (!cancelled) await refreshDrive(true);
    };
    const id = window.setInterval(tick, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [currentFolderId]);

  function handleUploaded(file: StoredFile) {
    setFiles((prev) => [file, ...prev]);
  }

  function handleDeleted(messageId: number) {
    setFiles((prev) => prev.filter((f) => f.messageId !== messageId));
  }

  function handleFolderDeleted(id: string, deletedFileIds: number[], deletedFolderIds?: string[]) {
    const ids = new Set(deletedFolderIds?.length ? deletedFolderIds : [id]);
    setFolders((prev) => prev.filter((folder) => !ids.has(folder.id)));
    setFiles((prev) => prev.filter((file) => !deletedFileIds.includes(file.messageId)));
    if (currentFolderId && ids.has(currentFolderId)) setCurrentFolderId(null);
  }

  return (
    <div className="max-w-6xl mx-auto">
      <Header fileCount={files.length} />
      <main className="px-6 sm:px-8 py-8 space-y-8">
        <div className="flex flex-col gap-3 rounded-xl border border-base-700 bg-base-800/45 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className={`h-2.5 w-2.5 rounded-full ${refreshing ? 'animate-pulse bg-tg-500' : 'bg-ok-400'}`} />
            <div>
              <p className="text-sm font-medium text-ink-100">
                {refreshing ? 'Menyinkronkan dashboard...' : 'Dashboard auto sync aktif'}
              </p>
              <p className="text-xs text-ink-500">
                {refreshError || (lastSyncedAt ? `Terakhir sync ${lastSyncedAt.toLocaleTimeString()}` : 'Memantau perubahan server dan desktop client.')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => refreshDrive(false)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-tg-500/40 px-3 py-2 text-sm font-medium text-tg-500 hover:bg-tg-500/10 disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" fill="none" className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}>
              <path d="M20 12a8 8 0 0 1-13.66 5.66M4 12A8 8 0 0 1 17.66 6.34M17 3v4h-4M7 21v-4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Refresh
          </button>
        </div>
        <Dropzone
          onUploaded={handleUploaded}
          folderId={currentFolderId}
          folderName={currentFolder?.path || currentFolder?.name}
        />
        <FileGrid
          files={files}
          folders={folders}
          currentFolderId={currentFolderId}
          onFolderOpen={setCurrentFolderId}
          onFolderAdded={(folder) => setFolders((prev) => [folder, ...prev])}
          onFolderRenamed={(folder, nextFolders) =>
            nextFolders
              ? setFolders(nextFolders)
              : setFolders((prev) => prev.map((item) => (item.id === folder.id ? folder : item)))
          }
          onFolderDeleted={handleFolderDeleted}
          onDeleted={handleDeleted}
        />
      </main>
    </div>
  );
}
