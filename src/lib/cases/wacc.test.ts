import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  perpetuityValue,
  relever,
  sensitivity,
  wacc,
  type InputRanges,
  type WaccInputs,
} from './wacc.ts';
import {
  ESTIMATE,
  MARKET,
  RANGES,
  UNION_PACIFIC as UP,
} from './union-pacific.ts';

const near = (a: number, b: number, tol = 1e-9) =>
  assert.ok(Math.abs(a - b) < tol, `${a} is not within ${tol} of ${b}`);

// The worked example in the cost of capital lesson.
const LESSON: WaccInputs = {
  riskFree: 4.2,
  premium: 5.5,
  beta: 1.1,
  costOfDebt: 6.0,
  taxRate: 25,
  debtShare: 30,
};

test('the lesson example gives a 10.25% cost of equity and an 8.53% WACC', () => {
  const r = wacc(LESSON);
  near(r.costOfEquity, 10.25);
  near(r.afterTaxCostOfDebt, 4.5);
  near(r.wacc, 8.525);
});

test('the equity part and the debt part add up to the WACC', () => {
  const r = wacc(LESSON);
  near(r.equityPart, 7.175);
  near(r.debtPart, 1.35);
  near(r.equityPart + r.debtPart, r.wacc);
});

test('a firm with no debt has a WACC equal to its cost of equity', () => {
  const r = wacc({ ...LESSON, debtShare: 0 });
  near(r.wacc, r.costOfEquity);
  near(r.debtPart, 0);
});

test('sensitivity moves one input at a time and ranks by the swing', () => {
  const ranges: InputRanges = {
    riskFree: [4.2, 4.2],
    premium: [4.5, 6.5],
    beta: [1.0, 1.2],
    costOfDebt: [6.0, 6.0],
    taxRate: [25, 25],
    debtShare: [30, 30],
  };
  const s = sensitivity(LESSON, ranges);
  assert.deepEqual(
    s.map((x) => x.key),
    ['premium', 'beta', 'riskFree', 'costOfDebt', 'taxRate', 'debtShare'],
  );
  // premium: 0.70 x 1.1 x (6.5 - 4.5) = 1.54 points
  near(s[0].swing, 1.54);
  near(s[0].waccAtLow, wacc({ ...LESSON, premium: 4.5 }).wacc);
  near(s[0].waccAtHigh, wacc({ ...LESSON, premium: 6.5 }).wacc);
  // beta: 0.70 x 5.5 x (1.2 - 1.0) = 0.77 points
  near(s[1].swing, 0.77);
  near(s[2].swing, 0);
});

test('a level cash flow forever is worth the cash flow over the rate', () => {
  near(perpetuityValue(100, 8), 1250);
  near(perpetuityValue(100, 10), 1000);
});

test('re-levering applies the lesson formula, and no debt leaves beta alone', () => {
  // beta_L = beta_U x [1 + (1 - t) x D/E]
  near(relever(0.8, 25, 0.5), 0.8 * (1 + 0.75 * 0.5));
  near(relever(0.8, 25, 0), 0.8);
  assert.ok(relever(0.8, 25, 1) > relever(0.8, 25, 0.5));
});

// Union Pacific: the numbers copied from the 10-K must agree with each other.

test('book debt is the two balance-sheet lines, about 5.3 billion above fair value', () => {
  assert.equal(UP.debtDueWithinOneYear + UP.debtDueAfterOneYear, UP.bookDebt);
  assert.equal(UP.bookDebt, 31_814);
  near(UP.bookDebt - UP.fairValueOfDebt, 5_300, 60);
});

test('market value of equity is shares times the closing price', () => {
  near(
    UP.marketValueOfEquity,
    (UP.sharesOutstanding * UP.sharePrice) / 1e6,
    0.5,
  );
  near(UP.marketValueOfEquity, 139_506, 1);
});

test('the reported tax and interest rates follow from the reported amounts', () => {
  near(
    (UP.incomeTaxExpense / UP.incomeBeforeTaxes) * 100,
    UP.effectiveTaxRate,
    0.05,
  );
  near(
    (UP.interestExpense / UP.averageDebt) * 100,
    UP.effectiveInterestRate,
    0.05,
  );
  near(UP.federalTaxRate + UP.stateTaxRate, ESTIMATE.taxRate);
});

test('the case beta is the railroad unlevered beta re-levered at the firm’s own debt', () => {
  const debtToEquity = UP.fairValueOfDebt / UP.marketValueOfEquity;
  near(debtToEquity, 0.19, 0.001);
  near(
    ESTIMATE.beta,
    relever(MARKET.railroadUnleveredBeta, ESTIMATE.taxRate, debtToEquity),
    0.005,
  );
  assert.equal(ESTIMATE.beta, 0.93);
});

test('the case estimate uses market-value weights and gives a WACC near 7.6%', () => {
  const v = UP.marketValueOfEquity + UP.fairValueOfDebt;
  near(ESTIMATE.debtShare, (UP.fairValueOfDebt / v) * 100, 0.05);
  const r = wacc(ESTIMATE);
  near(r.costOfEquity, 4.26 + 0.93 * 4.23);
  assert.ok(r.wacc > 7.5 && r.wacc < 7.65, String(r.wacc));
});

test('every estimate lies inside its range, and the premium matters most', () => {
  for (const key of Object.keys(ESTIMATE) as (keyof WaccInputs)[]) {
    const [low, high] = RANGES[key];
    assert.ok(low <= ESTIMATE[key] && ESTIMATE[key] <= high, key);
  }
  // Both ends of the cost of debt range are yields on new borrowing.
  assert.deepEqual(RANGES.costOfDebt, [MARKET.aaaYield, MARKET.baaYield]);
  const s = sensitivity(ESTIMATE, RANGES);
  assert.equal(s[0].key, 'premium');
  assert.equal(s[s.length - 1].key, 'taxRate');
});
