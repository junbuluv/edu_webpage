# Baruch Blue Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin baruchfinance.com in Baruch College's primary blues, with layout unchanged, through CSS-variable color tokens, self-hosted Figtree, and a colorblind-safe chart palette.

**Architecture:** Every theme color becomes a CSS custom property in `src/styles/global.css` (`:root`): RGB channels for colors used through Tailwind, hex for chart colors used in SVG attributes. `tailwind.config.mjs` points existing names (`ink`, `accent`, the light end of `slate`) and new ones (`heading`, `brand`) at those variables with `rgb(var(--x) / <alpha-value>)`, and chart components use `var(--chart-n)`. Each switch lands as a no-visual-change refactor, proven by pixel diffs, followed by a commit that changes values.

**Tech Stack:** Astro 5, Tailwind CSS 3.4, React 19 + Recharts 2.15, Fontsource variable fonts, Node's built-in test runner (`node --test` with TypeScript type stripping), Playwright MCP browser tools for visual checks, `uv` + Pillow for pixel diffs.

**Spec:** `docs/superpowers/specs/2026-09-27-baruch-blue-theme-design.md`

## Global Constraints

- Layout, spacing, radii, component structure, and copy do not change.
- Status colors keep their Tailwind classes: emerald (correct, success), amber (warnings), rose and red (errors, destructive actions), sky (workshop "open window" states).
- WCAG 2.2 AA: text at least 4.5:1; large text and chart marks at least 3:1; the ordinal light step `--chart-3-soft` at least 2:1.
- Official colors in the site chrome: Baruch Blue `#05336B`, CUNY Blue `#0033A1`, Sky `#A3C9FF`, plus neutrals (Baruch rule: at most three official colors per document).
- Fonts: `@fontsource-variable/figtree` ^5.3.0 and `@fontsource-variable/jetbrains-mono` ^5.3.0, self-hosted; no third-party font requests.
- FIN 3610 `accentColor` becomes Grape `#510C76` (spec §10 default). If the owner says to keep emerald, skip that one JSON change in Task 4.
- Pure logic lives in alias-free modules under `src/lib/` with a `*.test.ts` beside it; `node --test` does not resolve `@lib/*`.
- One logical change per commit; never skip pre-commit hooks; every commit message ends with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Run `npm run format` before every commit that touches `src/`.
- Build command (placeholder env, per CLAUDE.md): `PUBLIC_SUPABASE_URL=https://placeholder.supabase.co PUBLIC_SUPABASE_ANON_KEY=placeholder PUBLIC_SITE_URL=http://localhost:4321 npm run build`
- PR 1 lives on `feat/baruch-blue-theme` (already created; it holds the spec commit `9f839ca`). PR 2 lives on `feat/baruch-blue-charts`, branched from `main` after PR 1 merges.
- Merging, pushing to `main`, and production deploys happen only with the owner's explicit go-ahead.

## Review Focus

1. **Headings inside tinted or colored containers.** The base heading rule recolors every h1 to h3 without its own `text-*` class. Expected: each heading still reads at least 4.5:1 against its actual background. Tested by the heading-contrast audit in Task 4 (public pages) and Task 7 (signed-in pages, run by the owner).
2. **Keyboard focus on the Baruch Blue header and hero.** Expected: every header link, button, and hero CTA shows a visible Sky outline on Tab. Tested in Task 5.
3. **Phone width, 390px.** Figtree's wider metrics and the new table styles must not create page-level horizontal scroll. Expected: `scrollWidth <= innerWidth`. Tested in Task 5 (home) and Task 6 (lesson with a table).
4. **BarFigure `color` values in lesson content.** Expected: slot names and hex both work, and an unknown value (`'chart-5'`, `'blue'`, `''`, `'#12345'`) falls back to the series' default slot instead of rendering black or invisible. Tested by unit tests in Task 9.
5. **Header at the `xl` breakpoint (1280px) in Figtree.** Expected: the desktop nav stays on one line, and at 1279px the "Menu" button replaces it. Tested in Task 3 and Task 5 (signed out) and Task 7 (signed-in staff, who see more links; run by the owner).

## How this plan maps to the spec's commit list

- Task 1 (contrast helpers) is new and comes first so each later task can grow the guard test. The spec's single "contrast guard" commit is spread across Tasks 1, 2, 4, and 11.
- Spec commit 3 ("Baruch Blue palette") is split into Task 4 (tokens and type) and Task 5 (header and hero), since a reviewer could accept one and not the other.
- Spec commit 6 ("chart colors via CSS variables") is split into Task 8 (pure refactor, pixel-identical) and Task 9 (BarFigure and legacy chart colors, which do change pixels).
- The spec's optional font preload is not done (YAGNI): Fontsource ships `font-display: swap`.
- Guard tests are three files instead of one: `contrast.test.ts` (pure math), `theme-tokens.test.ts` (reads `global.css`), and `no-hardcoded-colors.test.ts` (scans components).

## File Map

| File                                              | Responsibility                                                                 | Tasks                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------- |
| `src/lib/theme/contrast.ts` (new)                 | Pure WCAG math and `:root` token parser                                        | 1                     |
| `src/lib/theme/contrast.test.ts` (new)            | Unit tests for the helpers                                                     | 1                     |
| `src/lib/theme/theme-tokens.test.ts` (new)        | Guard: tokens exist and pass AA; brand colors pinned                           | 2, 4, 11              |
| `src/lib/theme/no-hardcoded-colors.test.ts` (new) | Guard: no hex color literals in `src/components`                               | 8, 9                  |
| `src/lib/chart/series-color.ts` (new)             | Pure resolver for BarFigure series colors                                      | 9                     |
| `src/lib/chart/series-color.test.ts` (new)        | Unit tests for the resolver                                                    | 9                     |
| `src/styles/global.css`                           | All theme tokens, heading rule, prose and table styles, Recharts text override | 2, 3, 4, 6, 8, 10, 11 |
| `tailwind.config.mjs`                             | Maps Tailwind color and font names onto the tokens                             | 2, 3, 4               |
| `src/layouts/BaseLayout.astro`                    | Header colors and focus outlines                                               | 5                     |
| `src/pages/index.astro`                           | Home hero colors                                                               | 5                     |
| `src/components/hero/TypingVerb.tsx`              | Hero verb and cursor color                                                     | 5                     |
| `src/layouts/LessonLayout.astro`                  | Lesson title weight                                                            | 4                     |
| `src/components/lesson/LessonSidebar.tsx`         | Unit label color                                                               | 4                     |
| `public/favicon.svg`                              | Favicon tile color                                                             | 4                     |
| `src/content/courses/{eco-1002,fin-3610}.json`    | Course identity colors                                                         | 4                     |
| 25 files containing `hover:bg-blue-700`           | Accent hover token                                                             | 2                     |
| `src/components/viz/*.tsx` (22 files)             | Chart colors via `var(--chart-*)`                                              | 8, 9, 10              |
| `src/components/mdx/BarFigure.tsx`                | Slot-name colors, grid token                                                   | 9                     |
| 11 `src/content/lessons/fin-3610/*.mdx`           | BarFigure colors as slot names                                                 | 9                     |
| `CLAUDE.md`                                       | Document the token conventions                                                 | 7, 12                 |

## Shared verification tools

These are referenced by name in the tasks. Scratch files go in `.playwright-mcp/`, which is gitignored.

**Tool A: pixel diff.** Create `.playwright-mcp/pixel_diff.py` once (Task 2, Step 1):

```python
# Usage: uv run --with pillow python .playwright-mcp/pixel_diff.py BEFORE.png AFTER.png
# Exit 0 when the two screenshots are pixel-identical, 1 otherwise.
import sys

from PIL import Image, ImageChops

before, after = (Image.open(path).convert('RGB') for path in sys.argv[1:3])
if before.size != after.size:
    print(f'DIFFERENT SIZE {before.size} -> {after.size}')
    sys.exit(1)
box = ImageChops.difference(before, after).getbbox()
print('IDENTICAL' if box is None else f'DIFFERENT inside {box}')
sys.exit(0 if box is None else 1)
```

**Tool B: settle the page before a screenshot.** Run with `browser_evaluate`:

```js
async () => {
  const style = document.createElement('style');
  style.textContent =
    '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';
  document.head.appendChild(style);
  await document.fonts.ready;
  await new Promise((resolve) => setTimeout(resolve, 2000)); // Recharts mount animation
  return 'settled';
};
```

**Tool C: screenshot a page set.**

1. Start the dev server in the background: `npm run dev` (serves `http://localhost:4321`; the local `.env` is fine because every page below is viewed signed out).
2. Once per browser session: `browser_emulate_media` with `{ "reducedMotion": "reduce" }`. The hero's TypingVerb then renders a fixed word.
3. For each `(path, width)`: `browser_resize` `{ width, height: 900 }`, then `browser_navigate` to `http://localhost:4321<path>`, run Tool B, then `browser_take_screenshot` with `{ fullPage: true, scale: "css", filename: ".playwright-mcp/<set>/<name>-<width>.png" }`. Name each file after its path, with `/` replaced by `_`, and use `home` for `/`.

**Page sets**

- **CORE:** `/` at 1280 and 390; `/eco-1002` at 1280; `/lessons/eco-1002/is-lm-intro` at 1280 and 390; `/practice` at 1280; `/auth/signin` at 1280; `/lessons/fin-3610/capital-budgeting-cashflows` at 1280.
- **CHARTS** (1280 only): `/lessons/eco-1002/is-lm-intro`, `/lessons/eco-1002/ad-as`, `/lessons/eco-1002/solow`, `/lessons/eco-1002/fed-balance-sheet`, `/lessons/eco-1002/loanable-funds`, `/lessons/eco-1002/phillips-curve`, `/lessons/eco-1002/okun-phillips`, `/lessons/eco-1002/open-economy-fx`, `/lessons/fin-3610/bond-pricing-and-yield`, `/lessons/fin-3610/capital-budgeting-cashflows`, `/lessons/fin-3610/financial-statements-and-ratios`, `/lessons/fin-3610/annuities-and-perpetuities`, `/lessons/fin-3610/credit-risk-and-spreads`, `/lessons/fin-3610/mm-perfect-market`, `/lessons/fin-3610/debt-and-taxes`, `/lessons/fin-3610/investment-decision-rules`, `/lessons/fin-3610/optimal-portfolio-choice`, `/lessons/fin-3610/capm-and-sml`, `/lessons/fin-3610/valuing-stocks`.

