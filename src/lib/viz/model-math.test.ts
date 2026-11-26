import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  operatingIncome,
  paddedReturnDomain,
  irrForCashflows,
} from './model-math.ts';

test('gross margin and cash operating expenses remain distinct', () => {
  const result = operatingIncome(1_000, 0.3, 0.12, 100);
  assert.deepEqual(result, {
    cogs: 700,
    cashOpex: 120,
    ebitda: 180,
    ebit: 80,
  });
});

test('CAPM return domain contains every plotted slider corner', () => {
  const domain = paddedReturnDomain([0.1, 0.1 + 2 * 0.15, 0.15]);
  assert.ok(domain[0] <= 0.1);
  assert.ok(domain[1] > 0.4);
});

test('IRR is undefined without a sign change and expands beyond 500 percent', () => {
  assert.equal(irrForCashflows([0, 0, 0]), null);
  assert.equal(irrForCashflows([0, 100]), null);
  assert.equal(irrForCashflows([-100, 0]), null);
  const highIrr = irrForCashflows([-50, 1000]);
  assert.ok(highIrr !== null);
  assert.ok(Math.abs(highIrr - 19) < 1e-8);
});
