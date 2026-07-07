'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type SettingsSnapshot = {
  database: {
    configured: boolean;
    urlSet: boolean;
    tokenSet: boolean;
  };
  appPassword: {
    configured: boolean;
    source: 'runtime' | 'env' | 'none';
  };
  telegram: {
    configured: boolean;
    botTokenMasked: string;
    chatIdMasked: string;
    source: 'runtime' | 'env' | 'mixed' | 'none';
  };
};

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-xs ${
        ok
          ? 'border-ok-400/30 bg-ok-400/10 text-ok-400'
          : 'border-danger-400/30 bg-danger-400/10 text-danger-400'
      }`}
    >
      {label}
    </span>
  );
}

export function SettingsPanel({ initial }: { initial: SettingsSnapshot }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initial);
  const [appPassword, setAppPassword] = useState('');
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appPassword, telegramBotToken, telegramChatId }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error || 'Gagal menyimpan pengaturan.');
      return;
    }

    setSettings(data);
    setAppPassword('');
    setTelegramBotToken('');
    setTelegramChatId('');
    setMessage('Pengaturan tersimpan.');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-xl border border-base-700 bg-base-800/45 p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink-100">Status Konfigurasi</h2>
            <p className="mt-1 text-xs text-ink-500">Runtime setting disimpan di Redis. Env var tetap menjadi fallback.</p>
          </div>
          <StatusPill ok={settings.database.configured && settings.telegram.configured} label={settings.database.configured && settings.telegram.configured ? 'Siap' : 'Perlu setup'} />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-base-700 bg-base-900/70 p-3">
            <p className="text-xs text-ink-500">Database</p>
            <p className="mt-1 text-sm font-medium text-ink-100">{settings.database.configured ? 'Terhubung' : 'Belum aktif'}</p>
          </div>
          <div className="rounded-lg border border-base-700 bg-base-900/70 p-3">
            <p className="text-xs text-ink-500">App Password</p>
            <p className="mt-1 text-sm font-medium text-ink-100">{settings.appPassword.configured ? `Aktif (${settings.appPassword.source})` : 'Belum diset'}</p>
          </div>
          <div className="rounded-lg border border-base-700 bg-base-900/70 p-3">
            <p className="text-xs text-ink-500">Telegram</p>
            <p className="mt-1 text-sm font-medium text-ink-100">{settings.telegram.configured ? `Aktif (${settings.telegram.source})` : 'Belum lengkap'}</p>
          </div>
        </div>
      </section>

      {!settings.database.configured && (
        <section className="rounded-xl border border-danger-400/30 bg-danger-400/10 p-5">
          <h2 className="text-sm font-semibold text-danger-400">Database wajib dikonfigurasi di Vercel</h2>
          <p className="mt-2 text-sm text-ink-300">
            Tambahkan environment variables <code className="font-mono text-ink-100">UPSTASH_REDIS_REST_URL</code> dan{' '}
            <code className="font-mono text-ink-100">UPSTASH_REDIS_REST_TOKEN</code>, lalu redeploy. Setelah itu Token Bot,
            Chat ID, dan App Password bisa disimpan dari halaman ini.
          </p>
        </section>
      )}

      <section className="rounded-xl border border-base-700 bg-base-800/45 p-5">
        <h2 className="text-sm font-semibold text-ink-100">Database</h2>
        <p className="mt-1 text-xs text-ink-500">
          Database dipakai untuk index file, folder, catatan, perangkat, log, dan menyimpan runtime setting.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-base-700 bg-base-900/70 p-3">
            <p className="text-xs text-ink-500">UPSTASH_REDIS_REST_URL</p>
            <p className="mt-1 text-sm font-medium text-ink-100">{settings.database.urlSet ? 'Terisi' : 'Kosong'}</p>
          </div>
          <div className="rounded-lg border border-base-700 bg-base-900/70 p-3">
            <p className="text-xs text-ink-500">UPSTASH_REDIS_REST_TOKEN</p>
            <p className="mt-1 text-sm font-medium text-ink-100">{settings.database.tokenSet ? 'Terisi' : 'Kosong'}</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-base-700 bg-base-800/45 p-5">
        <h2 className="text-sm font-semibold text-ink-100">Keamanan Aplikasi</h2>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs text-ink-500">App Password Baru</span>
          <input
            type="password"
            value={appPassword}
            onChange={(event) => setAppPassword(event.target.value)}
            disabled={!settings.database.configured}
            placeholder={settings.appPassword.configured ? 'Biarkan kosong jika tidak diubah' : 'Set password akses app'}
            className="w-full rounded-lg border border-base-700 bg-base-900 px-3.5 py-2.5 text-sm text-ink-100 placeholder:text-ink-500/60 focus:border-tg-500 disabled:opacity-50"
          />
        </label>
      </section>

      <section className="rounded-xl border border-base-700 bg-base-800/45 p-5">
        <h2 className="text-sm font-semibold text-ink-100">Telegram Storage</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs text-ink-500">Token Bot</span>
            <input
              value={telegramBotToken}
              onChange={(event) => setTelegramBotToken(event.target.value)}
              disabled={!settings.database.configured}
              placeholder={settings.telegram.botTokenMasked || '123456:ABC...'}
              className="w-full rounded-lg border border-base-700 bg-base-900 px-3.5 py-2.5 text-sm text-ink-100 placeholder:text-ink-500/60 focus:border-tg-500 disabled:opacity-50"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-ink-500">Chat ID Telegram</span>
            <input
              value={telegramChatId}
              onChange={(event) => setTelegramChatId(event.target.value)}
              disabled={!settings.database.configured}
              placeholder={settings.telegram.chatIdMasked || '-100xxxxxxxxxx'}
              className="w-full rounded-lg border border-base-700 bg-base-900 px-3.5 py-2.5 text-sm text-ink-100 placeholder:text-ink-500/60 focus:border-tg-500 disabled:opacity-50"
            />
          </label>
        </div>
      </section>

      {(message || error) && (
        <p className={`text-sm ${error ? 'text-danger-400' : 'text-ok-400'}`}>{error || message}</p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving || !settings.database.configured}
          className="rounded-lg bg-tg-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-tg-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </button>
      </div>
    </form>
  );
}