**Tool D: heading-contrast audit.** Run with `browser_evaluate`; it lists every h1 to h3 below 4.5:1 against the nearest opaque background:

```js
() => {
  const channels = (css) => (css.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => {
    const lin = (c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  const background = (el) => {
    for (let node = el; node; node = node.parentElement) {
      const c = channels(getComputedStyle(node).backgroundColor);
      if (c.length === 3 || (c.length === 4 && c[3] > 0.5))
        return c.slice(0, 3);
    }
    return [255, 255, 255];
  };
  return [...document.querySelectorAll('h1, h2, h3')]
    .map((h) => {
      const [hi, lo] = [
        lum(channels(getComputedStyle(h).color)),
        lum(background(h)),
      ].sort((a, b) => b - a);
      return {
        heading: h.textContent.trim().slice(0, 50),
        ratio: +((hi + 0.05) / (lo + 0.05)).toFixed(2),
      };
    })
    .filter((row) => row.ratio < 4.5);
};
```

Expected: `[]`.

**Tool E: focused element's outline.** Press Tab with `browser_press_key` `{ "key": "Tab" }`, then run with `browser_evaluate`:

```js
() => {
  const el = document.activeElement;
  const s = getComputedStyle(el);
  return {
    element: el.textContent.trim().slice(0, 30),
    style: s.outlineStyle,
    width: s.outlineWidth,
    color: s.outlineColor,
  };
};
```

**Tool F: page-level horizontal overflow.** Run with `browser_evaluate`:

```js
() => ({
  scrollWidth: document.documentElement.scrollWidth,
  innerWidth: window.innerWidth,
});
```

Expected: `scrollWidth <= innerWidth`.

**Tool G: header fit.** Run with `browser_evaluate`:

```js
() => {
  const nav = document.querySelector('nav[aria-label="Primary navigation"]');
  const menu = document.querySelector('header details');
  return {
    navShown: getComputedStyle(nav).display !== 'none',
    navHeight: Math.round(nav.getBoundingClientRect().height),
    menuShown: getComputedStyle(menu).display !== 'none',
  };
};
```

At width 1280, expected `navShown: true`, `navHeight <= 40` (one row), `menuShown: false`. At width 1279, expected `navShown: false`, `menuShown: true`.

---

# PR 1: palette, fonts, header and hero (`feat/baruch-blue-theme`)

### Task 1: WCAG contrast helpers

**Files:**

- Create: `src/lib/theme/contrast.ts`
- Test: `src/lib/theme/contrast.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `type Rgb = [number, number, number]`; `toRgb(value: string): Rgb` (accepts `#rgb`, `#rrggbb`, or `'r g b'` channels; throws otherwise); `relativeLuminance(rgb: Rgb): number`; `contrastRatio(a: string, b: string): number`; `parseRootTokens(css: string): Record<string, string>` (custom-property name without `--` mapped to its trimmed value, from every `:root { }` block, comments ignored).

- [ ] **Step 1: Confirm the branch**

Run: `git switch feat/baruch-blue-theme && git log --oneline -2`
Expected: `docs: Baruch Blue theme implementation plan` on top of `9f839ca docs: Baruch Blue theme design spec`.

- [ ] **Step 2: Write the failing test**

Create `src/lib/theme/contrast.test.ts`:

```ts
// Run: node --test src/lib/theme/contrast.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrastRatio, parseRootTokens, toRgb } from './contrast.ts';

test('toRgb reads hex, short hex, and RGB channel triplets', () => {
  assert.deepEqual(toRgb('#05336B'), [5, 51, 107]);
  assert.deepEqual(toRgb('#eee'), [238, 238, 238]);
  assert.deepEqual(toRgb(' 5 51 107 '), [5, 51, 107]);
});

test('toRgb rejects values that are not colors', () => {
  assert.throws(() => toRgb('var(--ink)'));
  assert.throws(() => toRgb('300 0 0'));
  assert.throws(() => toRgb('#12345'));
});

test('contrastRatio matches WCAG reference values', () => {
  assert.equal(contrastRatio('#000000', '#FFFFFF').toFixed(2), '21.00');
  assert.equal(contrastRatio('#767676', '#FFFFFF').toFixed(2), '4.54');
  assert.equal(contrastRatio('#FFFFFF', '#FFFFFF'), 1);
});

test('contrastRatio is symmetric and accepts channel triplets', () => {
  assert.equal(
    contrastRatio('#0033A1', '#FFFFFF'),
    contrastRatio('255 255 255', '0 51 161'),
  );
});

test('parseRootTokens reads custom properties from :root blocks only', () => {
  const css = `
    .card { --not-root: 1 2 3; }
    :root {
      color-scheme: light;
      --ink: 56 56 56; /* Charcoal; a comment with --fake: 1; inside */
      --chart-1: #2869AF;
    }
    @layer base { :root { --heading: 5 51 107; } }
  `;
  assert.deepEqual(parseRootTokens(css), {
    ink: '56 56 56',
    'chart-1': '#2869AF',
    heading: '5 51 107',
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test src/lib/theme/contrast.test.ts`
Expected: FAIL with `Cannot find module` pointing at `contrast.ts`.

- [ ] **Step 4: Write the implementation**

Create `src/lib/theme/contrast.ts`:

```ts
// WCAG 2.x contrast math and a reader for the theme tokens declared in
// src/styles/global.css. Alias-free so `node --test` can import it.

export type Rgb = [number, number, number];

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const CHANNELS = /^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})$/;

/** Parses '#rgb', '#rrggbb', or an 'r g b' channel triplet (as stored in :root). */
export function toRgb(value: string): Rgb {
  const v = value.trim();
  const hex = HEX.exec(v);
  if (hex) {
    const full =
      hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as Rgb;
  }
  const channels = CHANNELS.exec(v);
  if (channels) {
    const rgb = channels.slice(1).map(Number) as Rgb;
    if (rgb.every((c) => c <= 255)) return rgb;
  }
  throw new Error(`Not a color token value: "${value}"`);
}

export function relativeLuminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [
    relativeLuminance(toRgb(a)),
    relativeLuminance(toRgb(b)),
  ].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Collects `--name: value;` declarations from every `:root { … }` block. */
export function parseRootTokens(css: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  const uncommented = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const block of uncommented.matchAll(/:root\s*\{([^}]*)\}/g)) {
    for (const decl of block[1].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
      tokens[decl[1]] = decl[2].trim();
    }
  }
  return tokens;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test src/lib/theme/contrast.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/lib/theme/contrast.ts src/lib/theme/contrast.test.ts
git commit -F - <<'EOF'
feat(theme): WCAG contrast helpers for theme tokens

Pure, alias-free toRgb/contrastRatio/parseRootTokens so node --test can
guard the color tokens that the following commits move into global.css.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: Route colors through CSS variables (no visual change)

**Files:**

- Test: `src/lib/theme/theme-tokens.test.ts` (new)
- Modify: `src/styles/global.css`
- Modify: `tailwind.config.mjs` (full rewrite below)
- Modify: the 25 files containing `hover:bg-blue-700`

**Interfaces:**

- Consumes: `contrastRatio`, `parseRootTokens` from Task 1.
- Produces: CSS variables `--ink`, `--ink-muted`, `--accent`, `--accent-strong`, `--accent-soft`, `--neutral-50` to `--neutral-400` (RGB channels); Tailwind colors `ink`, `ink-muted`, `accent`, `accent-strong`, `accent-soft`, and `slate-50` to `slate-400` backed by those variables; the `const token = (name) => …` helper in `tailwind.config.mjs`.

- [ ] **Step 1: Capture the baseline screenshots**

Create `.playwright-mcp/pixel_diff.py` with the Tool A contents. Then run Tool C for the CORE set into `.playwright-mcp/before-tokens/`. Do this before editing any file. Stop the dev server afterwards.

- [ ] **Step 2: Write the failing guard test**

Create `src/lib/theme/theme-tokens.test.ts`:

```ts
// Run: node --test src/lib/theme/theme-tokens.test.ts
//
// Guards the theme tokens in src/styles/global.css: every token the site
// relies on exists, and every text/background pairing passes WCAG AA.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contrastRatio, parseRootTokens } from './contrast.ts';

const css = readFileSync(
  new URL('../../styles/global.css', import.meta.url),
  'utf8',
);
const tokens = parseRootTokens(css);
const WHITE = '#FFFFFF';

/** A token name ('ink') resolves to its value; a '#rrggbb' literal passes through. */
function color(nameOrHex: string): string {
  if (nameOrHex.startsWith('#')) return nameOrHex;
  const value = tokens[nameOrHex];
  assert.ok(value, `--${nameOrHex} is missing from :root in global.css`);
  return value;
}

// [pairing, foreground, background, minimum ratio]
const TEXT_PAIRS: Array<[string, string, string, number]> = [
  ['body text on white', 'ink', WHITE, 4.5],
  ['muted text on white', 'ink-muted', WHITE, 4.5],
  ['links on white', 'accent', WHITE, 4.5],
  ['button label on accent', WHITE, 'accent', 4.5],
  ['button label on accent hover', WHITE, 'accent-strong', 4.5],
  ['muted text on slate-50', 'ink-muted', 'neutral-50', 4.5],
  ['muted text on slate-100', 'ink-muted', 'neutral-100', 4.5],
  ['muted text on slate-200', 'ink-muted', 'neutral-200', 4.5],
];

