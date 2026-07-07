import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (process.env.DEBUG_ROUTE_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Debug endpoint tidak aktif.' }, { status: 404 });
  }

  const result: Record<string, any> = {};

  result.env = {
    UPSTASH_REDIS_REST_URL: Boolean(process.env.UPSTASH_REDIS_REST_URL),
    UPSTASH_REDIS_REST_TOKEN: Boolean(process.env.UPSTASH_REDIS_REST_TOKEN),
    KV_REST_API_URL: Boolean(process.env.KV_REST_API_URL),
    KV_REST_API_TOKEN: Boolean(process.env.KV_REST_API_TOKEN),
    KV_URL: Boolean(process.env.KV_URL),
    TELEGRAM_BOT_TOKEN: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    TELEGRAM_CHAT_ID: Boolean(process.env.TELEGRAM_CHAT_ID),
  };

  const url   = process.env.UPSTASH_REDIS_REST_URL   ?? process.env.KV_REST_API_URL   ?? '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? '';

  result.redis_url_configured = Boolean(url);
  result.redis_token_configured = Boolean(token);

  if (!url || !token) {
    result.diagnosis = 'Redis URL atau token kosong.';
    return NextResponse.json(result);
  }

  try {
    const redis = new Redis({ url, token });
    result.ping = await redis.ping();

    await redis.set('td:dbg', 'ok', { ex: 30 });
    const v = await redis.get('td:dbg');
    result.write_read_test = v === 'ok';

    const fc = await redis.zcard('teledrive:files');
    const nc = await redis.zcard('teledrive:notes');
    const lc = await redis.zcard('teledrive:log');
    result.redis_counts = { files: fc, notes: nc, logs: lc };
  } catch (e: any) {
    result.redis_error = e.message;
    result.diagnosis = 'Gagal konek ke Redis: ' + e.message;
  }

  return NextResponse.json(result, { status: 200 });
}
