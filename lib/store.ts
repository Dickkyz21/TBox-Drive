// lib/store.ts
import { Redis } from '@upstash/redis';
import type { StoredFile, StoredNote } from './telegram';

// Support KV_REST_API_URL (Vercel KV lama) maupun UPSTASH_REDIS_REST_URL (Upstash baru)
const redisUrl =
  process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL ?? '';
const redisToken =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? '';

const redis = new Redis({ url: redisUrl, token: redisToken });

const FILES_KEY = 'teledrive:files';
const NOTES_KEY = 'teledrive:notes';
const LOG_KEY = 'teledrive:log';

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Helper: Menangani auto-parsing dari Upstash agar tetap aman jika dikembalikan string atau object
function parseItem<T>(item: unknown): T | null {
  if (!item) return null;
  if (typeof item === 'object') return item as T;
  if (typeof item === 'string') {
    try {
      return JSON.parse(item) as T;
    } catch {
      return null;
    }
  }
  return null;
}

// Helper: baca sorted set dan balik urutan di JS (terbaru di atas).
async function zrangeAll<T>(key: string): Promise<T[]> {
  const raw = await redis.zrange<T[]>(key, 0, -1);
  return [...raw].reverse();
}

// ---------- FILES ----------

export async function addToIndex(file: StoredFile): Promise<void> {
  const score = new Date(file.uploadedAt).getTime();
  await redis.zadd(FILES_KEY, { score, member: JSON.stringify(file) });
}

export async function listIndex(): Promise<StoredFile[]> {
  const raw = await zrangeAll<unknown>(FILES_KEY);
  return raw
    .map((item) => parseItem<StoredFile>(item))
    .filter((f): f is StoredFile => f !== null);
}

export async function removeFromIndex(messageId: number): Promise<void> {
  const all = await listIndex();
  const target = all.find((f) => f.messageId === messageId);
  if (!target) return;
  await redis.zrem(FILES_KEY, JSON.stringify(target));
}

export async function findInIndex(messageId: number): Promise<StoredFile | null> {
  const all = await listIndex();
  return all.find((f) => f.messageId === messageId) ?? null;
}

export async function addManyFilesToIndex(files: StoredFile[]): Promise<number> {
  if (files.length === 0) return 0;
  const existing = await listIndex();
  const existingIds = new Set(existing.map((f) => f.messageId));
  const newOnes = files.filter((f) => !existingIds.has(f.messageId));
  if (newOnes.length === 0) return 0;
  await Promise.all(
    newOnes.map((file) =>
      redis.zadd(FILES_KEY, {
        score: new Date(file.uploadedAt).getTime(),
        member: JSON.stringify(file),
      })
    )
  );
  return newOnes.length;
}

// ---------- NOTES ----------

export async function listNotes(): Promise<StoredNote[]> {
  const raw = await zrangeAll<unknown>(NOTES_KEY);
  return raw
    .map((item) => parseItem<StoredNote>(item))
    .filter((n): n is StoredNote => n !== null);
}

async function findNote(id: string): Promise<StoredNote | null> {
  const raw = await redis.zrange<unknown[]>(NOTES_KEY, 0, -1);
  for (const item of raw) {
    const note = parseItem<StoredNote>(item);
    if (note && note.id === id) return note;
  }
  return null;
}

export async function addNoteToIndex(note: StoredNote): Promise<void> {
  const score = new Date(note.createdAt).getTime();
  await redis.zadd(NOTES_KEY, { score, member: JSON.stringify(note) });
}

export async function updateNoteInIndex(
  id: string,
  patch: Partial<Pick<StoredNote, 'title' | 'body' | 'updatedAt' | 'messageId'>>
): Promise<StoredNote | null> {
  const found = await findNote(id);
  if (!found) return null;
  const updated: StoredNote = { ...found, ...patch };
  
  // Hapus item lama (stringify data yang ditemukan) lalu masukan yang baru
  await redis.zrem(NOTES_KEY, JSON.stringify(found));
  await redis.zadd(NOTES_KEY, {
    score: new Date(found.createdAt).getTime(),
    member: JSON.stringify(updated),
  });
  return updated;
}

export async function removeNoteFromIndex(id: string): Promise<StoredNote | null> {
  const found = await findNote(id);
  if (!found) return null;
  await redis.zrem(NOTES_KEY, JSON.stringify(found));
  return found;
}

export async function addManyNotesToIndex(notes: StoredNote[]): Promise<number> {
  if (notes.length === 0) return 0;
  const existing = await listNotes();
  const existingIds = new Set(existing.map((n) => n.id));
  const newOnes = notes.filter((n) => !existingIds.has(n.id));
  if (newOnes.length === 0) return 0;
  await Promise.all(
    newOnes.map((note) =>
      redis.zadd(NOTES_KEY, {
        score: new Date(note.createdAt).getTime(),
        member: JSON.stringify(note),
      })
    )
  );
  return newOnes.length;
}

// ---------- ACTIVITY LOG ----------

export type LogAction =
  | 'upload'
  | 'delete_file'
  | 'create_note'
  | 'edit_note'
  | 'delete_note'
  | 'sync';

export type LogEntry = {
  id: string;
  action: LogAction;
  label: string;
  detail?: string;
  at: string;
};

const LOG_MAX_ENTRIES = 500;

export async function addLog(
  action: LogAction,
  label: string,
  detail?: string
): Promise<void> {
  const entry: LogEntry = { id: newId(), action, label, detail, at: new Date().toISOString() };
  await redis.zadd(LOG_KEY, { score: Date.now(), member: JSON.stringify(entry) });
  const count = await redis.zcard(LOG_KEY);
  if (count > LOG_MAX_ENTRIES) {
    await redis.zremrangebyrank(LOG_KEY, 0, count - LOG_MAX_ENTRIES - 1);
  }
}

export async function listLogs(limit = 200): Promise<LogEntry[]> {
  // Ambil semua, balik, ambil sejumlah limit
  const raw = await redis.zrange<unknown[]>(LOG_KEY, 0, -1);
  return [...raw]
    .reverse()
    .slice(0, limit)
    .map((item) => parseItem<LogEntry>(item))
    .filter((l): l is LogEntry => l !== null);
}
