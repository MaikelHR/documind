/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Colors map to the per-theme CSS variables defined in src/index.css.
      // This lets utilities like `bg-surface text-text-dim border-border`
      // resolve correctly for every [data-direction][data-mode] palette.
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        'surface-3': 'var(--surface-3)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        text: 'var(--text)',
        'text-dim': 'var(--text-dim)',
        'text-mute': 'var(--text-mute)',
        accent: 'var(--accent)',
        'accent-2': 'var(--accent-2)',
        'on-accent': 'var(--on-accent)',
        'accent-soft': 'var(--accent-soft)',
        'accent-line': 'var(--accent-line)',
        hl: 'var(--hl)',
      },
      fontFamily: {
        display: ['Newsreader', 'Georgia', 'serif'],
        sans: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"Space Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        sm: '7px',
        md: '10px',
        lg: '14px',
        xl: '20px',
      },
      transitionTimingFunction: {
        ease: 'cubic-bezier(.22,.61,.36,1)',
      },
      // Max-width breakpoints mirroring the reference @media rules.
      screens: {
        'mx-940': { max: '940px' },
        'mx-600': { max: '600px' },
      },
    },
  },
  plugins: [],
};
