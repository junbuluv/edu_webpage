import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bins,
  dcf,
  historicalFcf,
  impliedLongRunGrowth,
  percentile,
  simulate,
  type DcfInputs,
} from './dcf.ts';

const near = (a: number, b: number, tol = 1e-6) =>
  assert.ok(Math.abs(a - b) < tol, `${a} is not within ${tol} of ${b}`);

const BASE: DcfInputs = {
  revenue: 1_000,
  revenueGrowth: 4,
  operatingMargin: 25,
  taxRate: 20,
  reinvestmentShare: 25,
  wacc: 9,
  longRunGrowth: 4,
  netDebt: 300,
  shares: 10,
};

test('free cash flow is revenue x margin x (1 - tax) x (1 - reinvestment share)', () => {
  const r = dcf(BASE);
  assert.equal(r.years.length, 5);
  // year 1: 1,040 x 0.25 x 0.80 x 0.75 = 156
  near(r.years[0].revenue, 1_040);
  near(r.years[0].fcf, 156);
  near(r.years[0].pv, 156 / 1.09);
  near(r.years[4].revenue, 1_000 * 1.04 ** 5);
});

test('equal growth before and after year 5 gives the growing perpetuity', () => {
  const r = dcf(BASE);
  // FCF_1 / (WACC - g) = 156 / 0.05 = 3,120
  near(r.enterpriseValue, 3_120, 1e-6);
  near(r.pvForecast + r.pvTerminal, r.enterpriseValue);
});

test('equity is the firm value less net debt, spread over the shares', () => {
  const r = dcf(BASE);
  near(r.equityValue, 3_120 - 300);
  near(r.perShare, 282);
});

test('the terminal value is year 6 free cash flow over WACC minus g', () => {
  const r = dcf({ ...BASE, longRunGrowth: 2 });
  near(r.terminalValue, (r.years[4].fcf * 1.02) / 0.07);
  near(r.pvTerminal, r.terminalValue / 1.09 ** 5);
});

test('long-run growth at or above the WACC is refused', () => {
  assert.throws(() => dcf({ ...BASE, longRunGrowth: 9 }), RangeError);
});

test('the implied long-run growth reproduces the price it was solved for', () => {
  const target = dcf({ ...BASE, longRunGrowth: 3.2 }).perShare;
  near(impliedLongRunGrowth(BASE, target), 3.2, 1e-6);
});

test('historical free cash flow follows the lesson formula', () => {
  // NOPAT = 400 x 0.8 = 320; FCF = 320 + 50 - 20 - 90 = 260
  const h = historicalFcf(
    {
      operatingIncome: 400,
      depreciation: 50,
      capitalInvestments: 90,
      // As the cash flow statement prints them: -30 + 10 = -20 of cash,
      // which is a 20 investment in working capital.
      currentItems: [-30, 10],
    },
    20,
  );
  near(h.nopat, 320);
  near(h.workingCapitalInvestment, 20);
  near(h.reinvestment, 90 - 50 + 20);
  near(h.fcf, 260);
});

test('percentiles interpolate between sorted values', () => {
  const xs = [10, 20, 30, 40, 50];
  near(percentile(xs, 50), 30);
  near(percentile(xs, 0), 10);
  near(percentile(xs, 100), 50);
  near(percentile(xs, 10), 14);
});

test('bins count each value once, in equal-width bins', () => {
  const b = bins([101, 109, 110, 125, 129.9], 10);
  assert.deepEqual(
    b.map((x) => [x.from, x.count]),
    [
      [100, 2],
      [110, 1],
      [120, 2],
    ],
  );
});

test('a random-draw run is repeatable and collapses to the base when ranges are points', () => {
  const point = {
    revenueGrowth: { low: 4, mode: 4, high: 4 },
    operatingMargin: { low: 25, mode: 25, high: 25 },
    longRunGrowth: { low: 4, mode: 4, high: 4 },
  };
  const flat = simulate(BASE, point, 50, 1);
  assert.equal(flat.length, 50);
  for (const v of flat) near(v, 282, 1e-6);

  const ranges = {
    revenueGrowth: { low: 0, mode: 4, high: 6 },
    operatingMargin: { low: 20, mode: 25, high: 30 },
    longRunGrowth: { low: 2, mode: 3, high: 4 },
  };
  assert.deepEqual(
    simulate(BASE, ranges, 200, 9),
    simulate(BASE, ranges, 200, 9),
  );
  assert.notDeepEqual(
    simulate(BASE, ranges, 200, 9),
    simulate(BASE, ranges, 200, 10),
  );
});
