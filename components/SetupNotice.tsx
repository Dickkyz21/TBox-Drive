import type { ReactNode } from 'react';
import Link from 'next/link';

export function SetupNotice({
  title,
  message,
  detail,
  actionHref = '/settings',
  actionLabel = 'Buka Pengaturan',
}: {
  title: string;
  message: ReactNode;
  detail?: ReactNode;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="min-h-screen bg-base-950/70 px-6">
      <div className="fixed inset-0 flex items-center justify-center px-6 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl border border-base-700 bg-base-800 p-6 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-tg-500/10 text-tg-500">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path d="M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="mb-2 font-display text-xl font-semibold">{title}</h1>
          <p className="text-sm text-ink-500">{message}</p>
          {detail && <p className="mt-2 text-xs text-ink-500">{detail}</p>}
          {actionHref && (
            <Link
              href={actionHref}
              className="mt-5 inline-flex items-center justify-center rounded-lg bg-tg-500 px-4 py-2 text-sm font-medium text-white hover:bg-tg-600"
            >
              {actionLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
