// lib/telegram.ts
// Lapisan tipis di atas Telegram Bot API.
// Channel/grup Telegram dipakai sebagai "storage" permanen: setiap file
// dan setiap note dikirim sebagai 1 pesan. Metadata disisipkan di caption
// (untuk file) atau di teks pesan (untuk note) sebagai JSON satu baris,
// supaya bisa dipulihkan lewat fitur Sync kalau index Redis kosong/hilang.
//
// Redis (lib/store.ts) tetap menjadi SUMBER KEBENARAN untuk render UI
// sehari-hari — Telegram di sini berperan sebagai backup permanen +
// storage fisik untuk file, bukan dibaca langsung saat render normal.

import type { NoteColor } from './notes';
import { getEffectiveSettings } from './settings';

type TelegramConfig = {
  botToken: string;
  chatId: string;
};

const API_BASE = (botToken: string) => `https://api.telegram.org/bot${botToken}`;
const FILE_BASE = (botToken: string) => `https://api.telegram.org/file/bot${botToken}`;
const TELEGRAM_MESSAGE_LIMIT = 4096;

export type StoredFile = {
  messageId: number;
  name: string;
  size: number;
  mime: string;
  uploadedAt: string;
  fileId: string;
  folderId?: string | null;
};

type FileMeta = {
  n: string; // original name
  s: number; // size in bytes
  m: string; // mime type
  t: string; // ISO timestamp
  f?: string | null; // folder id
};

export type StoredNote = {
  messageId: number;
  id: string;
  title: string;
  body: string;
  color?: NoteColor;
  createdAt: string;
  updatedAt: string;
};

type NoteMeta = {
  id: string;
  ti: string; // title
  b: string; // body
  co?: NoteColor; // sticky note color
  c: string; // createdAt
  u: string; // updatedAt
};

async function assertConfigured(): Promise<TelegramConfig> {
  const settings = await getEffectiveSettings();
  if (!settings.telegram.botToken || !settings.telegram.chatId) {
    throw new Error(
      'Token bot Telegram atau Chat ID belum diatur.'
    );
  }
  return {
    botToken: settings.telegram.botToken,
    chatId: settings.telegram.chatId,
  };
}

export async function isConfigured(): Promise<boolean> {
  const settings = await getEffectiveSettings();
  return settings.telegram.configured;
}

async function readTelegramJson(res: Response, fallback: string): Promise<any> {
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(fallback);
  }

  if (!res.ok || !data?.ok) {
    throw new Error(data?.description || fallback);
  }

  return data;
}

// ---------- FILE ----------

function encodeFileCaption(meta: FileMeta): string {
  return `📄 ${meta.n}\nTDF|${JSON.stringify(meta)}`;
}

function decodeFileCaption(caption: string | undefined): FileMeta | null {
  if (!caption) return null;
  const marker = caption.indexOf('TDF|');
  if (marker === -1) return null;
  try {
    return JSON.parse(caption.slice(marker + 4));
  } catch {
    return null;
  }
}

/**
 * Upload satu file ke channel/grup Telegram sebagai dokumen.
 * sendDocument dipakai untuk semua tipe file supaya Telegram tidak
 * mengompresi gambar/video dan supaya bentuk respons API konsisten.
 */
export async function uploadFile(
  file: Blob,
  filename: string,
  mime: string,
  folderId?: string | null
): Promise<StoredFile> {
  const config = await assertConfigured();

  const meta: FileMeta = {
    n: filename,
    s: file.size,
    m: mime || 'application/octet-stream',
    t: new Date().toISOString(),
    f: folderId || null,
  };

  const form = new FormData();
  form.append('chat_id', config.chatId);
  form.append('caption', encodeFileCaption(meta));
  form.append('document', file, filename);

  const res = await fetch(`${API_BASE(config.botToken)}/sendDocument`, {
    method: 'POST',
    body: form,
  });

  const data = await readTelegramJson(res, 'Gagal mengunggah file ke Telegram');

  const doc = data.result.document;
  return {
    messageId: data.result.message_id,
    name: meta.n,
    size: meta.s,
    mime: meta.m,
    uploadedAt: meta.t,
    fileId: doc.file_id,
    folderId: meta.f,
  };
}

/**
 * Resolve file_id menjadi URL unduhan langsung dari server Telegram.
 * URL ini sementara (bisa berubah), jadi selalu di-resolve ulang saat
 * dibutuhkan, tidak disimpan permanen di index.
 */
export async function getDownloadUrl(fileId: string): Promise<string> {
  const config = await assertConfigured();

  const res = await fetch(`${API_BASE(config.botToken)}/getFile?file_id=${fileId}`);
  const data = await readTelegramJson(res, 'File tidak ditemukan di Telegram');
  return `${FILE_BASE(config.botToken)}/${data.result.file_path}`;
}

/**
 * Hapus pesan (file atau note) dari channel/grup.
 */
