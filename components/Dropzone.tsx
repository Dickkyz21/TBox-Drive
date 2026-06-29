// components/Dropzone.tsx
'use client';

import { useCallback, useRef, useState, DragEvent, ChangeEvent } from 'react';
import type { StoredFile } from '@/lib/telegram';

type UploadItem = {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  error?: string;
};

function uploadWithProgress(
  file: File,
  onProgress: (pct: number) => void
): Promise<StoredFile> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append('file', file);
    form.append('filename', file.name);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data.file);
        } else {
          reject(new Error(data.error || 'Upload gagal.'));
        }
      } catch {
        reject(new Error('Respons server tidak valid.'));
      }
    };

    xhr.onerror = () => reject(new Error('Koneksi gagal saat upload.'));

    xhr.open('POST', '/api/upload');
    xhr.send(form);
  });
}

export function Dropzone({
  onUploaded,
}: {
  onUploaded: (file: StoredFile) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    files.forEach((file) => {
      const id = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`;
      setItems((prev) => [
        ...prev,
        { id, name: file.name, size: file.size, progress: 0, status: 'uploading' },
      ]);

      uploadWithProgress(file, (pct) => {
        setItems((prev) =>
          prev.map((it) => (it.id === id ? { ...it, progress: pct } : it))
        );
      })
        .then((stored) => {
          setItems((prev) =>
            prev.map((it) =>
              it.id === id ? { ...it, progress: 100, status: 'done' } : it
            )
          );
          onUploaded(stored);
          setTimeout(() => {
            setItems((prev) => prev.filter((it) => it.id !== id));
          }, 2000);
        })
        .catch((err) => {
          setItems((prev) =>
            prev.map((it) =>
              it.id === id
                ? { ...it, status: 'error', error: err.message }
                : it
            )
          );
        });
    });
  }, [onUploaded]);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) handleFiles(e.target.files);
    e.target.value = '';
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-colors px-6 py-10 text-center ${
          dragging
            ? 'border-tg-500 bg-tg-500/5'
            : 'border-base-700 hover:border-base-600 bg-base-800/40'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
        <div className="w-11 h-11 mx-auto mb-3 rounded-full bg-tg-500/10 flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-tg-500">
            <path d="M12 16V4m0 0L7 9m5-5l5 5M5 20h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-sm font-medium text-ink-100">
          Seret file ke sini, atau{' '}
          <span className="text-tg-500">klik untuk pilih</span>
        </p>
        <p className="text-xs text-ink-500 mt-1">Maksimal 50MB per file</p>
      </div>

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((it) => (
            <div
              key={it.id}
              className="flex items-center gap-3 bg-base-800/60 border border-base-700 rounded-lg px-3.5 py-2.5"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-ink-300 truncate pr-2">
                    {it.name}
                  </span>
                  <span className="text-xs font-mono text-ink-500 shrink-0">
                    {it.status === 'error' ? 'Gagal' : `${it.progress}%`}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-base-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      it.status === 'error' ? 'bg-danger-400' : 'bg-gradient-to-r from-tg-500 to-tg-600'
                    }`}
                    style={{ width: `${it.progress}%` }}
                  />
                </div>
                {it.error && (
                  <p className="text-xs text-danger-400 mt-1">{it.error}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
