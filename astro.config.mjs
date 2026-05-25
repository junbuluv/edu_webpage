import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export default defineConfig({
  site: 'https://edu-webpage-fawn.vercel.app',
  output: 'server',
  adapter: vercel(),
  // Astro 5's built-in CSRF check (security.checkOrigin) compares the
  // request's Origin header to the URL Astro derives from request
  // headers. On Vercel, x-forwarded-host vs Host can produce a mismatch
  // that rejects legitimate same-origin POSTs with a 403. We rely on
  // SameSite=Lax cookies (the actual CSRF defense for the auth flow)
  // and disable Astro's secondary check. Re-enable here if/when the
  // Astro Vercel adapter resolves the header-source issue upstream.
  security: { checkOrigin: false },
  integrations: [
    react(),
    tailwind({ applyBaseStyles: false }),
    mdx({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex],
    }),
    sitemap(),
  ],
  vite: {
    ssr: {
      noExternal: ['react-plotly.js', 'plotly.js-finance-dist-min'],
    },
  },
});
