import { Header } from '@/components/Header';
import { SettingsPanel } from '@/components/SettingsPanel';
import { listIndex } from '@/lib/store';
import { getEffectiveSettings, maskSecret } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const effective = await getEffectiveSettings();
  let fileCount = 0;

  try {
    fileCount = (await listIndex()).length;
  } catch {
    fileCount = 0;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Header fileCount={fileCount} />
      <main className="space-y-6 px-6 py-8 sm:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-tg-500">Settings</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink-100">Pengaturan</h1>
          <p className="mt-1 text-sm text-ink-500">
            Kelola password aplikasi, Telegram Bot, Chat ID, dan status database.
          </p>
        </div>

        <SettingsPanel
          initial={{
            database: effective.database,
            appPassword: effective.appPassword,
            telegram: {
              configured: effective.telegram.configured,
              botTokenMasked: maskSecret(effective.telegram.botToken),
              chatIdMasked: maskSecret(effective.telegram.chatId),
              source: effective.telegram.source,
            },
          }}
        />
      </main>
    </div>
  );
}
