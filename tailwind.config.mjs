// Theme colors are CSS custom properties in src/styles/global.css (:root),
// stored as RGB channels so opacity modifiers (accent/40, ink/90) work.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: token('ink'),
          muted: token('ink-muted'),
        },
        accent: {
          DEFAULT: token('accent'),
          strong: token('accent-strong'),
          soft: token('accent-soft'),
        },
        // Only the light end of slate is themed. extend deep-merges, so
        // slate-500..950 keep Tailwind's defaults. A semantic rename
        // (bg-panel, border-line) is a planned follow-up.
        slate: {
          50: token('neutral-50'),
          100: token('neutral-100'),
          200: token('neutral-200'),
          300: token('neutral-300'),
          400: token('neutral-400'),
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
