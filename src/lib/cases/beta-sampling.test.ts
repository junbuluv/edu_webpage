import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  INDUSTRIES,
  WINDOW,
  betaDataFrom,
  costOfEquity,
  monthIndex,
  monthLabel,
  rollingBetas,
  sampleBetas,
  windowBeta,
} from './beta-sampling.ts';

const near = (a: number, b: number, tol = 1e-9) =>
  assert.ok(Math.abs(a - b) < tol, `${a} is not within ${tol} of ${b}`);

// Made-up returns: the market zigzags, and the industry is 0.2 + 1.5 x market
// exactly, so every regression on any subset of months finds beta 1.5.
const x = Array.from({ length: 120 }, (_, i) => Math.sin(i) * 4 + (i % 7) - 3);
const exact = x.map((v) => 0.2 + 1.5 * v);
const noisy = x.map((v, i) => 0.2 + 1.5 * v + Math.cos(i * 3.1) * 2);

test('months are counted from the first month of the data', () => {
  assert.equal(monthLabel('1963-07', 0), '1963-07');
  assert.equal(monthLabel('1963-07', 5), '1963-12');
  assert.equal(monthLabel('1963-07', 6), '1964-01');
  assert.equal(monthIndex('1963-07', '1999-12'), 437);
  assert.equal(
    monthLabel('1963-07', monthIndex('1963-07', '2026-09')),
    '2026-09',
  );
});

test('a window regression recovers a known beta and alpha', () => {
  const r = windowBeta(exact, x, 99);
  near(r.beta, 1.5);
  near(r.alpha, 0.2);
  near(r.se, 0, 1e-6);
  near(r.r2, 1);
});

test('a window ends at the given month and is WINDOW months long', () => {
  // Changing a month just outside the window must not change its beta.
  const shifted = [...noisy];
  shifted[99 - WINDOW] += 50;
  near(windowBeta(shifted, x, 99).beta, windowBeta(noisy, x, 99).beta);
  assert.throws(() => windowBeta(noisy, x, WINDOW - 2), RangeError);
});

test('rolling betas: one per window, each equal to that window alone', () => {
  const roll = rollingBetas(noisy, x);
  assert.equal(roll.length, x.length - WINDOW + 1);
  near(roll[0], windowBeta(noisy, x, WINDOW - 1).beta);
  near(roll[roll.length - 1], windowBeta(noisy, x, x.length - 1).beta);
});

test('random draws are repeatable for a seed and exact on a perfect fit', () => {
  const a = sampleBetas(noisy, x, 200, 7);
  assert.equal(a.length, 200);
  assert.deepEqual(sampleBetas(noisy, x, 200, 7), a);
  assert.notDeepEqual(sampleBetas(noisy, x, 200, 8), a);
  for (const b of sampleBetas(exact, x, 50, 3)) near(b, 1.5, 1e-9);
});

test('cost of equity is the risk-free rate plus beta times the premium', () => {
  near(costOfEquity(4, 5, 1.2), 10);
  near(costOfEquity(4.26, 4.23, 0), 4.26);
});

// The committed data file from the factor regressions lesson.
const raw = JSON.parse(
  readFileSync(new URL('../factors/regressions.json', import.meta.url), 'utf8'),
);
const data = betaDataFrom(raw);

test('the data runs July 1963 to September 2026 for both industries', () => {
  assert.equal(data.start, '1963-07');
  assert.equal(data.market.length, 759);
  assert.equal(monthLabel(data.start, data.market.length - 1), '2026-09');
  for (const id of INDUSTRIES) {
    assert.equal(data.returns[id].length, data.market.length);
  }
  assert.match(data.copyright, /Fama and Kenneth R\. French/);
});

test('the betas the case quotes', () => {
  const at = (label: string) => monthIndex(data.start, label);
  const tech = data.returns['high-tech'];
  const utils = data.returns.utilities;
  const all = data.market.length - 1;
  near(windowBeta(tech, data.market, at('1999-12')).beta, 1.435, 5e-4);
  near(windowBeta(tech, data.market, at('1999-12')).se, 0.139, 5e-4);
  near(windowBeta(tech, data.market, at('2004-12')).beta, 1.958, 5e-4);
  near(windowBeta(utils, data.market, at('1999-12')).beta, 0.213, 5e-4);
  near(
    windowBeta(tech, data.market, all, data.market.length).beta,
    1.234,
    5e-4,
  );
  near(
    windowBeta(utils, data.market, all, data.market.length).beta,
    0.523,
    5e-4,
  );
});
