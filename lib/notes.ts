export const NOTE_COLORS = [
  {
    id: 'lemon',
    label: 'Lemon',
    card: 'bg-yellow-200 text-slate-950 border-yellow-100',
    muted: 'text-slate-700',
    line: 'border-yellow-300/70',
    pin: 'bg-yellow-400',
    swatch: 'bg-yellow-200',
  },
  {
    id: 'mint',
    label: 'Mint',
    card: 'bg-emerald-200 text-slate-950 border-emerald-100',
    muted: 'text-slate-700',
    line: 'border-emerald-300/70',
    pin: 'bg-emerald-400',
    swatch: 'bg-emerald-200',
  },
  {
    id: 'sky',
    label: 'Sky',
    card: 'bg-sky-200 text-slate-950 border-sky-100',
    muted: 'text-slate-700',
    line: 'border-sky-300/70',
    pin: 'bg-sky-400',
    swatch: 'bg-sky-200',
  },
  {
    id: 'rose',
    label: 'Rose',
    card: 'bg-rose-200 text-slate-950 border-rose-100',
    muted: 'text-slate-700',
    line: 'border-rose-300/70',
    pin: 'bg-rose-400',
    swatch: 'bg-rose-200',
  },
  {
    id: 'lavender',
    label: 'Lavender',
    card: 'bg-violet-200 text-slate-950 border-violet-100',
    muted: 'text-slate-700',
    line: 'border-violet-300/70',
    pin: 'bg-violet-400',
    swatch: 'bg-violet-200',
  },
  {
    id: 'peach',
    label: 'Peach',
    card: 'bg-orange-200 text-slate-950 border-orange-100',
    muted: 'text-slate-700',
    line: 'border-orange-300/70',
    pin: 'bg-orange-400',
    swatch: 'bg-orange-200',
  },
] as const;

export type NoteColor = (typeof NOTE_COLORS)[number]['id'];

export const DEFAULT_NOTE_COLOR: NoteColor = 'lemon';

export function getNoteColor(color: string | undefined) {
  return NOTE_COLORS.find((item) => item.id === color) ?? NOTE_COLORS[0];
}

export function normalizeNoteColor(color: unknown): NoteColor {
  if (typeof color !== 'string') return DEFAULT_NOTE_COLOR;
  return NOTE_COLORS.some((item) => item.id === color)
    ? (color as NoteColor)
    : DEFAULT_NOTE_COLOR;
}