for (const [label, fg, bg, min] of TEXT_PAIRS) {
  test(`${label} is at least ${min}:1`, () => {
    const ratio = contrastRatio(color(fg), color(bg));
    assert.ok(
      ratio >= min,
      `${label}: ${ratio.toFixed(2)}:1 is below ${min}:1`,
    );
  });
}
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test src/lib/theme/theme-tokens.test.ts`
Expected: FAIL, 8 failures such as `--ink is missing from :root in global.css`.

- [ ] **Step 4: Add the tokens with today's values**

In `src/styles/global.css`, replace

```css
:root {
  color-scheme: light;
}
```

with

```css
:root {
  color-scheme: light;

  /* Theme tokens. Colors used through Tailwind are RGB channels so opacity
     modifiers keep working: rgb(var(--accent) / 0.4). */
  --ink: 15 23 42; /* #0F172A */
  --ink-muted: 71 85 105; /* #475569 */
  --accent: 37 99 235; /* #2563EB */
  --accent-strong: 29 78 216; /* #1D4ED8 */
  --accent-soft: 219 234 254; /* #DBEAFE */

  /* Light end of the slate scale; tailwind.config.mjs maps slate-50..400 here. */
  --neutral-50: 248 250 252; /* #F8FAFC */
  --neutral-100: 241 245 249; /* #F1F5F9 */
  --neutral-200: 226 232 240; /* #E2E8F0 */
  --neutral-300: 203 213 225; /* #CBD5E1 */
  --neutral-400: 148 163 184; /* #94A3B8 */
}
```

- [ ] **Step 5: Point Tailwind at the tokens and drop dead config**

Replace the whole of `tailwind.config.mjs` with the following. The `serif` family was never loaded and has zero uses; the `typography` block is inert because `@tailwindcss/typography` is not installed.

```js
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
```

- [ ] **Step 6: Replace the hardcoded accent hover**

```bash
grep -rl 'hover:bg-blue-700' src | xargs perl -pi -e 's/hover:bg-blue-700/hover:bg-accent-strong/g'
grep -rn 'blue-700' src
```

Expected: the second command prints nothing. `git diff --stat` lists 25 files besides `global.css` and `tailwind.config.mjs`.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `node --test src/lib/theme/*.test.ts`
Expected: PASS (5 helper tests and 8 pairing tests).

- [ ] **Step 8: Typecheck and build**

Run: `npm run typecheck`, then the build command from Global Constraints.
Expected: both succeed.

- [ ] **Step 9: Prove there is no visual change**

Run Tool C for the CORE set into `.playwright-mcp/after-tokens/`, then:

```bash
for f in .playwright-mcp/before-tokens/*.png; do
  printf '%s: ' "$(basename "$f")"
  uv run --with pillow python .playwright-mcp/pixel_diff.py "$f" ".playwright-mcp/after-tokens/$(basename "$f")"
done
```

Expected: `IDENTICAL` for every file. If any file differs, a class did not resolve to the same color. Open both images at the reported box to see which element changed, fix its token or mapping, and repeat this step. Do not commit a refactor that changes pixels.

- [ ] **Step 10: Commit**

```bash
npm run format
git add -A src tailwind.config.mjs
git status --short   # only intended files; .gitignore stays unstaged
git commit -F - <<'EOF'
refactor(theme): route colors through CSS variables

ink, accent (plus new accent-strong/-soft) and slate-50..400 now read
RGB-channel tokens in global.css, so the palette changes in one place.
Values equal today's Tailwind colors; CORE screenshots are
pixel-identical. hover:bg-blue-700 becomes hover:bg-accent-strong in 25
files; the unused serif family and inert typography block are removed.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 3: Self-host Figtree and JetBrains Mono

**Files:**

- Modify: `package.json`, `package-lock.json` (via npm)
- Modify: `src/styles/global.css` (imports)
- Modify: `tailwind.config.mjs` (`fontFamily`)

**Interfaces:**

- Consumes: `tailwind.config.mjs` from Task 2.
- Produces: font families `"Figtree Variable"` (`font-sans`) and `"JetBrains Mono Variable"` (`font-mono`).

- [ ] **Step 1: Record the failing check**

Run the build command, then `grep -l 'Figtree Variable' dist/client/_astro/*.css`.
Expected: no output, so no Figtree in the bundle yet.

- [ ] **Step 2: Install the packages**

Run: `npm install @fontsource-variable/figtree@^5.3.0 @fontsource-variable/jetbrains-mono@^5.3.0`
Expected: both added to `dependencies`.

- [ ] **Step 3: Import the fonts**

In `src/styles/global.css`, replace the first line

```css
@import 'katex/dist/katex.min.css';
```

with

```css
@import '@fontsource-variable/figtree';
@import '@fontsource-variable/jetbrains-mono';
@import 'katex/dist/katex.min.css';
```

- [ ] **Step 4: Point the font stacks at them**

In `tailwind.config.mjs`, replace the `fontFamily` block with:

```js
      fontFamily: {
        sans: [
          '"Figtree Variable"',
          '"Avenir Next"',
          'Avenir',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
        mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'monospace'],
      },
```

- [ ] **Step 5: Verify the bundle**

Run the build command, then:

```bash
grep -l 'Figtree Variable' dist/client/_astro/*.css
ls dist/client/_astro | grep -iE 'figtree.*\.woff2$'
```

Expected: at least one CSS file, and at least one `figtree-latin-…woff2` file.

- [ ] **Step 6: Verify the browser actually uses it**

With `npm run dev` running, `browser_navigate` to `http://localhost:4321/`, then run with `browser_evaluate`:

```js
async () => {
  await document.fonts.ready;
  return [...document.fonts].filter(
    (f) => f.family.includes('Figtree') && f.status === 'loaded',
  ).length;
};
```

Expected: at least `1`.

- [ ] **Step 7: Header still fits at `xl` (Review Focus 5)**

Run Tool G at width 1280 and again at 1279.
Expected: 1280 gives `navShown: true`, `navHeight <= 40`, `menuShown: false`; 1279 gives `navShown: false`, `menuShown: true`.

- [ ] **Step 8: Commit**

```bash
npm run format
git add package.json package-lock.json src/styles/global.css tailwind.config.mjs
git commit -F - <<'EOF'
feat(theme): self-host Figtree and JetBrains Mono

The declared Inter/JetBrains Mono were never loaded, so students saw
their system font. Fontsource bundles Figtree (Baruch's Avenir stand-in)
and JetBrains Mono with font-display: swap; no third-party request.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 4: Baruch Blue palette, headings, and lesson type

**Files:**

- Test: `src/lib/theme/theme-tokens.test.ts` (full replacement below)
- Modify: `src/styles/global.css` (full replacement below)
- Modify: `tailwind.config.mjs` (add `heading` and `brand` colors)
- Modify: `src/layouts/LessonLayout.astro` (lesson h1)
- Modify: `src/components/lesson/LessonSidebar.tsx` (unit labels)
- Modify: `public/favicon.svg`
- Modify: `src/content/courses/eco-1002.json`, `src/content/courses/fin-3610.json`

**Interfaces:**

- Consumes: tokens and `token()` helper from Task 2; fonts from Task 3.
- Produces: CSS variables `--heading`, `--brand`, `--brand-sky`, `--brand-sky-soft`, `--brand-mist`; Tailwind colors `heading`, `brand`, `brand-sky`, `brand-sky-soft`, `brand-mist`; the `hex(name)` helper in `theme-tokens.test.ts`.

- [ ] **Step 1: Write the failing test**

Replace the whole of `src/lib/theme/theme-tokens.test.ts` with:

```ts
// Run: node --test src/lib/theme/theme-tokens.test.ts
//
// Guards the theme tokens in src/styles/global.css: every token the site
// relies on exists, every text/background pairing passes WCAG AA, and the
// chrome keeps Baruch's official colors.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contrastRatio, parseRootTokens, toRgb } from './contrast.ts';

const css = readFileSync(
  new URL('../../styles/global.css', import.meta.url),
  'utf8',
);
const tokens = parseRootTokens(css);
const WHITE = '#FFFFFF';

/** A token name ('ink') resolves to its value; a '#rrggbb' literal passes through. */
function color(nameOrHex: string): string {
  if (nameOrHex.startsWith('#')) return nameOrHex;
  const value = tokens[nameOrHex];
  assert.ok(value, `--${nameOrHex} is missing from :root in global.css`);
  return value;
}

