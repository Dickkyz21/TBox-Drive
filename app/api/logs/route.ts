// app/api/logs/route.ts
import { NextResponse } from 'next/server';
import { listLogs } from '@/lib/store';

export async function GET() {
  try {
    const logs = await listLogs(200);
    return NextResponse.json({ logs });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Gagal mengambil riwayat aktivitas.' },
      { status: 500 }
    );
  }
}
