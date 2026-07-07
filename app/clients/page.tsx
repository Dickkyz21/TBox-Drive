// app/clients/page.tsx
import { listDevices, listIndex, isDeviceOnline } from '@/lib/store';
import { ClientsManager } from '@/components/ClientsManager';
import { SetupNotice } from '@/components/SetupNotice';
import { headers } from 'next/headers';
import { isConfigured } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  if (!(await isConfigured())) {
    return (
      <SetupNotice
        title="Telegram belum dikonfigurasi"
        message="Atur Token Bot dan Chat ID Telegram terlebih dahulu."
      />
    );
  }

  let devices: Awaited<ReturnType<typeof listDevices>> = [];
  let files: Awaited<ReturnType<typeof listIndex>> = [];

  try {
    [devices, files] = await Promise.all([listDevices(), listIndex()]);
  } catch (err: any) {
    return (
      <SetupNotice
        title="Gagal memuat perangkat"
        message={err.message || 'Gagal mengambil daftar perangkat.'}
        detail="Pastikan integrasi Redis (Upstash) sudah dihubungkan ke project ini."
      />
    );
  }

  const devicesWithStatus = devices.map((d) => ({
    ...d,
    online: isDeviceOnline(d),
  }));

  // Ambil URL deployment dari request headers
  const headersList = await headers();
  const host = headersList.get('host') ?? '';
  const proto = host.includes('localhost') ? 'http' : 'https';
  const deployUrl = `${proto}://${host}`;

  return (
    <ClientsManager
      initialDevices={devicesWithStatus}
      fileCount={files.length}
      deployUrl={deployUrl}
    />
  );
}