/** '5 51 107' or '#05336b' -> '#05336B' */
function hex(name: string): string {
  return (
    '#' +
    toRgb(color(name))
      .map((c) => c.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

// [pairing, foreground, background, minimum ratio]
const TEXT_PAIRS: Array<[string, string, string, number]> = [
  ['body text on white', 'ink', WHITE, 4.5],
  ['muted text on white', 'ink-muted', WHITE, 4.5],
  ['headings on white', 'heading', WHITE, 4.5],
  ['links on white', 'accent', WHITE, 4.5],
  ['button label on accent', WHITE, 'accent', 4.5],
  ['button label on accent hover', WHITE, 'accent-strong', 4.5],
  ['body text on slate-50 panels', 'ink', 'neutral-50', 4.5],
  ['muted text on slate-50', 'ink-muted', 'neutral-50', 4.5],
  ['muted text on slate-100', 'ink-muted', 'neutral-100', 4.5],
  ['muted text on slate-200', 'ink-muted', 'neutral-200', 4.5],
  ['header text on brand', WHITE, 'brand', 4.5],
  ['header nav on brand', 'brand-sky-soft', 'brand', 4.5],
  ['hero subtitle on brand', 'brand-mist', 'brand', 4.5],
  ['sign-in label on sky', 'brand', 'brand-sky', 4.5],
  ['hero verb and focus outline on brand', 'brand-sky', 'brand', 3],
];

for (const [label, fg, bg, min] of TEXT_PAIRS) {
  test(`${label} is at least ${min}:1`, () => {
    const ratio = contrastRatio(color(fg), color(bg));
    assert.ok(
      ratio >= min,
      `${label}: ${ratio.toFixed(2)}:1 is below ${min}:1`,
    );
  });
}

test('chrome uses Baruch official colors', () => {
  assert.equal(hex('brand'), '#05336B'); // Baruch Blue, PMS 288C
  assert.equal(hex('heading'), '#05336B');
  assert.equal(hex('accent'), '#0033A1'); // CUNY Blue, PMS 286C
  assert.equal(hex('brand-sky'), '#A3C9FF'); // Sky, PMS 658C
  assert.equal(hex('neutral-50'), '#F7F4EB'); // Pearl, PMS 9060C
  assert.equal(hex('neutral-300'), '#D8D7D6'); // Dove, Cool Gray 1C
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test src/lib/theme/theme-tokens.test.ts`
Expected: FAIL. `--heading` and the `--brand*` tokens are missing, and the official-colors test reports `'#2563EB' !== '#0033A1'` and similar.

- [ ] **Step 3: Write the Baruch tokens, heading rule, and lesson type**

Replace the whole of `src/styles/global.css` with:

```css
@import '@fontsource-variable/figtree';
@import '@fontsource-variable/jetbrains-mono';
@import 'katex/dist/katex.min.css';

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: light;

  /* Theme tokens (Baruch Blue). Colors used through Tailwind are RGB channels
     so opacity modifiers keep working: rgb(var(--accent) / 0.4). */
  --ink: 56 56 56; /* #383838 Charcoal */
  --ink-muted: 86 101 122; /* #56657A, Baruch Slate darkened for AA */
  --heading: 5 51 107; /* #05336B Baruch Blue */
  --accent: 0 51 161; /* #0033A1 CUNY Blue */
  --accent-strong: 5 51 107; /* #05336B Baruch Blue */
  --accent-soft: 232 240 252; /* #E8F0FC */
  --brand: 5 51 107; /* #05336B Baruch Blue: header, home hero */
  --brand-sky: 163 201 255; /* #A3C9FF Sky */
  --brand-sky-soft: 201 220 247; /* #C9DCF7 header navigation */
  --brand-mist: 211 226 246; /* #D3E2F6 hero subtitle */

  /* Light end of the slate scale, remapped to Baruch neutrals at the same
     lightness; tailwind.config.mjs maps slate-50..400 here. */
  --neutral-50: 247 244 235; /* #F7F4EB Pearl */
  --neutral-100: 239 236 229; /* #EFECE5 */
  --neutral-200: 230 228 223; /* #E6E4DF */
  --neutral-300: 216 215 214; /* #D8D7D6 Dove */
  --neutral-400: 161 158 152; /* #A19E98 */
}

@layer base {
  /* Utilities outrank the base layer, so any heading with its own text-*
     class keeps it. */
  h1,
  h2,
  h3 {
    color: rgb(var(--heading));
  }
}

html {
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

body {
  @apply bg-white text-ink;
}

.prose {
  @apply max-w-prose text-[1.0625rem];
}

.prose h1 {
  @apply text-3xl font-bold tracking-tight mt-0 mb-6;
}
.prose h2 {
  @apply text-2xl font-bold tracking-tight mt-10 mb-4;
}
.prose h3 {
  @apply text-xl font-semibold mt-8 mb-3;
}
.prose p {
  @apply leading-[1.7] my-4 text-ink/90;
}
.prose ul {
  @apply list-disc pl-6 my-4;
}
.prose ol {
  @apply list-decimal pl-6 my-4;
}
.prose code {
  @apply rounded bg-slate-100 px-1.5 py-0.5 text-[0.9em] font-mono;
}
.prose pre {
  @apply rounded-lg bg-slate-900 text-slate-100 p-4 overflow-x-auto;
}
.prose blockquote {
  @apply border-l-4 border-brand-sky pl-4 italic text-ink-muted;
}

.katex-display {
  @apply my-6 overflow-x-auto;
}
```

- [ ] **Step 4: Add the `heading` and `brand` colors to Tailwind**

In `tailwind.config.mjs`, inside `theme.extend.colors`, insert after the `ink` block:

```js
        heading: token('heading'),
```

and insert after the `accent` block:

```js
        brand: {
          DEFAULT: token('brand'),
          sky: token('brand-sky'),
          'sky-soft': token('brand-sky-soft'),
          mist: token('brand-mist'),
        },
```

- [ ] **Step 5: Lesson title weight and sidebar unit labels**

In `src/layouts/LessonLayout.astro`, change

<!-- prettier-ignore -->
```astro
      <h1 class="text-3xl font-semibold tracking-tight mt-2">{data.title}</h1>
```

to

<!-- prettier-ignore -->
```astro
      <h1 class="text-3xl font-extrabold tracking-tight mt-2">{data.title}</h1>
```

In `src/components/lesson/LessonSidebar.tsx`, change the unit heading's class

```tsx
          <h3 className="px-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
```

to

```tsx
          <h3 className="px-3 text-xs font-semibold uppercase tracking-wide text-accent">
```

- [ ] **Step 6: Favicon and course colors**

```bash
perl -pi -e 's/fill="#2563eb"/fill="#05336B"/' public/favicon.svg
perl -pi -e 's/"accentColor": "#1d4ed8"/"accentColor": "#0033A1"/' src/content/courses/eco-1002.json
perl -pi -e 's/"accentColor": "#047857"/"accentColor": "#510C76"/' src/content/courses/fin-3610.json
grep -n 'fill=' public/favicon.svg | head -1
grep -n accentColor src/content/courses/*.json
```

Expected: the favicon's `<rect>` fill is `#05336B`; the accent colors are `#0033A1` (ECO 1002) and `#510C76` (FIN 3610). If the owner chose to keep emerald for FIN 3610, run only the favicon and ECO lines.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `node --test src/lib/theme/*.test.ts`
Expected: PASS (5 helper tests, 15 pairing tests, and the official-colors test).

- [ ] **Step 8: Typecheck and build**

Run: `npm run typecheck`, then the build command.
Expected: both succeed.

- [ ] **Step 9: Heading audit on public pages (Review Focus 1)**

With `npm run dev` running, run Tool D on `/`, `/eco-1002`, `/fin-3610`, `/eco-1002/workshops`, `/practice`, `/lessons/eco-1002/is-lm-intro`, `/auth/signin`, and `/auth/signup`.
Expected: `[]` on every page. For any heading listed, add an explicit text class that fits its container (for example `text-amber-900` inside an amber panel) and re-run.

- [ ] **Step 10: Review screenshots**

Run Tool C for the CORE set into `.playwright-mcp/after-palette/` and look at each image. Check for: Baruch Blue headings, warm Pearl panels and Dove borders, Figtree body text at 17px in lessons, a Sky blockquote rule, CUNY Blue unit labels in the lesson sidebar, and the course header card in Grape on `/fin-3610`. The header is still white at this point; Task 5 turns it blue.

Then open `/practice/eco-1002-is-lm-intro`, answer one question correctly and one incorrectly, submit, and screenshot the graded state. Expected: the quiz title is Baruch Blue, the feedback panels keep their emerald and rose colors, and the Submit button is CUNY Blue with a Baruch Blue hover.

- [ ] **Step 11: Commit**

```bash
npm run format
git add src/lib/theme/theme-tokens.test.ts src/styles/global.css tailwind.config.mjs src/layouts/LessonLayout.astro src/components/lesson/LessonSidebar.tsx public/favicon.svg src/content/courses/eco-1002.json src/content/courses/fin-3610.json
git commit -F - <<'EOF'
feat(theme): Baruch Blue palette, headings, and lesson type

Token values move to Baruch's palette: Charcoal text, Baruch Blue
headings (one base rule), CUNY Blue accent, Pearl/Dove neutrals at
today's lightness. Lesson prose goes to 17px/1.7 with bolder titles;
course colors become CUNY Blue (ECO 1002) and Grape (FIN 3610); the
favicon turns Baruch Blue. theme-tokens.test.ts pins the official
colors and every AA pairing.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 5: Baruch Blue header and home hero

**Files:**

- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/pages/index.astro`
- Modify: `src/components/hero/TypingVerb.tsx`

**Interfaces:**

- Consumes: Tailwind colors `brand`, `brand-sky`, `brand-sky-soft`, `brand-mist` from Task 4.
- Produces: frontmatter constants `onBlueFocus` and `navLink` in `BaseLayout.astro`.

- [ ] **Step 1: Record the failing checks**

With `npm run dev` running, width 1280, on `/`: press Tab once and run Tool E.
Expected today: the focused element is the site-name link and `color` is not `rgb(163, 201, 255)`. This is the behavior the task changes.

- [ ] **Step 2: Add the focus-outline constants to the header**

In `src/layouts/BaseLayout.astro`, after the line `const viewerIsAdmin = isAdmin(profile?.role);`, add:

```ts
// Header controls sit on Baruch Blue, where the browser's default focus
// ring disappears, so they get a Sky outline.
const onBlueFocus =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sky';
const navLink = `text-brand-sky-soft hover:text-white ${onBlueFocus}`;
```

- [ ] **Step 3: Recolor the header**

In `src/layouts/BaseLayout.astro`, make these replacements:

1. `<header class="border-b border-slate-200 bg-white">` becomes `<header class="border-b border-brand-sky/25 bg-brand">`.
2. `<a href="/" class="font-semibold text-lg tracking-tight">` becomes ``<a href="/" class={`font-semibold text-lg tracking-tight text-white ${onBlueFocus}`}>``.
3. All 7 occurrences of `class="text-ink-muted hover:text-ink"`, in the desktop nav only (ECO 1002, FIN 3610, Practice, Dashboard, Manage, Admin, and the Sign out button), become `class={navLink}`. The footer's `class="hover:text-ink"` links are different strings and stay unchanged.
4. The desktop Sign in link's `class="rounded bg-accent px-3 py-1.5 text-white text-sm"` becomes ``class={`rounded bg-brand-sky px-3 py-1.5 text-sm font-medium text-brand hover:bg-white ${onBlueFocus}`}``.
5. The mobile `<summary>`'s class becomes ``class={`cursor-pointer list-none rounded border border-brand-sky/40 px-3 py-1.5 text-sm font-medium text-white [&::-webkit-details-marker]:hidden ${onBlueFocus}`}``.

Leave the mobile dropdown `<nav>` (white panel) and its links, including its `bg-accent` Sign in, unchanged. Leave the `CourseSwitcher` unchanged.

Check: `grep -c 'text-ink-muted hover:text-ink' src/layouts/BaseLayout.astro` prints `0`.

- [ ] **Step 4: Recolor the home hero**

In `src/pages/index.astro`:

1. The hero `<section>`'s class `border-b border-slate-200 bg-gradient-to-b from-white to-slate-50` becomes `bg-brand`.
2. `<h1 class="text-4xl font-semibold tracking-tight md:text-5xl">` becomes `<h1 class="text-4xl font-extrabold tracking-tight text-white md:text-5xl">`.
3. `<p class="mx-auto mt-5 max-w-2xl text-lg text-ink-muted">` becomes `<p class="mx-auto mt-5 max-w-2xl text-lg text-brand-mist">`.
4. The ECO 1002 CTA `<a href="/eco-1002">` class becomes:
   `rounded-lg bg-white px-5 py-3 text-left text-brand shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sky sm:min-w-[18rem]`
5. The FIN 3610 CTA `<a href="/fin-3610">` class becomes:
   `rounded-lg border border-brand-sky px-5 py-3 text-left text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sky sm:min-w-[18rem]`
   Its label `<span class="block text-xs uppercase tracking-wide text-ink-muted">` becomes `<span class="block text-xs uppercase tracking-wide text-brand-sky-soft">`.

The "Courses" section below the hero stays unchanged.

- [ ] **Step 5: Recolor the typing verb**

In `src/components/hero/TypingVerb.tsx`:

- `className="inline-block text-accent"` becomes `className="inline-block text-brand-sky"`.
- The cursor's `className="ml-0.5 inline-block w-[2px] -translate-y-[2px] animate-pulse bg-accent align-middle"` becomes `className="ml-0.5 inline-block w-[2px] -translate-y-[2px] animate-pulse bg-brand-sky align-middle"`.

TypingVerb is used only by `src/pages/index.astro`; confirm with `grep -rl TypingVerb src`.

- [ ] **Step 6: Typecheck, test, build**

Run: `npm run typecheck`, `node --test src/lib/theme/*.test.ts`, then the build command.
Expected: all succeed.

- [ ] **Step 7: Focus is visible on blue (Review Focus 2)**

On `/` at width 1280, reload, then press Tab repeatedly, running Tool E after each press, until focus leaves the hero's second CTA. That covers the site name, ECO 1002, FIN 3610, Practice, Sign in, and both CTAs.
Expected for each: `style: "solid"`, `width: "2px"`, `color: "rgb(163, 201, 255)"`.

- [ ] **Step 8: Header fit and phone width (Review Focus 3 and 5)**

Run Tool G at 1280 and 1279 on `/`. Expected: as in Tool G.
Run Tool F at width 390 on `/` and on `/lessons/eco-1002/is-lm-intro`. Expected: `scrollWidth <= innerWidth`.
At width 390, open the "Menu" (`browser_click` on the summary) and confirm by screenshot that the white dropdown shows dark links.

- [ ] **Step 9: Review screenshots and heading audit**

Run Tool C for `/` at 1280 and 390 into `.playwright-mcp/after-header/`. Check for: a Baruch Blue header and hero, a white headline with the Sky verb, a Sky Sign in button with a Baruch Blue label, and a white ECO CTA beside an outlined FIN CTA. Run Tool D on `/`; expected `[]`.

- [ ] **Step 10: Commit**

```bash
npm run format
git add src/layouts/BaseLayout.astro src/pages/index.astro src/components/hero/TypingVerb.tsx
git commit -F - <<'EOF'
feat(theme): Baruch Blue header and home hero

Header and hero move onto Baruch Blue with white and Sky text; the Sign
in button and hero verb use Sky, the CTAs invert. Header and hero
controls get a Sky focus-visible outline, since the default ring is
invisible on blue. The white mobile dropdown and CourseSwitcher are
unchanged.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 6: Lesson tables and native controls

**Files:**

- Modify: `src/styles/global.css`

**Interfaces:**

- Consumes: Tailwind colors `heading` and `slate-50`/`200`/`300` from Tasks 2 and 4; the `--accent` token.
- Produces: `.prose table|th|td` styles; `accent-color` on `:root`.

- [ ] **Step 1: Record the failing check**

On `/lessons/eco-1002/is-lm-intro` at width 1280, run with `browser_evaluate`:

```js
() => {
  const th = document.querySelector('.prose th');
  const s = getComputedStyle(th);
  return {
    paddingLeft: s.paddingLeft,
    borderBottom: s.borderBottomWidth,
    accentColor: getComputedStyle(document.documentElement).accentColor,
  };
};
```

Expected today: `paddingLeft` `"1px"`, `borderBottom` `"0px"`, `accentColor` `"auto"`.

- [ ] **Step 2: Theme native controls**

In `src/styles/global.css`, inside the `:root` block, directly after `color-scheme: light;`, add:

<!-- prettier-ignore -->
```css
  accent-color: rgb(var(--accent)); /* sliders, checkboxes, radios */
```

- [ ] **Step 3: Style Markdown tables**

In `src/styles/global.css`, directly after the `.prose blockquote { … }` rule, add:

```css
/* Markdown tables (13 lessons). display:block lets a wide table scroll
   inside the text column on phones instead of widening the page. */
.prose table {
  @apply my-6 block max-w-full overflow-x-auto border-collapse text-[0.9375rem];
}
.prose th {
  @apply border-b border-slate-300 bg-slate-50 px-3.5 py-2 text-left font-semibold text-heading;
}
.prose td {
  @apply border-b border-slate-200 px-3.5 py-2 align-top;
}
```

- [ ] **Step 4: Verify**

Run `npm run typecheck`, `node --test src/lib/theme/*.test.ts`, and the build command. All succeed.
Re-run the Step 1 snippet. Expected: `paddingLeft` `"14px"`, `borderBottom` `"1px"`, `accentColor` `"rgb(0, 51, 161)"`.

- [ ] **Step 5: Phone width (Review Focus 3)**

At width 390, run Tool F on `/lessons/eco-1002/is-lm-intro` and `/lessons/fin-3610/capital-budgeting-cashflows`.
Expected: `scrollWidth <= innerWidth` on both. Take a screenshot of the IS-LM table at 390 and confirm it scrolls inside its column.

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/styles/global.css
git commit -F - <<'EOF'
fix(lessons): style Markdown tables and theme native controls

13 of 39 lessons have Markdown tables that rendered with no padding or
rules (the typography plugin was never installed). Tables get cell
padding, a Pearl header row and Dove rules, and scroll inside the
column on phones. accent-color themes every slider and checkbox.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 7: Document, verify, and open PR 1

**Files:**

- Modify: `CLAUDE.md`

**Interfaces:**

- Consumes: everything from Tasks 1 to 6.
- Produces: an open PR for `feat/baruch-blue-theme` with a Vercel preview.

- [ ] **Step 1: Document the tokens in CLAUDE.md**

In `CLAUDE.md`, under "Where things live", add this bullet after the "Operational email" bullet:

```markdown
- Theme tokens (Baruch Blue): colors are CSS custom properties in
  `src/styles/global.css` `:root`, stored as RGB channels. `tailwind.config.mjs`
  maps `ink`, `ink-muted`, `heading`, `accent` (`-strong`, `-soft`), `brand`
  (`-sky`, `-sky-soft`, `-mist`) and `slate-50`…`slate-400` onto them, so
  `slate-50`…`400` render Baruch's warm Pearl/Dove neutrals by design.
  `src/lib/theme/theme-tokens.test.ts` fails if a token edit breaks WCAG AA or
  drifts from Baruch's official colors. Fonts are self-hosted Figtree and
  JetBrains Mono (Fontsource). Design: `docs/superpowers/specs/2026-09-27-baruch-blue-theme-design.md`
```

Under "Conventions", add after convention 20:

```markdown
21. **Colors come from theme tokens.** Use `text-ink`, `text-heading`,
    `bg-accent`, `hover:bg-accent-strong`, `bg-brand` and friends; never raw
    `blue-*` classes for brand color. Status colors (emerald, amber, rose,
    red, sky) stay Tailwind classes. h1–h3 are Baruch Blue through one base
    rule; give a heading an explicit `text-*` class when it sits on a tinted
    status panel.
```

In "Verifying before declaring done", step 3, add `theme/contrast.ts` to the list of alias-free modules.

- [ ] **Step 2: Full local verification**

```bash
npm run format
git diff --stat            # formatting should not touch anything new
npm run typecheck
node --test 'src/lib/**/*.test.ts'
PUBLIC_SUPABASE_URL=https://placeholder.supabase.co PUBLIC_SUPABASE_ANON_KEY=placeholder PUBLIC_SITE_URL=http://localhost:4321 npm run build
npm run check:copyright
```

Expected: typecheck and build succeed, every test passes, and the copyright gate shows no new findings. Write down the total test count for Task 12.

- [ ] **Step 3: Commit the docs**

```bash
git add CLAUDE.md
git commit -F - <<'EOF'
docs: record the theme token conventions in CLAUDE.md

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin feat/baruch-blue-theme
gh pr create --base main --title "feat(theme): Baruch Blue palette, fonts, header and hero" --body-file - <<'EOF'
## What changed

- Colors move to CSS-variable tokens in `global.css`; Tailwind's `ink`, `accent`, new `heading`/`brand`, and `slate-50…400` read them (refactor commit is pixel-identical).
- Baruch Blue palette: Charcoal text, Baruch Blue headings/header/hero, CUNY Blue actions, Pearl/Dove neutrals; self-hosted Figtree and JetBrains Mono; Sky focus outlines on blue.
- Lesson tables get real styles; `accent-color` themes native controls; course colors become CUNY Blue (ECO) and Grape (FIN).

## Why

The site read as a default template, and its declared fonts never loaded. Design: `docs/superpowers/specs/2026-09-27-baruch-blue-theme-design.md`.

## How to verify

- [x] Affected lesson(s) render at `/lessons/<course>/<slug>` (IS-LM, capital budgeting, valuing stocks checked at 1280 and 390)
- [ ] Affected quiz auto-grades correctly (no quiz logic changed)
- [ ] If schema changed: n/a
- [x] `npm run typecheck` passes locally
- [x] `npm run build` passes locally
- [x] `node --test 'src/lib/**/*.test.ts'` passes (new `theme-tokens.test.ts` guards AA contrast and the official colors)
- [ ] Owner on the Vercel preview, signed in: `/dashboard`, `/instructor/classes/eco-1002`, `/admin`, one workshop page; heading audit and header fit as in the plan's Task 7

## Screenshots / GIFs

Attach home (1280 and 390), the IS-LM lesson, and `/fin-3610` from `.playwright-mcp/after-header/` and `.playwright-mcp/after-palette/`.

## Out of scope

Charts (PR 2: `feat/baruch-blue-charts`), dark mode, semantic renames of `slate-*`, the duplicated home `<title>`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

Then attach the screenshots through the PR page in a browser; `gh` cannot upload images.

- [ ] **Step 5: CI and preview**

Run: `gh pr checks --watch`
Expected: `verify` passes (`schema-roundtrip` and `copyright-gate` are advisory). Note the Vercel preview URL from the checks.

- [ ] **Step 6: Owner review on the preview (Review Focus 1 and 5, signed in)**

Stop and ask the owner to sign in on the preview and, on `/dashboard`, `/instructor/classes/eco-1002`, `/admin`, and one workshop page:

- run Tool D in the browser console (expected `[]`);
- at 1280px with a staff account, confirm the header nav stays on one line (Tool G: `navHeight <= 40`).

Fix anything reported with a new commit on this branch, then repeat Step 5.

- [ ] **Step 7: Merge and confirm production (owner go-ahead required)**

After the owner approves, merge the way the repo does: squash, as the `(#N)` suffixes on `main` show (`gh pr merge --squash`). The PR keeps the per-commit split for review, and on `main` the whole PR becomes one revertable commit. Then confirm a Vercel check-run exists for the merge SHA:

```bash
gh api repos/junbuluv/edu_webpage/commits/$(git rev-parse origin/main)/check-runs --jq '.check_runs[] | select(.name | startswith("Vercel")) | .name + " " + .conclusion'
```

If it prints nothing, tell the owner production did not deploy and offer `vercel deploy --prod --yes` (per CLAUDE.md); run it only with their go-ahead.

---

# PR 2: charts (`feat/baruch-blue-charts`)

### Task 8: Chart colors via CSS variables (no visual change)

**Files:**

- Test: `src/lib/theme/no-hardcoded-colors.test.ts` (new)
- Modify: `src/styles/global.css` (chart tokens)
- Modify: `src/components/viz/*.tsx` (22 files)

**Interfaces:**

- Consumes: PR 1 merged to `main`.
- Produces: CSS variables `--chart-1`, `--chart-2`, `--chart-3`, `--chart-4`, `--chart-1-soft`, `--chart-3-soft`, `--chart-grid`, `--chart-ref`, `--chart-ink` (hex values); chart components reference them as `var(--chart-…)`.

- [ ] **Step 1: Branch from the merged main**

```bash
git switch main
git pull --ff-only
git switch -c feat/baruch-blue-charts
```

- [ ] **Step 2: Capture the baseline**

Run Tool C for the CHARTS set into `.playwright-mcp/before-charts/`.

- [ ] **Step 3: Write the failing guard test**

Create `src/lib/theme/no-hardcoded-colors.test.ts`:

```ts
// Run: node --test src/lib/theme/no-hardcoded-colors.test.ts
//
// Components take colors from theme tokens (--chart-* in
// src/styles/global.css, Tailwind classes elsewhere), not hex literals.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const COMPONENTS = fileURLToPath(new URL('../../components/', import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(tsx|astro)$/.test(entry.name) ? [path] : [];
  });
}

function offenders(pattern: RegExp): string[] {
  return sourceFiles(COMPONENTS).flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(pattern)].map(
      (m) => `${relative(COMPONENTS, file)}: ${m[0]}`,
    ),
  );
}

// The pre-theme chart palette; each color now has a --chart-* token.
const OLD_PALETTE =
  /#(?:2563eb|dc2626|059669|f97316|dbeafe|10b981|e2e8f0|94a3b8|0f172a)\b/gi;

test('chart components use --chart-* tokens, not the old palette hexes', () => {
  assert.deepEqual(offenders(OLD_PALETTE), []);
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `node --test src/lib/theme/no-hardcoded-colors.test.ts`
Expected: FAIL, listing about 100 offenders such as `viz/ISLMChart.tsx: #2563eb`.

- [ ] **Step 5: Add the chart tokens with today's values**

In `src/styles/global.css`, inside `:root`, directly after the `--neutral-400` line, add:

<!-- prettier-ignore -->
```css

  /* Chart colors: hex, because charts use them in SVG attributes. */
  --chart-1: #2563eb;
  --chart-2: #dc2626;
  --chart-3: #059669;
  --chart-4: #f97316;
  --chart-1-soft: #dbeafe;
  --chart-3-soft: #10b981;
  --chart-grid: #e2e8f0;
  --chart-ref: #94a3b8;
  --chart-ink: #0f172a;
```

- [ ] **Step 6: Replace the literals**

```bash
perl -pi -e '
  s/#2563eb\b/var(--chart-1)/gi;
  s/#dc2626\b/var(--chart-2)/gi;
  s/#059669\b/var(--chart-3)/gi;
  s/#f97316\b/var(--chart-4)/gi;
  s/#dbeafe\b/var(--chart-1-soft)/gi;
  s/#10b981\b/var(--chart-3-soft)/gi;
  s/#e2e8f0\b/var(--chart-grid)/gi;
  s/#94a3b8\b/var(--chart-ref)/gi;
  s/#0f172a\b/var(--chart-ink)/gi;
' src/components/viz/*.tsx
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `node --test src/lib/theme/*.test.ts`
Expected: PASS.

- [ ] **Step 8: Typecheck, build, and prove there is no visual change**

Run `npm run typecheck` and the build command. Then run Tool C for the CHARTS set into `.playwright-mcp/after-charts-refactor/` and diff each file against `.playwright-mcp/before-charts/` with Tool A, using the loop from Task 2, Step 9.
Expected: `IDENTICAL` for all 19. If a chart differs only while animating, re-shoot it; if it still differs, find the literal that resolved differently.

- [ ] **Step 9: Commit**

```bash
npm run format
git add src/lib/theme/no-hardcoded-colors.test.ts src/styles/global.css src/components/viz
git commit -F - <<'EOF'
refactor(charts): chart colors via CSS variables

Chart components read --chart-1..4, -1-soft, -3-soft, -grid, -ref and
-ink instead of hex literals. Token values equal today's colors; all 19
chart lessons are pixel-identical. A guard test rejects the old palette
hexes in src/components.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 9: Series color slots for BarFigure and legacy chart colors

**Files:**

- Create: `src/lib/chart/series-color.ts`
- Test: `src/lib/chart/series-color.test.ts`
- Modify: `src/lib/theme/no-hardcoded-colors.test.ts` (stricter pattern)
- Modify: `src/components/mdx/BarFigure.tsx`
- Modify: `src/components/viz/AnnuityExplorer.tsx`, `src/components/viz/DuPontExplorer.tsx`, `src/components/viz/CreditSpreadExplorer.tsx`
- Modify: 11 lessons in `src/content/lessons/fin-3610/`: `capital-budgeting-cashflows`, `credit-risk-and-spreads`, `debt-and-taxes`, `factor-models`, `financial-statements-and-ratios`, `mergers-and-acquisitions`, `mm-perfect-market`, `multiples-and-comparables`, `payout-policy`, `risk-return-statistics`, `valuing-stocks` (`.mdx`)

**Interfaces:**

- Consumes: `--chart-1` to `--chart-4` and `--chart-grid` from Task 8.
- Produces: `defaultSeriesColor(index: number): string` and `resolveSeriesColor(color: string | undefined, index: number): string`, both returning `'var(--chart-n)'` or a hex string. BarFigure's `series[].color` accepts `'chart-1'` to `'chart-4'` or a hex color.

- [ ] **Step 1: Write the failing resolver tests (Review Focus 4)**

Create `src/lib/chart/series-color.test.ts`:

```ts
// Run: node --test src/lib/chart/series-color.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultSeriesColor, resolveSeriesColor } from './series-color.ts';

test('no color uses the default slot for the series position', () => {
  assert.equal(resolveSeriesColor(undefined, 0), 'var(--chart-1)');
  assert.equal(resolveSeriesColor(undefined, 3), 'var(--chart-4)');
  assert.equal(resolveSeriesColor(undefined, 4), 'var(--chart-1)');
});

test('slot names resolve to theme variables', () => {
  assert.equal(resolveSeriesColor('chart-2', 0), 'var(--chart-2)');
  assert.equal(resolveSeriesColor(' chart-4 ', 0), 'var(--chart-4)');
});

test('hex colors pass through unchanged', () => {
  assert.equal(resolveSeriesColor('#4572a7', 0), '#4572a7');
  assert.equal(resolveSeriesColor('#ABC', 1), '#ABC');
});

test('unknown values fall back to the default slot instead of rendering blank', () => {
  assert.equal(resolveSeriesColor('chart-5', 1), 'var(--chart-2)');
  assert.equal(resolveSeriesColor('blue', 2), 'var(--chart-3)');
  assert.equal(resolveSeriesColor('', 0), 'var(--chart-1)');
  assert.equal(resolveSeriesColor('#12345', 0), 'var(--chart-1)');
});

test('negative indexes still land on a slot', () => {
  assert.equal(defaultSeriesColor(-1), 'var(--chart-4)');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test src/lib/chart/series-color.test.ts`
Expected: FAIL with `Cannot find module` pointing at `series-color.ts`.

- [ ] **Step 3: Write the resolver**

Create `src/lib/chart/series-color.ts`:

```ts
// Resolves a chart series color. Lessons may pass a slot name ('chart-1' to
// 'chart-4'), which follows the site theme, or a literal hex color. Anything
// else falls back to the default slot for the series' position, so a typo
// never renders a black or invisible series. Alias-free for node --test.

const SLOTS = 4;
const SLOT = /^chart-([1-4])$/;
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function defaultSeriesColor(index: number): string {
  const slot = (((index % SLOTS) + SLOTS) % SLOTS) + 1;
  return `var(--chart-${slot})`;
}

export function resolveSeriesColor(
  color: string | undefined,
  index: number,
): string {
  const value = color?.trim();
  if (value) {
    const slot = SLOT.exec(value);
    if (slot) return `var(--chart-${slot[1]})`;
    if (HEX.test(value)) return value;
  }
  return defaultSeriesColor(index);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test src/lib/chart/series-color.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Tighten the guard to any hex literal**

In `src/lib/theme/no-hardcoded-colors.test.ts`, replace everything from the `// The pre-theme chart palette` comment to the end of the file with:

```ts
// Quoted hex color literals: '#abc', "#aabbcc", `#aabbcc`.
const HEX_LITERAL = /['"`]#(?:[0-9a-f]{3}|[0-9a-f]{6})['"`]/gi;

test('components contain no hardcoded hex colors', () => {
  assert.deepEqual(offenders(HEX_LITERAL), []);
});
```

Run: `node --test src/lib/theme/no-hardcoded-colors.test.ts`
Expected: FAIL, listing `mdx/BarFigure.tsx` (`'#4572a7'`, `'#aa4643'`, `'#89a54e'`, `'#80699b'`, `"#eee"`), `viz/AnnuityExplorer.tsx: "#4572a7"`, `viz/DuPontExplorer.tsx: "#4572a7"`, and `viz/CreditSpreadExplorer.tsx: "#aa4643"`.

- [ ] **Step 6: Use the resolver in BarFigure**

In `src/components/mdx/BarFigure.tsx`:

1. Add after the `recharts` import: `import { resolveSeriesColor } from '@lib/chart/series-color';`
2. Replace the `Series` interface with:

```tsx
interface Series {
  key: string;
  name: string;
  /** A theme slot ('chart-1' to 'chart-4') or a hex color. Defaults to the series' slot. */
  color?: string;
}
```

3. Delete the line `const DEFAULT_COLORS = ['#4572a7', '#aa4643', '#89a54e', '#80699b'];`.
4. Replace `<CartesianGrid stroke="#eee" strokeDasharray="3 3" />` with `<CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />`.
5. Replace `fill={s.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]}` with `fill={resolveSeriesColor(s.color, i)}`.

- [ ] **Step 7: Move the legacy chart colors and lesson colors onto slots**

```bash
perl -pi -e 's/#4572a7\b/var(--chart-1)/gi; s/#aa4643\b/var(--chart-2)/gi' \
  src/components/viz/AnnuityExplorer.tsx src/components/viz/DuPontExplorer.tsx src/components/viz/CreditSpreadExplorer.tsx
perl -pi -e "s/color: '#4572a7'/color: 'chart-1'/g; s/color: '#aa4643'/color: 'chart-2'/g" src/content/lessons/fin-3610/*.mdx
grep -rnE '#(4572a7|aa4643)' src
grep -rc "color: 'chart-" src/content/lessons/fin-3610 | grep -v ':0' | wc -l
```

Expected: the first `grep` prints nothing; the count prints `11` (lessons). The lesson edits total 16 lines (12 × `chart-1`, 4 × `chart-2`).

- [ ] **Step 8: Run tests, typecheck, build, and copyright gate**

Run: `node --test 'src/lib/**/*.test.ts'`, `npm run typecheck`, the build command, `npm run check:copyright`.
Expected: all pass; no new copyright findings.

- [ ] **Step 9: Review the intended visual change**

Run Tool C (1280) for `/lessons/fin-3610/annuities-and-perpetuities`, `/lessons/fin-3610/financial-statements-and-ratios`, `/lessons/fin-3610/credit-risk-and-spreads`, `/lessons/fin-3610/valuing-stocks`, and `/lessons/fin-3610/payout-policy` into `.playwright-mcp/after-slots/`. Confirm that bars and lines that used the Highcharts blue and red now use the site's slot 1 and 2 colors, and that each BarFigure grid and legend still render.

- [ ] **Step 10: Commit**

```bash
npm run format
git add src/lib/chart src/lib/theme/no-hardcoded-colors.test.ts src/components/mdx/BarFigure.tsx src/components/viz/AnnuityExplorer.tsx src/components/viz/DuPontExplorer.tsx src/components/viz/CreditSpreadExplorer.tsx src/content/lessons/fin-3610
git commit -F - <<'EOF'
refactor(charts): route BarFigure and legacy chart colors through slots

BarFigure series accept a theme slot ('chart-1'..'chart-4') or hex via
the pure resolveSeriesColor, falling back to the series' slot on bad
input. The Highcharts-era blues and reds in BarFigure, three explorers
and 11 FIN 3610 lessons now use the site slots. The guard test rejects
any hex literal in src/components.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 10: Chart text uses ink, not series colors

**Files:**

- Modify: `src/components/viz/ISLMChart.tsx`, `src/components/viz/ADASChart.tsx`, `src/components/viz/BondPriceYield.tsx` (each file's `DragHandle`)
- Modify: `src/components/viz/DuPontExplorer.tsx` (reference-line label)
- Modify: `src/styles/global.css` (Recharts text override)

**Interfaces:**

- Consumes: `--ink` (PR 1) and `--chart-ink` (Task 8).
- Produces: a `DragHandle` that takes the series color only as `borderColor`; the `.recharts-legend-item-text, .recharts-tooltip-item` override.

- [ ] **Step 1: Record the failing check**

On `/lessons/eco-1002/is-lm-intro` at width 1280, run with `browser_evaluate`:

```js
() => {
  const handle = document.querySelector('button[aria-label^="Drag to shift"]');
  const legend = document.querySelector('.recharts-legend-item-text');
  return {
    handleText: getComputedStyle(handle).color,
    handleBorder: getComputedStyle(handle).borderTopColor,
    legendText: getComputedStyle(legend).color,
  };
};
```

Expected today: `handleText` and `legendText` equal the series color `rgb(37, 99, 235)`, not ink `rgb(56, 56, 56)`.

- [ ] **Step 2: Fix the drag handles**

Each of the three chart files has its own `DragHandle`, and they differ slightly. All three pass the series color as text `color`; the fix keeps it only as `borderColor` and adds `text-ink`.

In `src/components/viz/ISLMChart.tsx` (the only one that wraps the label in a `<span>`), replace

<!-- prettier-ignore -->
```tsx
      style={{ top, color }}
      className="absolute right-2 z-10 -translate-y-1/2 cursor-ew-resize rounded-full border-2 bg-white px-2 py-0.5 text-xs font-bold shadow hover:shadow-md"
      // The border color matches the curve. Tailwind doesn't know the
      // dynamic color, so we set it inline via the wrapper style.
    >
      <span style={{ borderColor: color }}>{label} ↔</span>
```

with

<!-- prettier-ignore -->
```tsx
      style={{ top, borderColor: color }}
      className="absolute right-2 z-10 -translate-y-1/2 cursor-ew-resize rounded-full border-2 bg-white px-2 py-0.5 text-xs font-bold text-ink shadow hover:shadow-md"
      // The border carries the curve's color; the label stays ink because
      // some series colors fall below 4.5:1 as text.
    >
      {label} ↔
```

In `src/components/viz/ADASChart.tsx` and `src/components/viz/BondPriceYield.tsx`, replace

<!-- prettier-ignore -->
```tsx
      style={{ top, color, borderColor: color }}
      className="absolute right-2 z-10 -translate-y-1/2 cursor-ew-resize rounded-full border-2 bg-white px-2 py-0.5 text-xs font-bold shadow hover:shadow-md"
```

with

<!-- prettier-ignore -->
```tsx
      style={{ top, borderColor: color }}
      className="absolute right-2 z-10 -translate-y-1/2 cursor-ew-resize rounded-full border-2 bg-white px-2 py-0.5 text-xs font-bold text-ink shadow hover:shadow-md"
```

Check: `grep -n "style={{ top" src/components/viz/ISLMChart.tsx src/components/viz/ADASChart.tsx src/components/viz/BondPriceYield.tsx` shows `style={{ top, borderColor: color }}` in all three.

- [ ] **Step 3: Fix the DuPont label**

In `src/components/viz/DuPontExplorer.tsx`, inside the `ReferenceLine` `label` object, change `fill: 'var(--chart-2)',` to `fill: 'var(--chart-ink)',`. The line's own `stroke="var(--chart-2)"` stays.

Check: `grep -n "fill: 'var(--chart" src/components/viz/DuPontExplorer.tsx` shows only `var(--chart-ink)`.

- [ ] **Step 4: Override Recharts' series-colored text**

At the end of `src/styles/global.css`, add:

```css
/* Recharts colors legend text and default-tooltip items with the series
   color through inline styles; keep that text in ink, since some series
   colors are below 4.5:1 as text. Legend swatches keep the series color. */
.recharts-legend-item-text,
.recharts-tooltip-item {
  color: rgb(var(--ink)) !important;
}
```

- [ ] **Step 5: Verify**

Run `npm run typecheck`, `node --test 'src/lib/**/*.test.ts'`, and the build command. All succeed.
Re-run the Step 1 snippet. Expected: `handleText` and `legendText` are `rgb(56, 56, 56)`, and `handleBorder` is still the series color.
Hover the IS-LM chart (`browser_hover` on the plot area) and confirm by screenshot that tooltip rows are ink. Repeat the handle check on `/lessons/eco-1002/ad-as` and `/lessons/fin-3610/bond-pricing-and-yield`.

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/components/viz/ISLMChart.tsx src/components/viz/ADASChart.tsx src/components/viz/BondPriceYield.tsx src/components/viz/DuPontExplorer.tsx src/styles/global.css
git commit -F - <<'EOF'
fix(charts): chart text uses ink, not series colors

Drag-handle labels, the DuPont reference label, and Recharts legend and
tooltip text were drawn in the series color. Series colors only need
3:1 as marks, so text now uses ink while borders and swatches keep the
series color.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 11: Baruch colorblind-safe chart palette

**Files:**

- Test: `src/lib/theme/theme-tokens.test.ts` (append)
- Modify: `src/styles/global.css` (chart token values)

**Interfaces:**

- Consumes: `color()` and `hex()` helpers already in `theme-tokens.test.ts` (Task 4); chart tokens from Task 8.
- Produces: final chart token values.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/theme/theme-tokens.test.ts`:

```ts
// Chart marks need 3:1 against the white chart surface; the light step of
// the ordinal teal pair needs 2:1; chart text (ink) needs 4.5:1.
const MARK_PAIRS: Array<[string, number]> = [
  ['chart-1', 3],
  ['chart-2', 3],
  ['chart-3', 3],
  ['chart-4', 3],
  ['chart-ref', 3],
  ['chart-3-soft', 2],
  ['chart-ink', 4.5],
];

for (const [name, min] of MARK_PAIRS) {
  test(`--${name} on white is at least ${min}:1`, () => {
    const ratio = contrastRatio(color(name), WHITE);
    assert.ok(
      ratio >= min,
      `--${name}: ${ratio.toFixed(2)}:1 is below ${min}:1`,
    );
  });
}

test('the first two chart slots use Baruch colors', () => {
  assert.equal(hex('chart-1'), '#2869AF'); // Midtown Blue, PMS 7455C
  assert.equal(hex('chart-2'), '#E65F24'); // Tangerine, PMS 165C
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test src/lib/theme/theme-tokens.test.ts`
Expected: FAIL. `--chart-4` is 2.80:1 (today's orange), `--chart-ref` is 2.56:1, and the slot test reports `'#2563EB' !== '#2869AF'`.

- [ ] **Step 3: Switch the values**

In `src/styles/global.css`, replace the nine chart token lines with:

<!-- prettier-ignore -->
```css
  --chart-1: #2869af; /* Midtown Blue, PMS 7455C */
  --chart-2: #e65f24; /* Tangerine, PMS 165C */
  --chart-3: #009e73; /* Okabe-Ito bluish green */
  --chart-4: #cc79a7; /* Okabe-Ito reddish purple */
  --chart-1-soft: #dce8f5; /* Midtown tint (Solow area) */
  --chart-3-soft: #56ba96; /* light step of chart-3 (waterfall D&A) */
  --chart-grid: #e6e4df; /* = slate-200 */
  --chart-ref: #8c8a84; /* zero and reference lines */
  --chart-ink: #383838; /* = ink: dots, total lines, chart text */
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test 'src/lib/**/*.test.ts'`
Expected: PASS.

- [ ] **Step 5: Re-run the colorblind validator**

If the `dataviz` skill is available, run its `scripts/validate_palette.js` as follows. In Claude Code, the skill prints its base directory when it loads; substitute that for `<dataviz-skill>`.

```bash
node <dataviz-skill>/scripts/validate_palette.js "#2869AF,#E65F24,#009E73,#CC79A7" --mode light --surface "#FFFFFF" --pairs all
node <dataviz-skill>/scripts/validate_palette.js "#56BA96,#009E73" --ordinal --mode light --surface "#FFFFFF"
```

Expected (spec Appendix B): the first run passes lightness, chroma, the normal-vision floor (worst ΔE 15.2) and contrast, and warns on colorblind separation at ΔE 7.6 between slots 3 and 4; the second passes. Paste both outputs into the PR description.

- [ ] **Step 6: Review every chart**

Run the typecheck and the build command. Then run Tool C for the CHARTS set into `.playwright-mcp/after-palette-charts/` and review each image. Check for:

- IS/AD curves in Midtown Blue and LM/AS curves in Tangerine;
- the waterfall's inflows in two teals, terminal value in blue, and outflows in purple and Tangerine, with a charcoal total line;
- equilibrium dots in charcoal and grids in warm gray;
- legends and handle labels in ink.

- [ ] **Step 7: Commit**

```bash
npm run format
git add src/lib/theme/theme-tokens.test.ts src/styles/global.css
git commit -F - <<'EOF'
feat(charts): Baruch colorblind-safe chart palette

Slots 1-2 become Midtown Blue and Tangerine; slots 3-4 come from the
Okabe-Ito set because Baruch's Grape and Ochre collide with them for
colorblind readers (validated with --pairs all). The old palette put red
next to orange in the waterfall (dE 14.9, fails even for full color
vision). theme-tokens.test.ts now guards chart contrast and slots 1-2.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 12: Document, verify, and open PR 2

**Files:**

- Modify: `CLAUDE.md`

**Interfaces:**

- Consumes: Tasks 8 to 11.
- Produces: an open PR for `feat/baruch-blue-charts`.

- [ ] **Step 1: Document the chart conventions in CLAUDE.md**

In `CLAUDE.md`, extend the "Theme tokens" bullet added in Task 7 with:

```markdown
Charts use `var(--chart-1)`…`var(--chart-4)` (Midtown Blue, Tangerine,
Okabe-Ito green and purple), `--chart-1-soft`, `--chart-3-soft`,
`--chart-grid`, `--chart-ref`, and `--chart-ink`; chart text is always ink.
BarFigure `color` takes `'chart-1'`…`'chart-4'` (or hex).
`src/lib/theme/no-hardcoded-colors.test.ts` rejects hex literals in
`src/components`.
```

In "Verifying before declaring done", step 3, add `chart/series-color.ts` to the alias-free module list, and replace the "N tests as of" count with the number from Step 2 below and today's date.

- [ ] **Step 2: Full local verification**

```bash
npm run format
npm run typecheck
node --test 'src/lib/**/*.test.ts'
PUBLIC_SUPABASE_URL=https://placeholder.supabase.co PUBLIC_SUPABASE_ANON_KEY=placeholder PUBLIC_SITE_URL=http://localhost:4321 npm run build
npm run check:copyright
```

Expected: all pass; note the test count for Step 1.

- [ ] **Step 3: Commit, push, open the PR**

```bash
git add CLAUDE.md
git commit -F - <<'EOF'
docs: record the chart color conventions in CLAUDE.md

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
git push -u origin feat/baruch-blue-charts
gh pr create --base main --title "feat(charts): Baruch colorblind-safe chart palette" --body-file - <<'EOF'
## What changed

- Chart colors move to `--chart-*` tokens (refactor commit is pixel-identical across all 19 chart lessons); a guard test rejects hex literals in `src/components`.
- BarFigure series take theme slots (`'chart-1'`…`'chart-4'`) through a tested resolver; 11 FIN 3610 lessons switched from Highcharts hex.
- New palette: Midtown Blue, Tangerine, Okabe-Ito green and purple; chart text (legends, tooltips, drag handles) is ink.

## Why

The old palette fails colorblind checks where colors touch (red next to orange in the cash-flow waterfall, ΔE 14.9), and Tangerine is below 4.5:1 as text. Design: `docs/superpowers/specs/2026-09-27-baruch-blue-theme-design.md` §5.4.

## How to verify

- [x] Affected lesson(s) render at `/lessons/<course>/<slug>` (all 19 chart lessons reviewed at 1280)
- [ ] Affected quiz auto-grades correctly (no quiz logic changed)
- [ ] If schema changed: n/a
- [x] `npm run typecheck` passes locally
- [x] `npm run build` passes locally
- [x] `node --test 'src/lib/**/*.test.ts'` passes (new series-color, no-hardcoded-colors, chart contrast tests)

Validator output (`--pairs all` and ordinal):

<paste Task 11 Step 5 output here>

## Screenshots / GIFs

Attach IS-LM, AD-AS, capital budgeting (waterfall), MM Proposition II, and valuing stocks from `.playwright-mcp/after-palette-charts/`.

## Out of scope

Dark-mode chart palette, Plotly (unused), the duplicated home `<title>`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

Before creating the PR, replace the `<paste … here>` line in the body with the actual validator output from Task 11, Step 5. Then attach the screenshots through the PR page.

- [ ] **Step 4: CI, owner review, merge, production**

Run `gh pr checks --watch`; `verify` must pass. Stop and ask the owner to review the preview's chart lessons. Merge only with their go-ahead, squashing as in Task 7, Step 7. Then confirm the production deploy for the merge SHA:

```bash
gh api repos/junbuluv/edu_webpage/commits/$(git rev-parse origin/main)/check-runs --jq '.check_runs[] | select(.name | startswith("Vercel")) | .name + " " + .conclusion'
```

If it prints nothing, tell the owner production did not deploy and offer `vercel deploy --prod --yes`; run it only with their go-ahead.

---

## Self-review record

- **Spec coverage.** §5.1 tokens: Tasks 2 and 4. Neutrals remap: Tasks 2 and 4. Course colors: Task 4. §5.2 fonts: Task 3. Weights, prose size, and heading rule: Task 4. §5.3 header and hero: Task 5. `hover:bg-blue-700`: Task 2. Sidebar labels, blockquote, favicon: Task 4. `accent-color`: Task 6. §5.4 chart tokens: Task 8; mapping: Tasks 8 and 9; text rule: Task 10; BarFigure and lessons: Task 9; final values: Task 11. §5.5 tables: Task 6. §7 automated checks: Tasks 1, 2, 4, 8, 9, 11; visual checks: Tasks 2 to 11; owner checks: Tasks 7 and 12. §8 risks: heading audit in Tasks 4 and 7, slate comment in Task 2, Figtree fit in Tasks 3 and 5. §10 FIN color: Task 4 (Grape, skippable).
- **Placeholders.** The one deliberate fill-in is the validator output pasted into PR 2's body, which does not exist until Task 11 runs.
- **Names used across tasks.** `contrastRatio`, `parseRootTokens`, `toRgb` (Task 1); `color()` and `hex()` in `theme-tokens.test.ts` (Tasks 2, 4, 11); `offenders()` in `no-hardcoded-colors.test.ts` (Tasks 8, 9); `resolveSeriesColor`, `defaultSeriesColor` (Task 9); `onBlueFocus`, `navLink` (Task 5); tokens `--ink … --chart-ink` are consistent with the spec's table (with `--chart-ink` replacing the spec's earlier `--chart-point`/`--chart-text` split, as the spec's final table states).
