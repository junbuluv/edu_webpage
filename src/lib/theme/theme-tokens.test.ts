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
