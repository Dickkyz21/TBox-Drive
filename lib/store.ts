// lib/store.ts
// Index ringan di Redis (Upstash) — SUMBER KEBENARAN untuk render UI.
// File fisik tetap di Telegram; Redis hanya menyimpan pointer + metadata,
// jadi ukurannya kecil walau jumlah data banyak. Refresh halaman selalu
// membaca ulang dari sini (lewat Server Component / API route), bukan
// dari state React — itu sebabnya data tidak hilang saat di-refresh.

import { Redis } from '@upstash/redis';
import type { StoredFile, StoredNote } from './telegram';

const redis = Redis.fromEnv();

const FILES_KEY = 'teledrive:files';
const NOTES_KEY = 'teledrive:notes';
const LOG_KEY = 'teledrive:log';

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------- FILES ----------

export async function addToIndex(file: StoredFile): Promise<void> {
  const score = new Date(file.uploadedAt).getTime();
  await redis.zadd(FILES_KEY, { score, member: JSON.stringify(file) });
}

export async function listIndex(): Promise<StoredFile[]> {
  const raw = await redis.zrange<string[]>(FILES_KEY, 0, -1, { rev: true });
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
  await redis.zrem(FILES_KEY, JSON.stringify(target));
}

export async function findInIndex(
  messageId: number
): Promise<StoredFile | null> {
  const all = await listIndex();
  return all.find((f) => f.messageId === messageId) ?? null;
}

/**
 * Tambahkan banyak file sekaligus, melewati yang messageId-nya sudah ada
 * (aman dipanggil berulang oleh fitur Sync). Mengembalikan jumlah baru.
 */
export async function addManyFilesToIndex(
  files: StoredFile[]
): Promise<number> {
  if (files.length === 0) return 0;

  const existing = await listIndex();
  const existingIds = new Set(existing.map((f) => f.messageId));
  const newOnes = files.filter((f) => !existingIds.has(f.messageId));
  if (newOnes.length === 0) return 0;

  await Promise.all(
    newOnes.map((file) => {
      const score = new Date(file.uploadedAt).getTime();
      return redis.zadd(FILES_KEY, { score, member: JSON.stringify(file) });
    })
  );

  return newOnes.length;
}

// ---------- NOTES ----------

export async function listNotes(): Promise<StoredNote[]> {
  const raw = await redis.zrange<string[]>(NOTES_KEY, 0, -1, { rev: true });
  return raw
    .map((item) => {
      try {
        return JSON.parse(item) as StoredNote;
      } catch {
        return null;
      }
    })
    .filter((n): n is StoredNote => n !== null);
}

async function findNoteRaw(
  id: string
): Promise<{ note: StoredNote; raw: string } | null> {
  const raw = await redis.zrange<string[]>(NOTES_KEY, 0, -1);
  for (const item of raw) {
    try {
      const note = JSON.parse(item) as StoredNote;
      if (note.id === id) return { note, raw: item };
    } catch {
      continue;
    }
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

  // Sorted set tidak punya "update in place" — hapus member lama, lalu
  // tambah versi baru dengan score (createdAt) yang TETAP, supaya urutan
  // tampilan tidak berubah hanya karena note diedit.
  await redis.zrem(NOTES_KEY, found.raw);
  await redis.zadd(NOTES_KEY, {
    score: new Date(found.note.createdAt).getTime(),
    member: JSON.stringify(updated),
  });

  return updated;
}

export async function removeNoteFromIndex(
  id: string
): Promise<StoredNote | null> {
  const found = await findNoteRaw(id);
  if (!found) return null;
  await redis.zrem(NOTES_KEY, found.raw);
  return found.note;
}

export async function addManyNotesToIndex(
  notes: StoredNote[]
): Promise<number> {
  if (notes.length === 0) return 0;

  const existing = await listNotes();
  const existingIds = new Set(existing.map((n) => n.id));
  const newOnes = notes.filter((n) => !existingIds.has(n.id));
  if (newOnes.length === 0) return 0;

  await Promise.all(
    newOnes.map((note) => {
      const score = new Date(note.createdAt).getTime();
      return redis.zadd(NOTES_KEY, { score, member: JSON.stringify(note) });
    })
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
  label: string; // teks ringkas, misal nama file atau judul note
  detail?: string; // info tambahan opsional, misal ukuran file
  at: string; // ISO timestamp
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

  await redis.zadd(LOG_KEY, {
    score: Date.now(),
    member: JSON.stringify(entry),
  });

  // Batasi ukuran log supaya Redis tidak membengkak tanpa batas waktu —
  // simpan hanya LOG_MAX_ENTRIES entri terbaru.
  const count = await redis.zcard(LOG_KEY);
  if (count > LOG_MAX_ENTRIES) {
    await redis.zremrangebyrank(LOG_KEY, 0, count - LOG_MAX_ENTRIES - 1);
  }
}

export async function listLogs(limit = 100): Promise<LogEntry[]> {
  const raw = await redis.zrange<string[]>(LOG_KEY, 0, limit - 1, {
    rev: true,
  });
  return raw
    .map((item) => {
      try {
        return JSON.parse(item) as LogEntry;
      } catch {
        return null;
      }
    })
    .filter((l): l is LogEntry => l !== null);
}
