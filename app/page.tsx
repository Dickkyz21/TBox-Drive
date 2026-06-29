// app/page.tsx
import { listIndex } from '@/lib/store';
import { isConfigured } from '@/lib/telegram';
import { Drive } from '@/components/Drive';

export const dynamic = 'force-dynamic';

export default async function Home() {
  if (!isConfigured()) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="font-display font-semibold text-xl mb-2">
            Belum dikonfigurasi
          </h1>
          <p className="text-ink-500 text-sm">
            Atur environment variable{' '}
            <code className="text-tg-500 font-mono">TELEGRAM_BOT_TOKEN</code>{' '}
            dan{' '}
            <code className="text-tg-500 font-mono">TELEGRAM_CHAT_ID</code>{' '}
            di project Vercel kamu, lalu deploy ulang.
          </p>
        </div>
      </div>
    );
  }

  let files: Awaited<ReturnType<typeof listIndex>> = [];
  let loadError: string | null = null;

  try {
    files = await listIndex();
  } catch (err: any) {
    loadError = err.message || 'Gagal memuat daftar file.';
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="font-display font-semibold text-xl mb-2">
            Gagal memuat data
          </h1>
          <p className="text-ink-500 text-sm">{loadError}</p>
          <p className="text-ink-500 text-xs mt-2">
            Pastikan integrasi Redis (Upstash) sudah dihubungkan ke project ini.
          </p>
        </div>
      </div>
    );
  }

  return <Drive initialFiles={files} />;
}
