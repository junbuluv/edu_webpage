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
