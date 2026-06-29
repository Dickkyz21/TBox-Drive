// components/Header.tsx
'use client';

import { useRouter } from 'next/navigation';

export function Header({ fileCount }: { fileCount: number }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="flex items-center justify-between py-5 px-6 sm:px-8 border-b border-base-700/60">
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

      <button
        onClick={handleLogout}
        className="text-sm text-ink-500 hover:text-ink-100 transition-colors px-3 py-1.5 rounded-lg hover:bg-base-800"
      >
        Keluar
      </button>
    </header>
  );
}
