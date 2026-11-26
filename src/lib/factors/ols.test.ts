// Run: node --test src/lib/factors/ols.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ols } from './ols.ts';

const near = (actual: number, expected: number, tol = 1e-9) =>
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `expected ${expected}, got ${actual}`,
  );

test('one regressor matches the hand-computed textbook formulas', () => {
  // x-bar = 3, y-bar = 4, Sxx = 10, Sxy = 6, so slope = 0.6 and
  // intercept = 4 - 0.6 * 3 = 2.2. Residuals are -0.8, 0.6, 1, -0.6, -0.2:
  // SSR = 2.4, SST = 6, R2 = 0.6, s2 = 2.4 / 3 = 0.8.
  const r = ols([2, 4, 5, 4, 5], [[1, 2, 3, 4, 5]]);
  near(r.coef[0], 2.2);
  near(r.coef[1], 0.6);
  near(r.r2, 0.6);
  near(r.se[1], Math.sqrt(0.8 / 10)); // sqrt(s2 / Sxx)
  near(r.se[0], Math.sqrt(0.8 * (1 / 5 + 9 / 10))); // s2 * (1/n + xbar^2/Sxx)
  near(r.t[1], 0.6 / Math.sqrt(0.08));
  near(r.t[0], 2.2 / Math.sqrt(0.88));
  assert.equal(r.n, 5);
});

test('an exact linear relation is recovered with R-squared of 1', () => {
  const x1 = [1, 2, 3, 4, 5, 6];
  const x2 = [2, 1, 4, 3, 6, 4];
  const y = x1.map((v, i) => 1.5 + 2 * v - 0.5 * x2[i]);
  const r = ols(y, [x1, x2]);
  near(r.coef[0], 1.5);
  near(r.coef[1], 2);
  near(r.coef[2], -0.5);
  near(r.r2, 1);
  for (const s of r.se) near(s, 0, 1e-6);
});

test('two regressors match the normal equations solved by hand', () => {
  // x1 and x2 are uncorrelated and both sum to zero, so each slope is its
  // own Sxy / Sxx: b1 = 20/10 = 2, b2 = 6/4 = 1.5, intercept = y-bar = 3.
  // Fitted: 0.5, -0.5, 3, 3.5, 8.5; residuals 0.5, 0.5, -2, 0.5, 0.5.
  // SSR = 5, s2 = 5 / (5 - 3) = 2.5, SST = 54, R2 = 49/54.
  const x1 = [-2, -1, 0, 1, 2];
  const x2 = [1, -1, 0, -1, 1];
  const y = [1, 0, 1, 4, 9];
  const r = ols(y, [x1, x2]);
  near(r.coef[0], 3);
  near(r.coef[1], 2);
  near(r.coef[2], 1.5);
  near(r.r2, 49 / 54);
  near(r.se[0], Math.sqrt(2.5 / 5)); // s2 / n
  near(r.se[1], Math.sqrt(2.5 / 10)); // s2 / Sx1x1
  near(r.se[2], Math.sqrt(2.5 / 4)); // s2 / Sx2x2
});

test('the fitted line passes through the means, so alpha is the unexplained average', () => {
  // The identity the lesson uses: mean(y) = alpha + sum(beta_j * mean(x_j)).
  const x1 = [0.5, -1.2, 2.1, 0.3, -0.7, 1.9, -2.4, 0.8];
  const x2 = [1.1, 0.4, -0.9, 2.2, -1.5, 0.1, 0.6, -0.3];
  const y = [1.0, -0.8, 1.7, 1.9, -1.6, 2.2, -2.0, 0.4];
  const mean = (v: number[]) => v.reduce((s, a) => s + a, 0) / v.length;
  const r = ols(y, [x1, x2]);
  near(mean(y), r.coef[0] + r.coef[1] * mean(x1) + r.coef[2] * mean(x2));
});

test('rescaling a regressor rescales its slope and leaves t and R-squared alone', () => {
  const x = [1.2, -0.4, 3.1, 0.2, -2.2, 1.5, 0.9];
  const y = [1.0, 0.1, 2.5, 0.6, -1.9, 1.8, 0.2];
  const a = ols(y, [x]);
  const b = ols(y, [x.map((v) => v * 100)]);
  near(b.coef[1], a.coef[1] / 100);
  near(b.t[1], a.t[1], 1e-8);
  near(b.r2, a.r2);
  near(b.coef[0], a.coef[0]);
});

test('bad inputs are rejected instead of returning nonsense', () => {
  assert.throws(() => ols([1, 2, 3], [[1, 2]]), /one value per observation/);
  assert.throws(() => ols([1, 2], [[1, 2]]), /more observations/);
  const x = [1, 2, 3, 4, 5];
  assert.throws(
    () => ols([1, 3, 2, 5, 4], [x, x.map((v) => 2 * v)]),
    /collinear/,
  );
  assert.throws(() => ols([1, 3, 2, 5, 4], [[7, 7, 7, 7, 7]]), /collinear/);
});
