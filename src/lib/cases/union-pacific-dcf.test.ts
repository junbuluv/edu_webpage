// Run: node --test src/lib/cases/union-pacific-dcf.test.ts
//
// The valuation case's numbers: the five years copied from Union Pacific's
// annual reports must agree with each other, and the base case must follow
// from them as the case text says.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dcf, historicalFcf, impliedLongRunGrowth } from './dcf.ts';
import {
  DCF_BASE,
  DCF_RANGES,
  HISTORY,
  NET_DEBT,
  REINVESTMENT_SHARE,
  UNION_PACIFIC as UP,
} from './union-pacific.ts';

const near = (a: number, b: number, tol: number) =>
  assert.ok(Math.abs(a - b) < tol, `${a} is not within ${tol} of ${b}`);

test('the history runs 2021 to 2025, and 2025 matches the WACC case', () => {
  assert.deepEqual(
    HISTORY.map((h) => h.year),
    [2021, 2022, 2023, 2024, 2025],
  );
  const y2025 = HISTORY[4];
  assert.equal(y2025.revenue, 24_510);
  assert.equal(y2025.incomeTaxExpense, UP.incomeTaxExpense);
});

test('2025 operating margin is 40.2%, the operating ratio of 59.8% the report gives', () => {
  const y = HISTORY[4];
  near((y.operatingIncome / y.revenue) * 100, 40.17, 0.01);
  near(
    100 - (y.operatingIncome / y.revenue) * 100,
    UP.operatingRatio2025,
    0.05,
  );
});

test('2025 free cash flow at a 24.1% tax rate is about 5,786 million', () => {
  const h = historicalFcf(HISTORY[4], DCF_BASE.taxRate);
  near(h.workingCapitalInvestment, 361, 1e-9);
  near(h.fcf, 5_786.1, 0.1);
});

test('five years of net investment are 16.6% of after-tax operating income', () => {
  const rows = HISTORY.map((h) => historicalFcf(h, DCF_BASE.taxRate));
  const share =
    (rows.reduce((a, r) => a + r.reinvestment, 0) /
      rows.reduce((a, r) => a + r.nopat, 0)) *
    100;
  near(share, 16.6, 0.05);
  assert.equal(REINVESTMENT_SHARE, 16.6);
});

test('revenue grew about 3% a year from 2021 to 2025', () => {
  const cagr = ((HISTORY[4].revenue / HISTORY[0].revenue) ** (1 / 4) - 1) * 100;
  near(cagr, 2.97, 0.01);
});

test('net debt is the fair value of debt less cash and short-term investments', () => {
  assert.equal(
    NET_DEBT,
    UP.fairValueOfDebt - UP.cash - UP.shortTermInvestments,
  );
  assert.equal(NET_DEBT, 24_984);
});

test('the base case discounts at the 7.57% from the cost of capital case', () => {
  assert.equal(DCF_BASE.wacc, 7.57);
  assert.equal(DCF_BASE.revenue, HISTORY[4].revenue);
  near(DCF_BASE.shares, UP.sharesOutstanding / 1e6, 1e-9);
});

test('the base case is worth less than the price, and the price implies about 3.8% growth', () => {
  const r = dcf(DCF_BASE);
  assert.ok(r.perShare > 185 && r.perShare < 200, String(r.perShare));
  near(impliedLongRunGrowth(DCF_BASE, UP.sharePrice), 3.8, 0.05);
  // The terminal value is most of the enterprise value.
  assert.ok(r.pvTerminal / r.enterpriseValue > 0.75);
});

test('each range is ordered, peaks at the base case, and keeps growth below the WACC', () => {
  for (const [key, t] of Object.entries(DCF_RANGES)) {
    assert.ok(t.low <= t.mode && t.mode <= t.high, key);
    assert.equal(t.mode, DCF_BASE[key as keyof typeof DCF_RANGES], key);
  }
  assert.ok(DCF_RANGES.longRunGrowth.high < DCF_BASE.wacc);
});
