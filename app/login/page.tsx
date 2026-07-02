// app/login/page.tsx
'use client';

import { useState, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    setLoading(false);

    if (!res.ok) {
      setError('Password salah. Coba lagi.');
      return;
    }

    router.push(params.get('next') || '/');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-base-800/60 border border-base-700 rounded-2xl p-8 shadow-glow backdrop-blur"
      >
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-tg-500 to-tg-600 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 fill-white">
              <path d="M21.05 3.79a1.5 1.5 0 0 0-1.56-.27L2.8 10.36a1.4 1.4 0 0 0 .12 2.63l4.3 1.39 1.66 5.32c.16.5.6.84 1.13.84.32 0 .62-.12.85-.34l2.4-2.27 4.36 3.2c.25.18.55.28.85.28a1.4 1.4 0 0 0 1.38-1.13l3.07-14.6a1.5 1.5 0 0 0-.42-1.4z" />
            </svg>
          </div>
          <span className="font-display font-semibold text-lg">TeleDrive</span>
        </div>
        <p className="text-ink-500 text-sm mb-6">
          Masukkan password untuk mengakses Drive kamu.
        </p>

        <label className="block text-xs font-medium text-ink-500 mb-1.5">
          Password
        </label>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-base-900 border border-base-700 rounded-lg px-3.5 py-2.5 text-sm text-ink-100 placeholder:text-ink-500/60 focus:border-tg-500 transition-colors"
          placeholder="••••••••"
        />

        {error && <p className="text-danger-400 text-sm mt-2.5">{error}</p>}

        <button
          type="submit"
          disabled={loading || !password}
          className="w-full mt-5 bg-gradient-to-r from-tg-500 to-tg-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm rounded-lg py-2.5 transition-opacity hover:opacity-90"
        >
          {loading ? 'Memeriksa...' : 'Masuk'}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
