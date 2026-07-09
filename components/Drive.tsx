// components/Drive.tsx
'use client';

import { useState } from 'react';
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
  const currentFolder = folders.find((folder) => folder.id === currentFolderId) ?? null;

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
