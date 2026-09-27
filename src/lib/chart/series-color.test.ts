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
