// app/notes/page.tsx
import { listNotes, listIndex } from '@/lib/store';
import { isConfigured } from '@/lib/telegram';
import { NotesBoard } from '@/components/NotesBoard';
import { SetupNotice } from '@/components/SetupNotice';

export const dynamic = 'force-dynamic';

export default async function NotesPage() {
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

  let notes: Awaited<ReturnType<typeof listNotes>> = [];
  let files: Awaited<ReturnType<typeof listIndex>> = [];

  try {
    [notes, files] = await Promise.all([listNotes(), listIndex()]);
  } catch (err: any) {
    return (
      <SetupNotice
        title="Gagal memuat data"
        message={err.message || 'Gagal mengambil daftar catatan.'}
        detail="Pastikan integrasi Redis (Upstash) sudah dihubungkan ke project ini."
      />
    );
  }

  return <NotesBoard initialNotes={notes} fileCount={files.length} />;
}
