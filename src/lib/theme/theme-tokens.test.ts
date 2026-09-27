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
