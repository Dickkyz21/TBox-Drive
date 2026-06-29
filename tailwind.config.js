/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        base: {
          950: '#0A0D12',
          900: '#0E1117',
          800: '#151A23',
          700: '#1F2733',
          600: '#2B3544',
        },
        ink: {
          100: '#F3F5F7',
          300: '#C7CED6',
          500: '#8A93A1',
        },
        tg: {
          500: '#2AABEE',
          600: '#229ED9',
        },
        ok: {
          400: '#34D399',
        },
        warn: {
          400: '#F59E0B',
        },
        danger: {
          400: '#F87171',
        },
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(42,171,238,0.15), 0 8px 30px -8px rgba(42,171,238,0.25)',
      },
      keyframes: {
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
      },
      animation: {
        'pulse-dot': 'pulse-dot 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
