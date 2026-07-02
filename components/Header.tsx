// components/Header.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

type SyncResult =
  | { addedFiles: number; addedNotes: number }
  | { error: string };

const TABS = [
  { href: '/', label: 'File' },
  { href: '/notes', label: 'Catatan' },
  { href: '/history', label: 'Riwayat' },
];

export function Header({ fileCount }: { fileCount: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  async function handleSync() {
    setSyncing(true);
    setResult(null);

    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setResult({ error: data.error || 'Sync gagal.' });
      } else {
        setResult(data);
        router.refresh();
      }
    } catch {
      setResult({ error: 'Koneksi gagal saat sync.' });
    } finally {
      setSyncing(false);
      setTimeout(() => setResult(null), 5000);
    }
  }

  return (
    <header className="border-b border-base-700/60">
      <div className="flex items-center justify-between py-5 px-6 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-tg-500 to-tg-600 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
              <path d="M21.05 3.79a1.5 1.5 0 0 0-1.56-.27L2.8 10.36a1.4 1.4 0 0 0 .12 2.63l4.3 1.39 1.66 5.32c.16.5.6.84 1.13.84.32 0 .62-.12.85-.34l2.4-2.27 4.36 3.2c.25.18.55.28.85.28a1.4 1.4 0 0 0 1.38-1.13l3.07-14.6a1.5 1.5 0 0 0-.42-1.4z" />
            </svg>
          </div>
          <div>
            <h1 className="font-display font-semibold text-lg leading-tight">
              TeleDrive
            </h1>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-ok-400 animate-pulse-dot" />
              <span className="text-xs text-ink-500">
                Terhubung · {fileCount} file
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {result && (
            <span
              className={`text-xs hidden sm:inline ${
                'error' in result ? 'text-danger-400' : 'text-ok-400'
              }`}
            >
              {'error' in result
                ? result.error
                : result.addedFiles + result.addedNotes > 0
                ? `+${result.addedFiles} file, +${result.addedNotes} catatan dipulihkan`
                : 'Sudah lengkap'}
            </span>
          )}

          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-100 transition-colors px-3 py-1.5 rounded-lg hover:bg-base-800 disabled:opacity-50"
            title="Tarik ulang data lama dari Telegram yang belum tercatat"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`}
            >
              <path
                d="M4 4v5h5M20 20v-5h-5M19.4 9a8 8 0 0 0-14.8 0M4.6 15a8 8 0 0 0 14.8 0"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="hidden sm:inline">
              {syncing ? 'Sinkronisasi...' : 'Sync'}
            </span>
          </button>

          <button
            onClick={handleLogout}
            className="text-sm text-ink-500 hover:text-ink-100 transition-colors px-3 py-1.5 rounded-lg hover:bg-base-800"
          >
            Keluar
          </button>
        </div>
      </div>

      <nav className="flex gap-1 px-6 sm:px-8">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-3.5 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                active
                  ? 'text-tg-500 border-tg-500'
                  : 'text-ink-500 border-transparent hover:text-ink-300'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
