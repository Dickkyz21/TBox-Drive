// app/api/debug/route.ts — HAPUS setelah masalah selesai
import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const result: Record<string, any> = {};

  // 1. Semua env variable yang mungkin dipakai
  result.env = {
    UPSTASH_REDIS_REST_URL:   process.env.UPSTASH_REDIS_REST_URL   ? '✅ ADA' : '❌ TIDAK ADA',
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN ? '✅ ADA' : '❌ TIDAK ADA',
    KV_REST_API_URL:          process.env.KV_REST_API_URL          ? '✅ ADA' : '❌ TIDAK ADA',
    KV_REST_API_TOKEN:        process.env.KV_REST_API_TOKEN        ? '✅ ADA' : '❌ TIDAK ADA',
    KV_URL:                   process.env.KV_URL                   ? '✅ ADA' : '❌ TIDAK ADA',
    TELEGRAM_BOT_TOKEN:       process.env.TELEGRAM_BOT_TOKEN       ? '✅ ADA' : '❌ TIDAK ADA',
    TELEGRAM_CHAT_ID:         process.env.TELEGRAM_CHAT_ID         ? '✅ ADA' : '❌ TIDAK ADA',
  };

  // 2. URL yang akan dipakai
  const url   = process.env.UPSTASH_REDIS_REST_URL   ?? process.env.KV_REST_API_URL   ?? '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? '';

  result.redis_url_preview = url   ? url.slice(0, 50) + '...'   : '❌ KOSONG';
  result.redis_token_used  = token ? '✅ ADA'                    : '❌ KOSONG';

  if (!url || !token) {
    result.diagnosis = '❌ GAGAL: URL atau TOKEN Redis kosong — integrasi Redis belum terhubung ke project ini';
    return NextResponse.json(result);
  }

  // 3. Ping Redis
  try {
    const redis = new Redis({ url, token });
    result.ping = await redis.ping(); // harusnya "PONG"

    // 4. Tulis + baca test
    await redis.set('td:dbg', 'ok', { ex: 30 });
    const v = await redis.get('td:dbg');
    result.write_read_test = v === 'ok' ? '✅ BERHASIL' : `❌ GAGAL (dapat: ${v})`;

    // 5. Hitung entri
    const fc = await redis.zcard('teledrive:files');
    const nc = await redis.zcard('teledrive:notes');
    const lc = await redis.zcard('teledrive:log');
    result.redis_counts = { files: fc, notes: nc, logs: lc };

    // 6. Baca 3 entri pertama dari files
    const sample = await redis.zrange('teledrive:files', 0, 2);
    result.files_sample = sample;

    // 7. Coba parse
    result.parse_test = sample.map((s: any) => {
      try { return { ok: true, parsed: JSON.parse(s) }; }
      catch (e: any) { return { ok: false, error: e.message, raw: String(s).slice(0, 100) }; }
    });

  } catch (e: any) {
    result.redis_error = e.message;
    result.diagnosis = '❌ GAGAL konek ke Redis: ' + e.message;
  }

  return NextResponse.json(result, { status: 200 });
}
