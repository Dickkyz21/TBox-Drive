// lib/store.ts
import { Redis } from '@upstash/redis';
import type { StoredFile, StoredNote } from './telegram';

// Support KV_REST_API_URL (Vercel KV lama) maupun UPSTASH_REDIS_REST_URL (Upstash baru)
const redisUrl =
  process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL ?? '';
const redisToken =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? '';

const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

export function isStoreConfigured(): boolean {
  return Boolean(redis);
}

function getRedis(): Redis {
  if (!redis) {
    throw new Error(
      'Redis belum dikonfigurasi. Atur UPSTASH_REDIS_REST_URL dan UPSTASH_REDIS_REST_TOKEN.'
    );
  }
  return redis;
}

const FILES_KEY = 'teledrive:files';
const NOTES_KEY = 'teledrive:notes';
const LOG_KEY   = 'teledrive:log';

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * @upstash/redis otomatis men-deserialize JSON saat membaca.
 * Jadi item dari zrange bisa berupa object ATAU string tergantung versi SDK.
 * Fungsi ini menangani keduanya dengan aman.
 */
function safeItem<T>(item: unknown): T | null {
  if (item === null || item === undefined) return null;
  // Sudah object (auto-parsed oleh @upstash/redis)
  if (typeof item === 'object') return item as T;
  // Masih string — parse manual
  if (typeof item === 'string') {
    try { return JSON.parse(item) as T; } catch { return null; }
  }
  return null;
}

// Baca sorted set, balik urutan di JS (terbaru di atas)
async function zrangeAll(key: string): Promise<unknown[]> {
  const raw = await getRedis().zrange(key, 0, -1);
  return [...(raw as unknown[])].reverse();
}

// ---------- FILES ----------

export async function addToIndex(file: StoredFile): Promise<void> {
  const score = new Date(file.uploadedAt).getTime();
  await getRedis().zadd(FILES_KEY, { score, member: JSON.stringify(file) });
}

export async function listIndex(): Promise<StoredFile[]> {
  const raw = await zrangeAll(FILES_KEY);
  return raw
    .map((item) => safeItem<StoredFile>(item))
    .filter((f): f is StoredFile => f !== null && typeof f.messageId === 'number');
}

export async function removeFromIndex(messageId: number): Promise<void> {
  const all = await listIndex();
  const target = all.find((f) => f.messageId === messageId);
  if (!target) return;
  await getRedis().zrem(FILES_KEY, JSON.stringify(target));
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
  const client = getRedis();
  await Promise.all(
    newOnes.map((file) =>
      client.zadd(FILES_KEY, {
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
    .map((item) => safeItem<StoredNote>(item))
    .filter((n): n is StoredNote => n !== null && typeof n.id === 'string');
}

async function findNoteRaw(
  id: string
): Promise<{ note: StoredNote; raw: string } | null> {
  const items = await getRedis().zrange(NOTES_KEY, 0, -1);
  for (const item of items as unknown[]) {
    const note = safeItem<StoredNote>(item);
    if (note && note.id === id) {
      return {
        note,
        raw: typeof item === 'string' ? item : JSON.stringify(note),
      };
    }
  }
  return null;
}

export async function addNoteToIndex(note: StoredNote): Promise<void> {
  const score = new Date(note.createdAt).getTime();
  await getRedis().zadd(NOTES_KEY, { score, member: JSON.stringify(note) });
}

export async function findNoteInIndex(id: string): Promise<StoredNote | null> {
  const found = await findNoteRaw(id);
  return found?.note ?? null;
}

export async function updateNoteInIndex(
  id: string,
  patch: Partial<Pick<StoredNote, 'title' | 'body' | 'updatedAt' | 'messageId'>>
): Promise<StoredNote | null> {
  const found = await findNoteRaw(id);
  if (!found) return null;
  const updated: StoredNote = { ...found.note, ...patch };
  const client = getRedis();
  await client.zrem(NOTES_KEY, found.raw);
  await client.zadd(NOTES_KEY, {
    score: new Date(found.note.createdAt).getTime(),
    member: JSON.stringify(updated),
  });
  return updated;
}

export async function removeNoteFromIndex(id: string): Promise<StoredNote | null> {
  const found = await findNoteRaw(id);
  if (!found) return null;
  await getRedis().zrem(NOTES_KEY, found.raw);
  return found.note;
}

export async function addManyNotesToIndex(notes: StoredNote[]): Promise<number> {
  if (notes.length === 0) return 0;
  const existing = await listNotes();
  const existingIds = new Set(existing.map((n) => n.id));
  const newOnes = notes.filter((n) => !existingIds.has(n.id));
  if (newOnes.length === 0) return 0;
  const client = getRedis();
  await Promise.all(
    newOnes.map((note) =>
      client.zadd(NOTES_KEY, {
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
  const entry: LogEntry = {
    id: newId(),
    action,
    label,
    detail,
    at: new Date().toISOString(),
  };
  const client = getRedis();
  await client.zadd(LOG_KEY, { score: Date.now(), member: JSON.stringify(entry) });
  const count = await client.zcard(LOG_KEY);
  if (count > LOG_MAX_ENTRIES) {
    await client.zremrangebyrank(LOG_KEY, 0, count - LOG_MAX_ENTRIES - 1);
  }
}

export async function listLogs(limit = 200): Promise<LogEntry[]> {
  const raw = (await getRedis().zrange(LOG_KEY, 0, -1)) as unknown[];
  return [...raw]
    .reverse()
    .slice(0, limit)
    .map((item) => safeItem<LogEntry>(item))
    .filter((l): l is LogEntry => l !== null && typeof l.id === 'string');
}

// ---------- DEVICES ----------

export type Device = {
  id: string;
  name: string;
  apiKey: string;
  folderPath: string;
  createdAt: string;
  lastSeen: string | null;
};

const DEVICES_KEY = 'teledrive:devices'; // Redis Hash: field=id, value=JSON

function randomApiKey(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'tdk_';
  for (let i = 0; i < 32; i++) {
    key += chars[Math.floor(Math.random() * chars.length)];
  }
  return key;
}

export async function listDevices(): Promise<Device[]> {
  const raw = await getRedis().hgetall(DEVICES_KEY);
  if (!raw) return [];
  return Object.values(raw)
    .map((v) => safeItem<Device>(v))
    .filter((d): d is Device => d !== null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function addDevice(name: string, folderPath: string): Promise<Device> {
  const device: Device = {
    id: newId(),
    name,
    apiKey: randomApiKey(),
    folderPath,
    createdAt: new Date().toISOString(),
    lastSeen: null,
  };
  await getRedis().hset(DEVICES_KEY, { [device.id]: JSON.stringify(device) });
  return device;
}

export async function removeDevice(id: string): Promise<void> {
  await getRedis().hdel(DEVICES_KEY, id);
}

export async function updateDeviceHeartbeat(id: string): Promise<boolean> {
  const raw = await getRedis().hget(DEVICES_KEY, id);
  if (!raw) return false;
  const device = safeItem<Device>(raw);
  if (!device) return false;
  device.lastSeen = new Date().toISOString();
  await getRedis().hset(DEVICES_KEY, { [id]: JSON.stringify(device) });
  return true;
}

export async function isValidDeviceKey(apiKey: string): Promise<boolean> {
  const devices = await listDevices();
  return devices.some((d) => d.apiKey === apiKey);
}

export function isDeviceOnline(device: Device): boolean {
  if (!device.lastSeen) return false;
  const diff = Date.now() - new Date(device.lastSeen).getTime();
  return diff < 2 * 60 * 1000; // online jika heartbeat < 2 menit lalu
}
