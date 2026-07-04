// app/api/clients/[id]/heartbeat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { updateDeviceHeartbeat } from '@/lib/store';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ok = await updateDeviceHeartbeat(params.id);
    if (!ok) return NextResponse.json({ error: 'Perangkat tidak ditemukan.' }, { status: 404 });
    return NextResponse.json({ ok: true, at: new Date().toISOString() });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
