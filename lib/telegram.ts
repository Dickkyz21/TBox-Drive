// lib/telegram.ts
// Lapisan tipis di atas Telegram Bot API.
// Channel/grup Telegram dipakai sebagai "storage": setiap file = 1 pesan.
// Metadata juga disisipkan di caption (cadangan/manusia-terbaca), tapi
// sumber kebenaran untuk daftar file ada di lib/store.ts (Redis/Upstash),
// karena Bot API resmi tidak punya endpoint untuk "list semua pesan lama"
// di sebuah channel/grup.

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const API_BASE = () => `https://api.telegram.org/bot${BOT_TOKEN}`;
const FILE_BASE = () => `https://api.telegram.org/file/bot${BOT_TOKEN}`;

export type StoredFile = {
  messageId: number;
  name: string;
  size: number;
  mime: string;
  uploadedAt: string;
  fileId: string;
};

type Meta = {
  n: string; // original name
  s: number; // size in bytes
  m: string; // mime type
  t: string; // ISO timestamp
};

function assertConfigured() {
  if (!BOT_TOKEN || !CHAT_ID) {
    throw new Error(
      'TELEGRAM_BOT_TOKEN atau TELEGRAM_CHAT_ID belum diatur di environment variables.'
    );
  }
}

function encodeCaption(meta: Meta): string {
  return `📄 ${meta.n}\nTD|${JSON.stringify(meta)}`;
}

/**
 * Upload satu file ke channel/grup Telegram sebagai dokumen.
 * sendDocument dipakai untuk semua tipe file (gambar, video, dll) supaya
 * Telegram tidak mengompresi gambar/video dan supaya bentuk respons API
 * konsisten ("document"), apa pun ekstensi aslinya.
 */
export async function uploadFile(
  file: Blob,
  filename: string,
  mime: string
): Promise<StoredFile> {
  assertConfigured();

  const meta: Meta = {
    n: filename,
    s: file.size,
    m: mime || 'application/octet-stream',
    t: new Date().toISOString(),
  };

  const form = new FormData();
  form.append('chat_id', CHAT_ID as string);
  form.append('caption', encodeCaption(meta));
  form.append('document', file, filename);

  const res = await fetch(`${API_BASE()}/sendDocument`, {
    method: 'POST',
    body: form,
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.description || 'Gagal mengunggah file ke Telegram');
  }

  const doc = data.result.document;
  return {
    messageId: data.result.message_id,
    name: meta.n,
    size: meta.s,
    mime: meta.m,
    uploadedAt: meta.t,
    fileId: doc.file_id,
  };
}

/**
 * Resolve file_id menjadi URL unduhan langsung dari server Telegram.
 * URL ini sementara (bisa berubah), jadi selalu di-resolve ulang saat
 * dibutuhkan, tidak disimpan permanen di index.
 */
export async function getDownloadUrl(fileId: string): Promise<string> {
  assertConfigured();

  const res = await fetch(`${API_BASE()}/getFile?file_id=${fileId}`);
  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.description || 'File tidak ditemukan di Telegram');
  }
  return `${FILE_BASE()}/${data.result.file_path}`;
}

/**
 * Hapus pesan (file) dari channel/grup.
 */
export async function deleteMessage(messageId: number): Promise<void> {
  assertConfigured();

  const res = await fetch(`${API_BASE()}/deleteMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, message_id: messageId }),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.description || 'Gagal menghapus file di Telegram');
  }
}

export function isConfigured(): boolean {
  return Boolean(BOT_TOKEN && CHAT_ID);
}