export async function deleteMessage(messageId: number): Promise<void> {
  const config = await assertConfigured();

  const res = await fetch(`${API_BASE(config.botToken)}/deleteMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: config.chatId, message_id: messageId }),
  });
  await readTelegramJson(res, 'Gagal menghapus pesan di Telegram');
}

// ---------- NOTE ----------

function encodeNoteText(meta: NoteMeta): string {
  const preview = meta.b.length > 200 ? `${meta.b.slice(0, 200)}...` : meta.b;
  return `Note: ${meta.ti}\n\n${preview}\n\nTDN|${JSON.stringify(meta)}`;
}

function decodeNoteText(text: string | undefined): NoteMeta | null {
  if (!text) return null;
  const marker = text.indexOf('TDN|');
  if (marker === -1) return null;
  try {
    return JSON.parse(text.slice(marker + 4));
  } catch {
    return null;
  }
}

/**
 * Kirim note baru sebagai pesan teks biasa ke channel/grup yang sama
 * dengan file (jadi semua backup ada di satu tempat).
 */
export async function sendNote(
  id: string,
  title: string,
  body: string,
  color: NoteColor
): Promise<{ messageId: number; createdAt: string }> {
  const config = await assertConfigured();

  const now = new Date().toISOString();
  const meta: NoteMeta = { id, ti: title, b: body, co: color, c: now, u: now };
  const text = encodeNoteText(meta);

  if (text.length > TELEGRAM_MESSAGE_LIMIT) {
    throw new Error('Catatan terlalu panjang untuk disimpan ke Telegram.');
  }

  const res = await fetch(`${API_BASE(config.botToken)}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: config.chatId,
      text,
    }),
  });

  const data = await readTelegramJson(res, 'Gagal mengirim note ke Telegram');

  return { messageId: data.result.message_id, createdAt: now };
}

/**
 * Edit isi pesan note yang sudah ada (dipanggil saat note di-update).
 * createdAt dipertahankan dari nilai yang dikirim, hanya updatedAt yang
 * berubah ke waktu sekarang.
 */
export async function editNote(
  messageId: number,
  id: string,
  title: string,
  body: string,
  color: NoteColor,
  createdAt: string
): Promise<{ updatedAt: string }> {
  const config = await assertConfigured();

  const updatedAt = new Date().toISOString();
  const meta: NoteMeta = { id, ti: title, b: body, co: color, c: createdAt, u: updatedAt };
  const text = encodeNoteText(meta);

  if (text.length > TELEGRAM_MESSAGE_LIMIT) {
    throw new Error('Catatan terlalu panjang untuk disimpan ke Telegram.');
  }

  const res = await fetch(`${API_BASE(config.botToken)}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: config.chatId,
      message_id: messageId,
      text,
    }),
  });

  await readTelegramJson(res, 'Gagal mengedit note di Telegram');

  return { updatedAt };
}

// ---------- SYNC (pulihkan dari Telegram) ----------

type PulledData = {
  files: StoredFile[];
  notes: StoredNote[];
};

/**
 * Tarik semua "update" yang belum pernah diambil bot dari Telegram
 * (getUpdates), saring file (caption TDF|) dan note (teks TDN|), lalu
 * kembalikan keduanya. Dipakai untuk memulihkan data yang sempat terkirim
 * ke Telegram tapi belum tercatat di index Redis.
 *
 * Bot API tidak punya cara resmi untuk membaca ULANG update yang sudah
 * pernah di-ack, jadi ini hanya bisa menjangkau update yang BELUM pernah
 * diambil sama sekali sejak bot dibuat. offset di-advance permanen di
 * sisi Telegram setelah dipanggil, jadi fungsi ini aman dipanggil
 * berulang — update yang sama tidak akan muncul dua kali.
 */
export async function pullPendingUpdates(): Promise<PulledData> {
  const config = await assertConfigured();

  const files: StoredFile[] = [];
  const notes: StoredNote[] = [];
  let offset: number | undefined;

  for (let page = 0; page < 50; page++) {
      const url = new URL(`${API_BASE(config.botToken)}/getUpdates`);
    url.searchParams.set('limit', '100');
    url.searchParams.set('timeout', '0');
    url.searchParams.set(
      'allowed_updates',
      JSON.stringify(['channel_post', 'message'])
    );
    if (offset !== undefined) url.searchParams.set('offset', String(offset));

    const res = await fetch(url.toString());
    const data = await readTelegramJson(res, 'Gagal mengambil update dari Telegram');

    const updates = data.result as any[];
    if (updates.length === 0) break;

    for (const update of updates) {
      const msg = update.channel_post || update.message;
      offset = update.update_id + 1;
      if (!msg) continue;
      if (String(msg.chat?.id) !== String(config.chatId)) continue;

      if (msg.document) {
        const meta = decodeFileCaption(msg.caption);
        if (meta) {
          files.push({
            messageId: msg.message_id,
            name: meta.n,
            size: meta.s,
            mime: meta.m,
            uploadedAt: meta.t,
            fileId: msg.document.file_id,
            folderId: meta.f,
          });
        } else {
          files.push({
            messageId: msg.message_id,
            name: msg.document.file_name || `telegram-file-${msg.message_id}`,
            size: Number(msg.document.file_size || 0),
            mime: msg.document.mime_type || 'application/octet-stream',
            uploadedAt: msg.date
              ? new Date(Number(msg.date) * 1000).toISOString()
              : new Date().toISOString(),
            fileId: msg.document.file_id,
            folderId: null,
          });
        }
      } else if (msg.text) {
        const meta = decodeNoteText(msg.text);
        if (meta) {
          notes.push({
            messageId: msg.message_id,
            id: meta.id,
            title: meta.ti,
            body: meta.b,
            color: meta.co,
            createdAt: meta.c,
            updatedAt: meta.u,
          });
        }
      }
    }

    if (updates.length < 100) break;
  }

  if (offset !== undefined) {
    await fetch(`${API_BASE(config.botToken)}/getUpdates?offset=${offset}&limit=1&timeout=0`);
  }

  return { files, notes };
}
