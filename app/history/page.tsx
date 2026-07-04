// app/history/page.tsx
import { listLogs, listIndex } from '@/lib/store';
import { HistoryLog } from '@/components/HistoryLog';

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  const [logs, files] = await Promise.all([listLogs(200), listIndex()]);

  return <HistoryLog initialLogs={logs} fileCount={files.length} />;
}
