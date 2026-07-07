import { NextRequest, NextResponse } from 'next/server';
import { listDevices, updateDeviceHeartbeat } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key') ?? '';
  if (!apiKey) {
    return NextResponse.json({ error: 'API key wajib dikirim.' }, { status: 401 });
  }

  try {
    const devices = await listDevices();
    const device = devices.find((item) => item.apiKey === apiKey);
    if (!device) {
      return NextResponse.json({ error: 'API key perangkat tidak ditemukan.' }, { status: 404 });
    }

    await updateDeviceHeartbeat(device.id);

    return NextResponse.json({
      device: {
        id: device.id,
        name: device.name,
        folderPath: device.folderPath,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Gagal menghubungkan perangkat.' },
      { status: 500 }
    );
  }
}
