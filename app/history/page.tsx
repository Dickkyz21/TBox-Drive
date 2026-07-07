// app/history/page.tsx
import { listLogs, listIndex } from '@/lib/store';
import { HistoryLog } from '@/components/HistoryLog';
import { SetupNotice } from '@/components/SetupNotice';

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  let logs: Awaited<ReturnType<typeof listLogs>> = [];
  let files: Awaited<ReturnType<typeof listIndex>> = [];

  try {
    [logs, files] = await Promise.all([listLogs(200), listIndex()]);
  } catch (err: any) {
    return (
      <SetupNotice
        title="Gagal memuat riwayat"
        message={err.message || 'Gagal mengambil riwayat aktivitas.'}
        detail="Pastikan integrasi Redis (Upstash) sudah dihubungkan ke project ini."
      />
    );
  }

  return <HistoryLog initialLogs={logs} fileCount={files.length} />;
}
