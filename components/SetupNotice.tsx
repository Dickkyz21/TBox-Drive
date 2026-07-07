import type { ReactNode } from 'react';

export function SetupNotice({
  title,
  message,
  detail,
}: {
  title: string;
  message: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="font-display font-semibold text-xl mb-2">{title}</h1>
        <p className="text-ink-500 text-sm">{message}</p>
        {detail && <p className="text-ink-500 text-xs mt-2">{detail}</p>}
      </div>
    </div>
  );
}
