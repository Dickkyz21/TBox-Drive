// lib/format.ts

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'Baru saja';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} menit lalu`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} jam lalu`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day} hari lalu`;
  return formatDate(iso);
}

export function extOf(name: string): string {
  const parts = name.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
const VIDEO_EXT = ['mp4', 'mkv', 'webm', 'mov', 'avi'];
const AUDIO_EXT = ['mp3', 'wav', 'ogg', 'flac', 'm4a'];
const ARCHIVE_EXT = ['zip', 'rar', '7z', 'tar', 'gz'];
const DOC_EXT = ['pdf', 'doc', 'docx', 'txt', 'md'];
const SHEET_EXT = ['xls', 'xlsx', 'csv'];

export type FileCategory =
  | 'image'
  | 'video'
  | 'audio'
  | 'archive'
  | 'document'
  | 'sheet'
  | 'other';

export function categoryOf(name: string): FileCategory {
  const ext = extOf(name);
  if (IMAGE_EXT.includes(ext)) return 'image';
  if (VIDEO_EXT.includes(ext)) return 'video';
  if (AUDIO_EXT.includes(ext)) return 'audio';
  if (ARCHIVE_EXT.includes(ext)) return 'archive';
  if (SHEET_EXT.includes(ext)) return 'sheet';
  if (DOC_EXT.includes(ext)) return 'document';
  return 'other';
}

export const CATEGORY_ACCENT: Record<FileCategory, string> = {
  image: '#34D399',
  video: '#F87171',
  audio: '#A78BFA',
  archive: '#F59E0B',
  document: '#2AABEE',
  sheet: '#10B981',
  other: '#8A93A1',
};
