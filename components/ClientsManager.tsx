// components/ClientsManager.tsx
'use client';

import { useState } from 'react';
import type { Device } from '@/lib/store';
import { Header } from './Header';
import { formatRelative } from '@/lib/format';

function StatusDot({ online }: { online: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${
        online ? 'bg-ok-400 animate-pulse-dot' : 'bg-base-600'
      }`}
    />
  );
}

function DeviceCard({
  device,
  onDeleted,
  deployUrl,
}: {
  device: Device & { online: boolean };
  onDeleted: (id: string) => void;
  deployUrl: string;
}) {
  const [showKey, setShowKey] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/clients/${device.id}`, { method: 'DELETE' });
    if (res.ok) onDeleted(device.id);
    else setDeleting(false);
  }

  function downloadScript() {
    const script = `#!/bin/bash
# TeleDrive Sync — ${device.name}
# Dibuat otomatis dari TeleDrive web. Jangan bagikan file ini.
cd "$(dirname "$0")"
python3 daemon.py \\
  --folder "${device.folderPath}" \\
  --url "${deployUrl}" \\
  --api-key "${device.apiKey}" \\
  --client-id "${device.id}" \\
  --interval 30 \\
  --log-file ~/teledrive-${device.id.slice(0,8)}.log
`;
    const blob = new Blob([script], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `start-${device.name.replace(/\s+/g, '-').toLowerCase()}.sh`;
    a.click();
  }

  function copyKey() {
    navigator.clipboard.writeText(device.apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-base-800/70 border border-base-700 rounded-xl p-5 hover:border-base-600 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <StatusDot online={device.online} />
          <h3 className="font-semibold text-ink-100">{device.name}</h3>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${
            device.online
              ? 'text-ok-400 border-ok-400/30 bg-ok-400/10'
              : 'text-ink-500 border-base-700 bg-base-800'
          }`}>
            {device.online ? 'Online' : 'Offline'}
          </span>
        </div>

        {!confirm ? (
          <button
            onClick={() => setConfirm(true)}
            className="p-1.5 text-ink-500 hover:text-danger-400 hover:bg-base-700 rounded-lg transition-colors"
            title="Hapus perangkat"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
              <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m1 0v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V7h10Z"
                stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : (
          <div className="flex gap-1.5">
            <button onClick={() => setConfirm(false)}
              className="text-xs px-2.5 py-1 rounded-lg border border-base-700 text-ink-500 hover:bg-base-700">
              Batal
            </button>
            <button onClick={handleDelete} disabled={deleting}
              className="text-xs px-2.5 py-1 rounded-lg bg-danger-400/15 text-danger-400 hover:bg-danger-400/25 disabled:opacity-50">
              {deleting ? 'Hapus...' : 'Hapus'}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-1.5 text-xs text-ink-500 font-mono mb-4">
        <div className="flex items-center gap-2">
          <span className="text-ink-500 font-sans">Folder</span>
          <span className="text-ink-300">{device.folderPath}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-ink-500 font-sans">Terakhir sync</span>
          <span className="text-ink-300">
            {device.lastSeen ? formatRelative(device.lastSeen) : 'Belum pernah'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-ink-500 font-sans">API Key</span>
          <span className="text-ink-300">
            {showKey ? device.apiKey : '••••••••••••••••••••'}
          </span>
          <button onClick={() => setShowKey(!showKey)}
            className="text-tg-500 hover:opacity-70">
            {showKey ? 'Sembunyikan' : 'Tampilkan'}
          </button>
          {showKey && (
            <button onClick={copyKey} className="text-tg-500 hover:opacity-70">
              {copied ? '✅ Disalin' : 'Salin'}
            </button>
          )}
        </div>
      </div>

      <button
        onClick={downloadScript}
        className="w-full flex items-center justify-center gap-2 text-sm font-medium border border-tg-500/40 text-tg-500 hover:bg-tg-500/10 rounded-lg py-2 transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
          <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 19h14"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Download Script (.sh)
      </button>
    </div>
  );
}

function AddDeviceForm({
  onAdded,
}: {
  onAdded: (device: Device & { online: boolean }) => void;
}) {
  const [name, setName] = useState('');
  const [folder, setFolder] = useState('~/TeleDrive');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!name.trim()) { setError('Nama perangkat wajib diisi.'); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), folderPath: folder.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      onAdded({ ...data.device, online: false });
      setName(''); setFolder('~/TeleDrive');
    } catch { setError('Koneksi gagal.'); }
    finally { setLoading(false); }
  }

  return (
    <div className="bg-base-800/50 border border-base-700 border-dashed rounded-xl p-5">
      <h3 className="font-semibold text-sm text-ink-100 mb-4">+ Tambah Perangkat</h3>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-ink-500 mb-1 block">Nama Perangkat</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="cth: PC Kantor, Laptop Rumah"
            className="w-full bg-base-900 border border-base-700 rounded-lg px-3.5 py-2.5 text-sm text-ink-100 placeholder:text-ink-500/60 focus:border-tg-500 transition-colors"
          />
        </div>
        <div>
          <label className="text-xs text-ink-500 mb-1 block">Folder Sinkron di PC ini</label>
          <input
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            placeholder="~/TeleDrive atau /home/user/TeleDrive"
            className="w-full bg-base-900 border border-base-700 rounded-lg px-3.5 py-2.5 text-sm text-ink-100 placeholder:text-ink-500/60 focus:border-tg-500 transition-colors"
          />
        </div>
        {error && <p className="text-danger-400 text-xs">{error}</p>}
        <button
          onClick={handleAdd}
          disabled={loading}
          className="w-full bg-gradient-to-r from-tg-500 to-tg-600 text-white text-sm font-medium rounded-lg py-2.5 hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {loading ? 'Mendaftarkan...' : 'Daftarkan Perangkat'}
        </button>
      </div>
    </div>
  );
}

export function ClientsManager({
  initialDevices,
  fileCount,
  deployUrl,
}: {
  initialDevices: (Device & { online: boolean })[];
  fileCount: number;
  deployUrl: string;
}) {
  const [devices, setDevices] = useState(initialDevices);

  function handleAdded(device: Device & { online: boolean }) {
    setDevices((prev) => [...prev, device]);
  }

  function handleDeleted(id: string) {
    setDevices((prev) => prev.filter((d) => d.id !== id));
  }

  const online  = devices.filter((d) => d.online).length;
  const offline = devices.filter((d) => !d.online).length;

  return (
    <div className="max-w-6xl mx-auto">
      <Header fileCount={fileCount} />
      <main className="px-6 sm:px-8 py-8 space-y-6">

        {/* Info panel */}
        <div className="bg-base-800/40 border border-base-700/60 rounded-xl p-4 flex items-start gap-3">
          <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-tg-500 shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/>
            <path d="M12 8v4m0 4h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <div className="text-xs text-ink-500 space-y-1">
            <p>Daftarkan setiap PC/laptop yang ingin tersinkron dengan TeleDrive.</p>
            <p>Setiap perangkat mendapat <span className="text-ink-300">API key unik</span> — download script-nya, jalankan di PC tersebut, dan sinkronisasi berjalan otomatis.</p>
            <p>Daemon masih harus <span className="text-ink-300">dijalankan di PC lokal</span> — Vercel tidak bisa menjalankan proses background.</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-3">
          <div className="bg-base-800/60 border border-base-700 rounded-lg px-4 py-3 flex-1 text-center">
            <p className="text-2xl font-display font-semibold text-ok-400">{online}</p>
            <p className="text-xs text-ink-500 mt-0.5">Online</p>
          </div>
          <div className="bg-base-800/60 border border-base-700 rounded-lg px-4 py-3 flex-1 text-center">
            <p className="text-2xl font-display font-semibold text-ink-500">{offline}</p>
            <p className="text-xs text-ink-500 mt-0.5">Offline</p>
          </div>
          <div className="bg-base-800/60 border border-base-700 rounded-lg px-4 py-3 flex-1 text-center">
            <p className="text-2xl font-display font-semibold text-ink-100">{devices.length}</p>
            <p className="text-xs text-ink-500 mt-0.5">Total</p>
          </div>
        </div>

        {/* Grid perangkat + form tambah */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((d) => (
            <DeviceCard
              key={d.id}
              device={d}
              onDeleted={handleDeleted}
              deployUrl={deployUrl}
            />
          ))}
          <AddDeviceForm onAdded={handleAdded} />
        </div>

        {/* Petunjuk singkat */}
        <div className="border border-base-700/60 rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-sm text-ink-100">Cara pakai di PC baru</h3>
          <ol className="space-y-2 text-xs text-ink-500 list-decimal list-inside">
            <li>Isi form di atas, klik <span className="text-ink-300">Daftarkan Perangkat</span></li>
            <li>Klik <span className="text-ink-300">Download Script (.sh)</span> di kartu perangkat baru</li>
            <li>Di PC tujuan, install Python dan watchdog:
              <code className="block bg-base-900 rounded px-3 py-1.5 mt-1 font-mono text-ink-300">pip3 install requests watchdog</code>
            </li>
            <li>Salin <code className="text-ink-300 font-mono">daemon.py</code> dan script yang didownload ke folder yang sama</li>
            <li>Jalankan:
              <code className="block bg-base-900 rounded px-3 py-1.5 mt-1 font-mono text-ink-300">bash start-nama-pc.sh</code>
            </li>
            <li>Status perangkat berubah jadi <span className="text-ok-400">Online</span> dalam 30 detik</li>
          </ol>
        </div>
      </main>
    </div>
  );
}
