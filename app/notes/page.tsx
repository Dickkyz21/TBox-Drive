// app/notes/page.tsx
import { listNotes, listIndex } from '@/lib/store';
import { isConfigured } from '@/lib/telegram';
import { NotesBoard } from '@/components/NotesBoard';

export const dynamic = 'force-dynamic';

export default async function NotesPage() {
  if (!isConfigured()) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="font-display font-semibold text-xl mb-2">
            Belum dikonfigurasi
          </h1>
          <p className="text-ink-500 text-sm">
            Atur <code className="text-tg-500 font-mono">TELEGRAM_BOT_TOKEN</code>{' '}
            dan <code className="text-tg-500 font-mono">TELEGRAM_CHAT_ID</code>{' '}
            di Vercel, lalu deploy ulang.
          </p>
        </div>
      </div>
    );
  }

  const [notes, files] = await Promise.all([listNotes(), listIndex()]);

  return <NotesBoard initialNotes={notes} fileCount={files.length} />;
}
