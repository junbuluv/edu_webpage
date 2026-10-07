// Run: node --test src/lib/tutor/math-delims.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMathDelimiters as n } from './math-delims.ts';

test('escapes money', () => {
  assert.equal(n('It costs $5 and $10.'), 'It costs \\$5 and \\$10.');
});

test('converts inline \\( \\) to $…$', () => {
  assert.equal(
    n('Slope is \\(\\frac{1}{1-c}\\).'),
    'Slope is $\\frac{1}{1-c}$.',
  );
});

test('converts display \\[ \\] to a $$ block', () => {
  assert.equal(n('\\[ Y = C + I + G \\]'), '\n$$\nY = C + I + G\n$$\n');
});

test('mixed money and math', () => {
  assert.equal(
    n('If income rises by $100, \\(\\Delta Y = 100/(1-0.8) = 500\\).'),
    'If income rises by \\$100, $\\Delta Y = 100/(1-0.8) = 500$.',
  );
});

test('keeps existing $$ math and already-escaped dollars', () => {
  assert.equal(n('$$x^2$$ costs \\$3'), '$$x^2$$ costs \\$3');
});

test('leaves code untouched', () => {
  const text = 'Run `echo $HOME` then\n```\nprice = $5\n```';
  assert.equal(n(text), text);
});

test('unclosed delimiters fall back to plain text', () => {
  assert.equal(n('A stray \\( and $2'), 'A stray \\( and \\$2');
});
