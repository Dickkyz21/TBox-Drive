// components/ClientsManager.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Device } from '@/lib/store';
import { Header } from './Header';
import { formatRelative } from '@/lib/format';
import { Pagination } from './Pagination';

type ViewMode = 'grid' | 'list';

function StatusDot({ online }: { online: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${
        online ? 'bg-ok-400 animate-pulse-dot' : 'bg-base-600'
      }`}
    />
  );
}

function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 12) return '••••••••••••';
  return `${apiKey.slice(0, 7)}••••••••••••••••${apiKey.slice(-5)}`;
}

function DeviceCard({
  device,
  onDeleted,
}: {
  device: Device & { online: boolean };
  onDeleted: (id: string) => void;
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


  function copyKey() {
    navigator.clipboard.writeText(device.apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-base-800/70 border border-base-700 rounded-xl overflow-hidden hover:border-base-600 transition-colors">
      <div className="border-b border-base-700/70 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <StatusDot online={device.online} />
              <h3 className="truncate font-semibold text-ink-100">{device.name}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${
                device.online
                  ? 'text-ok-400 border-ok-400/30 bg-ok-400/10'
                  : 'text-ink-500 border-base-700 bg-base-900'
              }`}>
                {device.online ? 'Online' : 'Offline'}
              </span>
            </div>
            <p className="mt-1 text-xs font-mono text-ink-500">
              ID {device.id.slice(0, 8)}
            </p>
          </div>

          {!confirm ? (
            <button
              onClick={() => setConfirm(true)}
              className="p-2 text-ink-500 hover:text-danger-400 hover:bg-base-700 rounded-lg transition-colors"
              title="Hapus perangkat"
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
                <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m1 0v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V7h10Z"
                  stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            <div className="flex shrink-0 gap-1.5">
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
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
          <div className="rounded-lg border border-base-700 bg-base-900/70 px-3 py-2.5">
            <p className="mb-1 text-ink-500">Folder sinkron</p>
            <p className="truncate font-mono text-ink-300" title={device.folderPath}>
              {device.folderPath}
            </p>
          </div>
          <div className="rounded-lg border border-base-700 bg-base-900/70 px-3 py-2.5">
            <p className="mb-1 text-ink-500">Heartbeat</p>
            <p className="font-mono text-ink-300">
              {device.lastSeen ? formatRelative(device.lastSeen) : 'Belum pernah'}
            </p>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-ink-300">API Key Client</p>
            <span className="rounded-full border border-warn-400/25 bg-warn-400/10 px-2 py-0.5 text-[11px] text-warn-400">
              Rahasia
            </span>
          </div>
          <div className="rounded-lg border border-base-700 bg-base-950 p-2">
            <div className="flex items-center gap-2">
              <code
                className="min-w-0 flex-1 truncate px-2 font-mono text-xs text-ink-300"
                title={showKey ? device.apiKey : 'API key disembunyikan'}
              >
                {showKey ? device.apiKey : maskApiKey(device.apiKey)}
              </code>
              <button
                onClick={() => setShowKey(!showKey)}
                className="shrink-0 rounded-md px-2.5 py-1.5 text-xs text-ink-500 hover:bg-base-800 hover:text-ink-100"
                title={showKey ? 'Sembunyikan API key' : 'Tampilkan API key'}
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
              <button
                onClick={copyKey}
                className="shrink-0 rounded-md bg-tg-500/10 px-2.5 py-1.5 text-xs font-medium text-tg-500 hover:bg-tg-500/20"
                title="Salin API key"
              >
                {copied ? 'Disalin' : 'Copy'}
              </button>
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-4 text-ink-500">
            Key ini dipakai TeleDrive Desktop Client untuk connect, upload, heartbeat, dan sinkronisasi perangkat.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {showKey && (
            <button
              onClick={copyKey}
              className="col-span-2 rounded-lg border border-base-700 py-2 text-sm font-medium text-ink-300 hover:bg-base-700/70"
            >
              {copied ? 'API key berhasil disalin' : 'Salin API Key'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DeviceListRow({
  device,
  onDeleted,
}: {
  device: Device & { online: boolean };
  onDeleted: (id: string) => void;
}) {
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/clients/${device.id}`, { method: 'DELETE' });
    if (res.ok) onDeleted(device.id);
    else setDeleting(false);
  }

  function copyKey() {
    navigator.clipboard.writeText(device.apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="grid grid-cols-1 gap-4 border-b border-base-700/60 px-4 py-4 last:border-b-0 lg:grid-cols-[1.4fr_1.2fr_1.6fr_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <StatusDot online={device.online} />
          <p className="truncate text-sm font-semibold text-ink-100">{device.name}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${
            device.online
              ? 'text-ok-400 border-ok-400/30 bg-ok-400/10'
              : 'text-ink-500 border-base-700 bg-base-900'
          }`}>
            {device.online ? 'Online' : 'Offline'}
          </span>
        </div>
        <p className="mt-1 text-xs font-mono text-ink-500">ID {device.id.slice(0, 8)}</p>
      </div>

      <div className="min-w-0 text-xs">
        <p className="text-ink-500">Folder sinkron</p>
        <p className="mt-1 truncate font-mono text-ink-300" title={device.folderPath}>
          {device.folderPath}
        </p>
      </div>

      <div className="min-w-0">
        <div className="mb-1 flex items-center justify-between gap-3">
          <p className="text-xs text-ink-500">API Key Client</p>
          <p className="text-xs font-mono text-ink-500">
            {device.lastSeen ? formatRelative(device.lastSeen) : 'Belum pernah'}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-base-700 bg-base-950 p-2">
          <code className="min-w-0 flex-1 truncate px-1 font-mono text-xs text-ink-300">
            {showKey ? device.apiKey : maskApiKey(device.apiKey)}
          </code>
          <button
            onClick={() => setShowKey(!showKey)}
            className="rounded-md px-2 py-1 text-xs text-ink-500 hover:bg-base-800 hover:text-ink-100"
          >
            {showKey ? 'Hide' : 'Show'}
          </button>
          <button
            onClick={copyKey}
            className="rounded-md bg-tg-500/10 px-2 py-1 text-xs font-medium text-tg-500 hover:bg-tg-500/20"
          >
            {copied ? 'Disalin' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 lg:justify-end">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-lg border border-base-700 px-3 py-2 text-sm text-ink-500 hover:bg-base-700 hover:text-danger-400 disabled:opacity-50"
        >
          {deleting ? 'Hapus...' : 'Hapus'}
        </button>
      </div>
    </div>
  );
}

function AddDeviceForm({
  onAdded,
  onCancel,
}: {
  onAdded: (device: Device & { online: boolean }) => void;
  onCancel?: () => void;
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
    <div>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-sm text-ink-100">Tambah Perangkat</h3>
          <p className="mt-1 text-xs text-ink-500">Buat API key baru untuk TeleDrive Desktop Client.</p>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-tg-500/10 text-tg-500">
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
      </div>
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
          className="w-full bg-tg-500 text-white text-sm font-medium rounded-lg py-2.5 hover:bg-tg-600 transition-colors disabled:opacity-40"
        >
          {loading ? 'Mendaftarkan...' : 'Daftarkan Perangkat'}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={loading}
            className="w-full rounded-lg border border-base-700 py-2.5 text-sm font-medium text-ink-300 hover:bg-base-700/60 disabled:opacity-40"
          >
            Batal
          </button>
        )}
      </div>
    </div>
  );
}

function AddDeviceModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: (device: Device & { online: boolean }) => void;
}) {
  if (!open) return null;

  function handleAdded(device: Device & { online: boolean }) {
    onAdded(device);
    onClose();
  }

  return (
    <>
      <button
        type="button"
        aria-label="Tutup tambah perangkat"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-base-950/70 backdrop-blur-sm"
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border border-base-700 bg-base-800 p-5 shadow-2xl">
          <AddDeviceForm onAdded={handleAdded} onCancel={onClose} />
        </div>
      </div>
    </>
  );
}

export function ClientsManager({
  initialDevices,
  fileCount,
}: {
  initialDevices: (Device & { online: boolean })[];
  fileCount: number;
}) {
  const [devices, setDevices] = useState(initialDevices);
  const [view, setView] = useState<ViewMode>('grid');
  const [addOpen, setAddOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  function handleAdded(device: Device & { online: boolean }) {
    setDevices((prev) => [...prev, device]);
  }

  function handleDeleted(id: string) {
    setDevices((prev) => prev.filter((d) => d.id !== id));
  }

  const online  = devices.filter((d) => d.online).length;
  const offline = devices.filter((d) => !d.online).length;
  const totalPages = Math.max(1, Math.ceil(devices.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedDevices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return devices.slice(start, start + pageSize);
  }, [devices, currentPage, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

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
            <p>Setiap perangkat mendapat <span className="text-ink-300">API key unik</span> untuk dipasang di TeleDrive Desktop Client.</p>
            <p>Install client di PC lokal, paste API key, pilih folder sinkron, lalu klik <span className="text-ink-300">Connect</span>.</p>
          </div>
        </div>

        <div className="rounded-xl border border-base-700 bg-base-800/70 p-4 shadow-glow">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-ink-100">TeleDrive Desktop Client</p>
                <span className="rounded border border-ok-400/30 bg-ok-400/10 px-2 py-0.5 text-[11px] font-medium text-ok-400">
                  ON/OFF Control
                </span>
                <span className="rounded border border-warn-400/30 bg-warn-400/10 px-2 py-0.5 text-[11px] font-medium text-warn-400">
                  Windows Startup
                </span>
                <span className="rounded border border-violet-400/30 bg-violet-400/10 px-2 py-0.5 text-[11px] font-medium text-violet-400">
                  Linux All-in-One
                </span>
              </div>
              <p className="mt-1 text-xs text-ink-500">
                GUI baru bergaya control panel: ON untuk menjalankan sync, OFF untuk stop dan close aplikasi.
                File Linux sudah mencakup client, cek Python/tkinter/venv, dan opsi install driver pendukung.
              </p>
            </div>
            <div className="grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:min-w-[360px]">
              <a
                href="/api/desktop-client"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-tg-500 px-3 py-2 text-sm font-medium text-white hover:bg-tg-600"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                  <path d="M12 4v10m0 0 4-4m-4 4-4-4M5 20h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Client
              </a>
              <a
                href="/api/desktop-client?platform=linux-launcher"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-violet-400/40 px-3 py-2 text-sm font-medium text-violet-400 hover:bg-violet-400/10"
              >
                Linux All-in-One
              </a>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-base-800/60 border border-base-700 rounded-lg px-4 py-3 text-center">
            <p className="text-2xl font-display font-semibold text-ok-400">{online}</p>
            <p className="text-xs text-ink-500 mt-0.5">Online</p>
          </div>
          <div className="bg-base-800/60 border border-base-700 rounded-lg px-4 py-3 text-center">
            <p className="text-2xl font-display font-semibold text-ink-500">{offline}</p>
            <p className="text-xs text-ink-500 mt-0.5">Offline</p>
          </div>
          <div className="bg-base-800/60 border border-base-700 rounded-lg px-4 py-3 text-center">
            <p className="text-2xl font-display font-semibold text-ink-100">{devices.length}</p>
            <p className="text-xs text-ink-500 mt-0.5">Total</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-base-700 bg-base-800/45 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-ink-100">Perangkat Client</p>
            <p className="mt-1 text-xs text-ink-500">
              Kelola API key desktop client dan status sinkronisasi.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-base-700 bg-base-900 p-1">
              <button
                onClick={() => setView('grid')}
                className={`rounded-md p-2 ${view === 'grid' ? 'bg-base-700 text-ink-100' : 'text-ink-500 hover:text-ink-100'}`}
                title="Grid"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                  <path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </button>
              <button
                onClick={() => setView('list')}
                className={`rounded-md p-2 ${view === 'list' ? 'bg-base-700 text-ink-100' : 'text-ink-500 hover:text-ink-100'}`}
                title="List"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                  <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <button
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-tg-500 px-4 py-2 text-sm font-medium text-white hover:bg-tg-600"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              Tambah Perangkat
            </button>
          </div>
        </div>

        {devices.length === 0 ? (
          <div className="rounded-xl border border-base-700 bg-base-800/45 px-5 py-12 text-center">
            <p className="text-sm font-medium text-ink-100">Belum ada perangkat terdaftar</p>
            <p className="mt-1 text-xs text-ink-500">Tambahkan perangkat pertama untuk membuat API key desktop client.</p>
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {paginatedDevices.map((d) => (
              <DeviceCard
                key={d.id}
                device={d}
                onDeleted={handleDeleted}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-base-700 bg-base-800/50">
            {paginatedDevices.map((d) => (
              <DeviceListRow
                key={d.id}
                device={d}
                onDeleted={handleDeleted}
              />
            ))}
          </div>
        )}

        <Pagination
          totalItems={devices.length}
          page={currentPage}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          itemLabel="perangkat"
        />
      </main>

      <AddDeviceModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={handleAdded}
      />
    </div>
  );
}
