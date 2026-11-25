import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  FUND,
  FUND_YEARS,
  accounts,
  compoundReturn,
  fundIrr,
  lastVintage,
  marketReturnsFor,
  pme,
  tvpi,
  type MarketData,
} from './pme.ts';

const near = (a: number, b: number, tol = 1e-9) =>
  assert.ok(Math.abs(a - b) < tol, `${a} is not within ${tol} of ${b}`);

const flat = (r: number) => new Array(FUND_YEARS).fill(r);

test('the made-up fund calls 100 over four years and pays out over seven', () => {
  assert.equal(FUND.calls.length, FUND_YEARS);
  assert.equal(FUND.distributions.length, FUND_YEARS);
  assert.equal(
    FUND.calls.reduce((a, b) => a + b, 0),
    100,
  );
  assert.deepEqual(
    FUND.calls.map((c) => c > 0),
    [true, true, true, true, false, false, false, false, false, false],
  );
  assert.equal(
    FUND.distributions.slice(0, 3).reduce((a, b) => a + b, 0),
    0,
  );
});

test('TVPI is total paid out over total paid in, and scales with the payouts', () => {
  const paidOut = FUND.distributions.reduce((a, b) => a + b, 0);
  near(tvpi(FUND, 1), paidOut / 100);
  near(tvpi(FUND, 1.5), (1.5 * paidOut) / 100);
});

test('IRR depends on the cash flows alone, and rises with the payouts', () => {
  const irr = fundIrr(FUND, 1);
  assert.ok(irr > 10 && irr < 20, String(irr));
  assert.ok(fundIrr(FUND, 1.2) > irr);
});

test('with no market return, the PME equals the TVPI', () => {
  near(pme(FUND, 1, flat(0)), tvpi(FUND, 1));
});

test('if the market earns exactly the fund IRR every year, the PME is 1', () => {
  near(pme(FUND, 1, flat(fundIrr(FUND, 1))), 1, 1e-6);
});

test('a market that beats the fund IRR gives a PME below 1, and the reverse', () => {
  const irr = fundIrr(FUND, 1);
  assert.ok(pme(FUND, 1, flat(irr + 3)) < 1);
  assert.ok(pme(FUND, 1, flat(irr - 3)) > 1);
});

test('one pay-in and one payout: payout over pay-in, each in market dollars', () => {
  // 100 in at the end of year 1, 200 out at the end of year 10; the market
  // grows 2.5 times in between, so 100 in the market would be 250.
  const one = {
    calls: [100, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    distributions: [0, 0, 0, 0, 0, 0, 0, 0, 0, 200],
  };
  const growth = 2.5 ** (1 / 9) - 1;
  const returns = [0, ...new Array(9).fill(growth * 100)];
  near(pme(one, 1, returns), 0.8, 1e-9);
});

test('the accounts grow at the market and take each flow at year end', () => {
  const returns = [50, 10, 10, 10, 10, 10, 10, 10, 10, 10];
  const a = accounts(FUND, 1, returns);
  // The first year's return applies to nothing: money arrives at its end.
  near(a[0].payIn, FUND.calls[0]);
  near(a[1].payIn, FUND.calls[0] * 1.1 + FUND.calls[1]);
  near(a[3].payOut, FUND.distributions[3]);
  near(a[9].payOut / a[9].payIn, pme(FUND, 1, returns));
});

test('the market return over the fund life compounds years 2 to 10', () => {
  const r = [99, 10, 10, 10, 10, 10, 10, 10, 10, 10];
  near(compoundReturn(r), 10);
});

// The committed data file, built by scripts/cases/market-annual-data.ts.
const data = JSON.parse(
  readFileSync(new URL('./market-annual.json', import.meta.url), 'utf8'),
) as MarketData;

test('the data file covers 1927 to 2025 and gives market and bill returns', () => {
  assert.equal(data.start, 1927);
  assert.equal(data.market.length, 99);
  assert.equal(data.riskFree.length, data.market.length);
  assert.match(data.copyright, /Fama and Kenneth R\. French/);
  // 2022: Mkt-RF -21.32 plus RF 1.42.
  near(data.market[2022 - data.start], -19.9);
  near(data.market[2025 - data.start], 17.55);
  assert.ok(data.market.every((r) => r > -50 && r < 60));
});

test('a vintage takes the ten calendar years from its first year', () => {
  const r = marketReturnsFor(data, 2000);
  assert.equal(r.length, FUND_YEARS);
  near(r[0], data.market[2000 - data.start]);
  near(r[9], data.market[2009 - data.start]);
  assert.equal(lastVintage(data), 2016);
  assert.throws(() => marketReturnsFor(data, 2017), RangeError);
});
