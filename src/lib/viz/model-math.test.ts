import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  loanableFundsEquilibrium,
  loanableFundsRateDomain,
  logNetExports,
  maxLocalOkunGap,
  operatingIncome,
  okunOutcome,
  paddedReturnDomain,
  irrForCashflows,
  solveLogExchangeRate,
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

test('log net-exports model has a positive clearing exchange rate', () => {
  for (const netExports of [-950, 1_270]) {
    for (const intercept of [0, 700]) {
      const rate = solveLogExchangeRate(netExports, intercept, 700);
      assert.ok(Number.isFinite(rate));
      assert.ok(rate > 0);
      assert.ok(
        Math.abs(logNetExports(rate, intercept, 700) - netExports) < 1e-9,
      );
    }
  }
});

test('Okun simulation range never implies unemployment below one percent', () => {
  for (const naturalRate of [3, 7]) {
    for (const coefficient of [0.2, 1]) {
      const maximumGap = maxLocalOkunGap(naturalRate, coefficient);
      const outcome = okunOutcome(
        maximumGap,
        naturalRate,
        2.5,
        0.5,
        coefficient,
      );
      assert.ok(outcome.unemployment >= 1 - 1e-12);
    }
  }
});

test('loanable-funds domain contains every slider-corner equilibrium', () => {
  for (const investmentIntercept of [600, 1_800]) {
    for (const savingIntercept of [500, 1_500]) {
      for (const deficit of [-300, 500]) {
        const equilibrium = loanableFundsEquilibrium(
          investmentIntercept,
          savingIntercept,
          30,
          25,
          deficit,
        );
        const domain = loanableFundsRateDomain(
          investmentIntercept,
          savingIntercept,
          30,
          25,
          deficit,
          equilibrium.realRate,
        );
        assert.ok(equilibrium.realRate >= domain.minimum - 1e-12);
        assert.ok(equilibrium.realRate <= domain.maximum + 1e-12);
        assert.ok(equilibrium.quantity >= 0);
      }
    }
  }
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
