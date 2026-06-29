// lib/store.ts
// Index ringan untuk metadata file, disimpan di Upstash Redis
// (integrasi "Redis" dari Vercel Marketplace — ini pengganti resmi
// @vercel/kv, yang sudah deprecated sejak Desember 2024).
// File fisik tetap 100% di Telegram — Redis hanya menyimpan pointer +
// metadata, jadi ukurannya kecil walau jumlah file banyak.
//
// Struktur di Redis:
//   key "teledrive:files"  -> sorted set, member = JSON StoredFile, score = waktu upload (ms)
// Sorted set dipakai (bukan list biasa) supaya hapus 1 item tidak perlu
// baca-tulis ulang seluruh array, dan urutan terbaru-dulu otomatis terjaga.

import { Redis } from '@upstash/redis';
import type { StoredFile } from './telegram';

// Redis.fromEnv() otomatis membaca KV_REST_API_URL & KV_REST_API_TOKEN
// (nama variable ini yang di-inject Vercel saat integrasi Redis/Upstash
// dihubungkan ke project — tetap dipertahankan untuk kompatibilitas).
const redis = Redis.fromEnv();

const INDEX_KEY = 'teledrive:files';

export async function addToIndex(file: StoredFile): Promise<void> {
  const score = new Date(file.uploadedAt).getTime();
  await redis.zadd(INDEX_KEY, { score, member: JSON.stringify(file) });
}

export async function listIndex(): Promise<StoredFile[]> {
  // Urutan menurun: file terbaru muncul lebih dulu.
  const raw = await redis.zrange<string[]>(INDEX_KEY, 0, -1, { rev: true });
  return raw
    .map((item) => {
      try {
        return JSON.parse(item) as StoredFile;
      } catch {
        return null;
      }
    })
    .filter((f): f is StoredFile => f !== null);
}

export async function removeFromIndex(messageId: number): Promise<void> {
  const all = await listIndex();
  const target = all.find((f) => f.messageId === messageId);
  if (!target) return;
  await redis.zrem(INDEX_KEY, JSON.stringify(target));
}

export async function findInIndex(
  messageId: number
): Promise<StoredFile | null> {
  const all = await listIndex();
  return all.find((f) => f.messageId === messageId) ?? null;
}
