// components/HistoryLog.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { LogEntry, LogAction } from '@/lib/store';
import { Header } from './Header';
import { formatRelative, formatDate } from '@/lib/format';
import { Pagination } from './Pagination';

const ACTION_CONFIG: Record<LogAction, { label: string; color: string }> = {
  upload:       { label: 'Upload',        color: '#2AABEE' },
  delete_file:  { label: 'Hapus File',    color: '#F87171' },
  create_note:  { label: 'Buat Catatan',  color: '#34D399' },
  edit_note:    { label: 'Edit Catatan',  color: '#F59E0B' },
  delete_note:  { label: 'Hapus Catatan', color: '#F87171' },
  sync:         { label: 'Sync',          color: '#A78BFA' },
};

export function HistoryLog({
  initialLogs,
  fileCount,
}: {
  initialLogs: LogEntry[];
  fileCount: number;
}) {
  const [logs] = useState<LogEntry[]>(initialLogs);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(1, Math.ceil(logs.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return logs.slice(start, start + pageSize);
  }, [logs, currentPage, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  return (
    <div className="max-w-6xl mx-auto">
      <Header fileCount={fileCount} />
      <main className="px-6 sm:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-ink-500">{logs.length} aktivitas terakhir</p>
          <p className="text-xs text-ink-500">Maks. 200 entri terbaru disimpan</p>
        </div>

        {logs.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-ink-500 text-sm">
              Belum ada aktivitas tercatat. Upload file atau buat catatan dulu.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {paginatedLogs.map((entry) => {
              const cfg = ACTION_CONFIG[entry.action] ?? {
                label: entry.action,
                color: '#8A93A1',
              };
              return (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 bg-base-800/50 border border-base-700/60 rounded-lg px-4 py-3 hover:border-base-600 transition-colors"
                >
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 mt-0.5"
                    style={{
                      color: cfg.color,
                      borderColor: `${cfg.color}40`,
                      backgroundColor: `${cfg.color}12`,
                    }}
                  >
                    {cfg.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink-100 truncate">{entry.label}</p>
                    {entry.detail && (
                      <p className="text-xs text-ink-500 mt-0.5">{entry.detail}</p>
                    )}
                  </div>
                  <span
                    className="text-xs font-mono text-ink-500 shrink-0 mt-0.5"
                    title={formatDate(entry.at)}
                  >
                    {formatRelative(entry.at)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-5">
          <Pagination
            totalItems={logs.length}
            page={currentPage}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            itemLabel="aktivitas"
          />
        </div>
      </main>
    </div>
  );
}
