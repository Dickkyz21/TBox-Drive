// app/api/clients/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { removeDevice, addLog } from '@/lib/store';

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await removeDevice(id);
    await addLog('sync', `Perangkat dihapus: ${id}`);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
