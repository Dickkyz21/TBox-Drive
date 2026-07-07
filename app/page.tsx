// app/page.tsx
import { listFolders, listIndex } from '@/lib/store';
import { isConfigured } from '@/lib/telegram';
import { Drive } from '@/components/Drive';
import { SetupNotice } from '@/components/SetupNotice';

export const dynamic = 'force-dynamic';

export default async function Home() {
  if (!(await isConfigured())) {
    return (
      <SetupNotice
        title="Belum dikonfigurasi"
        message={
          <>
            Atur Token Bot dan Chat ID Telegram dari menu Pengaturan. Jika database belum aktif,
            tambahkan Upstash Redis environment variables di Vercel terlebih dahulu.
          </>
        }
      />
    );
  }

  let files: Awaited<ReturnType<typeof listIndex>> = [];
  let folders: Awaited<ReturnType<typeof listFolders>> = [];
  let loadError: string | null = null;

  try {
    [files, folders] = await Promise.all([listIndex(), listFolders()]);
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

  return <Drive initialFiles={files} initialFolders={folders} />;
}
