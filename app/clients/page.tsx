// app/clients/page.tsx
import { listDevices, listIndex, isDeviceOnline } from '@/lib/store';
import { ClientsManager } from '@/components/ClientsManager';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  const [devices, files] = await Promise.all([listDevices(), listIndex()]);

  const devicesWithStatus = devices.map((d) => ({
    ...d,
    online: isDeviceOnline(d),
  }));

  // Ambil URL deployment dari request headers
  const headersList = headers();
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
