// app/api/clients/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { listDevices, addDevice, addLog } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const devices = await listDevices();
    return NextResponse.json({ devices });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, folderPath } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Nama perangkat wajib diisi.' }, { status: 400 });
    }
    const device = await addDevice(name.trim(), folderPath?.trim() ?? '~/TeleDrive');
    await addLog('sync', `Perangkat baru: ${device.name}`);
    return NextResponse.json({ device });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
