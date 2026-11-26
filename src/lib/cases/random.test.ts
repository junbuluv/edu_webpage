import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mulberry32, triangular } from './random.ts';

test('the same seed gives the same numbers, in [0, 1)', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const xs = Array.from({ length: 1000 }, () => a());
  assert.deepEqual(
    xs.slice(0, 5),
    Array.from({ length: 5 }, () => b()),
  );
  assert.ok(xs.every((x) => x >= 0 && x < 1));
});

test('different seeds give different numbers', () => {
  assert.notEqual(mulberry32(1)(), mulberry32(2)());
});

test('the draws are spread evenly across [0, 1)', () => {
  const next = mulberry32(7);
  const counts = new Array(10).fill(0);
  for (let i = 0; i < 20_000; i++) counts[Math.floor(next() * 10)]++;
  for (const c of counts) assert.ok(c > 1_800 && c < 2_200, String(c));
});

test('a triangle maps the ends to low and high and its peak to the mode', () => {
  assert.equal(triangular(0, 2, 3, 5), 2);
  assert.equal(triangular(1, 2, 3, 5), 5);
  // P(X <= mode) = (mode - low) / (high - low) = 1/3
  assert.ok(Math.abs(triangular(1 / 3, 2, 3, 5) - 3) < 1e-12);
});

test('a triangle with no width returns its one value', () => {
  assert.equal(triangular(0.3, 4, 4, 4), 4);
});

test('triangle draws average (low + mode + high) / 3', () => {
  const next = mulberry32(11);
  let sum = 0;
  const n = 50_000;
  for (let i = 0; i < n; i++) sum += triangular(next(), 0, 3, 5);
  assert.ok(Math.abs(sum / n - 8 / 3) < 0.02, String(sum / n));
});
