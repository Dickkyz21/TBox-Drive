// app/page.tsx
import { listIndex } from '@/lib/store';
import { isConfigured } from '@/lib/telegram';
import { Drive } from '@/components/Drive';
import { SetupNotice } from '@/components/SetupNotice';

export const dynamic = 'force-dynamic';

export default async function Home() {
  if (!isConfigured()) {
    return (
      <SetupNotice
        title="Belum dikonfigurasi"
        message={
          <>
            Atur environment variable{' '}
            <code className="text-tg-500 font-mono">TELEGRAM_BOT_TOKEN</code>{' '}
            dan{' '}
            <code className="text-tg-500 font-mono">TELEGRAM_CHAT_ID</code>{' '}
            di project Vercel kamu, lalu deploy ulang.
          </>
        }
      />
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
      <SetupNotice
        title="Gagal memuat data"
        message={loadError}
        detail="Pastikan integrasi Redis (Upstash) sudah dihubungkan ke project ini."
      />
    );
  }

  return <Drive initialFiles={files} />;
}
