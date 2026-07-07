// app/api/clients/[id]/heartbeat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { updateDeviceHeartbeat } from '@/lib/store';

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const ok = await updateDeviceHeartbeat(id);
    if (!ok) return NextResponse.json({ error: 'Perangkat tidak ditemukan.' }, { status: 404 });
    return NextResponse.json({ ok: true, at: new Date().toISOString() });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
