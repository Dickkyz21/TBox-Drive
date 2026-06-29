// components/FileIcon.tsx
import type { FileCategory } from '@/lib/format';

export function FileIcon({
  category,
  className = 'w-5 h-5',
}: {
  category: FileCategory;
  className?: string;
}) {
  switch (category) {
    case 'image':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M21 15l-4.5-4.5a1.5 1.5 0 0 0-2.12 0L5 19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'video':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <rect x="2.5" y="5" width="13" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M19 9.5l3-2v9l-3-2" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      );
    case 'audio':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <path d="M9 18V6l11-2v12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="17" cy="16" r="3" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );
    case 'archive':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3 9h18M9.5 9v11" stroke="currentColor" strokeWidth="1.6" />
          <path d="M9.5 12h2.2M9.5 15h2.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'sheet':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <rect x="3.5" y="3" width="17" height="18" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3.5 9.5h17M9 9.5V21" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );
    case 'document':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <path d="M6 2.5h9l4.5 4.5V21a.5.5 0 0 1-.5.5H6a.5.5 0 0 1-.5-.5V3a.5.5 0 0 1 .5-.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M14.5 2.5V7a.5.5 0 0 0 .5.5h4.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M8 12.5h8M8 16h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <path d="M6 2.5h9l4.5 4.5V21a.5.5 0 0 1-.5.5H6a.5.5 0 0 1-.5-.5V3a.5.5 0 0 1 .5-.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M14.5 2.5V7a.5.5 0 0 0 .5.5h4.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      );
  }
}
