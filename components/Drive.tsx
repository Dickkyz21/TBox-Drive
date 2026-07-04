// components/Drive.tsx
'use client';

import { useState } from 'react';
import type { StoredFile } from '@/lib/telegram';
import { Header } from './Header';
import { Dropzone } from './Dropzone';
import { FileGrid } from './FileGrid';

export function Drive({ initialFiles }: { initialFiles: StoredFile[] }) {
  const [files, setFiles] = useState<StoredFile[]>(initialFiles);

  function handleUploaded(file: StoredFile) {
    setFiles((prev) => [file, ...prev]);
  }

  function handleDeleted(messageId: number) {
    setFiles((prev) => prev.filter((f) => f.messageId !== messageId));
  }

  return (
    <div className="max-w-6xl mx-auto">
      <Header fileCount={files.length} />
      <main className="px-6 sm:px-8 py-8 space-y-8">
        <Dropzone onUploaded={handleUploaded} />
        <FileGrid files={files} onDeleted={handleDeleted} />
      </main>
    </div>
  );
}
