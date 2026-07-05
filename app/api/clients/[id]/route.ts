// app/api/clients/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { removeDevice, addLog } from '@/lib/store';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await removeDevice(params.id);
    await addLog('sync', `Perangkat dihapus: ${params.id}`);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
