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

// Helper: baca sorted set dan balik urutan di JS (terbaru di atas).
// Menghindari { rev: true } di zrange yang berperilaku beda antar versi SDK.
async function zrangeAll(key: string): Promise<string[]> {
  const raw = await redis.zrange<string[]>(key, 0, -1);
  return [...raw].reverse();
}

// ---------- FILES ----------

export async function addToIndex(file: StoredFile): Promise<void> {
  const score = new Date(file.uploadedAt).getTime();
  await redis.zadd(FILES_KEY, { score, member: JSON.stringify(file) });
}

export async function listIndex(): Promise<StoredFile[]> {
  const raw = await zrangeAll(FILES_KEY);
  return raw
    .map((item) => { try { return JSON.parse(item) as StoredFile; } catch { return null; } })
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
  const raw = await zrangeAll(NOTES_KEY);
  return raw
    .map((item) => { try { return JSON.parse(item) as StoredNote; } catch { return null; } })
    .filter((n): n is StoredNote => n !== null);
}

async function findNoteRaw(id: string): Promise<{ note: StoredNote; raw: string } | null> {
  const raw = await redis.zrange<string[]>(NOTES_KEY, 0, -1);
  for (const item of raw) {
    try {
      const note = JSON.parse(item) as StoredNote;
      if (note.id === id) return { note, raw: item };
    } catch { continue; }
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
  const found = await findNoteRaw(id);
  if (!found) return null;
  const updated: StoredNote = { ...found.note, ...patch };
  await redis.zrem(NOTES_KEY, found.raw);
  await redis.zadd(NOTES_KEY, {
    score: new Date(found.note.createdAt).getTime(),
    member: JSON.stringify(updated),
  });
  return updated;
}

export async function removeNoteFromIndex(id: string): Promise<StoredNote | null> {
  const found = await findNoteRaw(id);
  if (!found) return null;
  await redis.zrem(NOTES_KEY, found.raw);
  return found.note;
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
  const raw = await redis.zrange<string[]>(LOG_KEY, 0, -1);
  return [...raw]
    .reverse()
    .slice(0, limit)
    .map((item) => { try { return JSON.parse(item) as LogEntry; } catch { return null; } })
    .filter((l): l is LogEntry => l !== null);
}
