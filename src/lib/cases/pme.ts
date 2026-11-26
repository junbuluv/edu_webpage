// The public market equivalent (PME) case: a made-up buyout fund compared
// with the US stock market over the same years. Pure and alias-free, so
// `node --test` can import it. Rates are in percent per year.
import { irrForCashflows } from '../viz/model-math.ts';

export const FUND_YEARS = 10;

export interface Fund {
  /** Money investors pay in at the end of each fund year. */
  calls: number[];
  /** Money the fund pays out at the end of each fund year. */
  distributions: number[];
}

/**
 * A made-up fund, not a real one: 100 called in four equal parts in years 1
 * to 4, and 190 paid out in years 4 to 10. Amounts are per 100 committed.
 */
export const FUND: Fund = {
  calls: [25, 25, 25, 25, 0, 0, 0, 0, 0, 0],
  distributions: [0, 0, 0, 5, 15, 25, 35, 40, 40, 30],
};

export interface MarketData {
  source: string;
  sourceUrl: string;
  copyright: string;
  dataset: string;
  derivation: string;
  /** Date the source file was downloaded, YYYY-MM-DD. */
  retrieved: string;
  units: string;
  /** Calendar year of the first entry. */
  start: number;
  /** US stock market total return per calendar year. */
  market: number[];
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const scaled = (fund: Fund, scale: number) =>
  fund.distributions.map((d) => d * scale);

/**
 * Total value over paid in. The fund holds nothing after year 10, so total
 * value is everything it paid out.
 */
export function tvpi(fund: Fund, scale: number): number {
  return sum(scaled(fund, scale)) / sum(fund.calls);
}

/** Internal rate of return of the fund's net cash flows, in percent. */
export function fundIrr(fund: Fund, scale: number): number {
  const d = scaled(fund, scale);
  const irr = irrForCashflows(fund.calls.map((c, t) => d[t] - c));
  if (irr === null) throw new RangeError('the cash flows have no IRR');
  return irr * 100;
}

/** The market's return in each of the ten calendar years from `vintage`. */
export function marketReturnsFor(data: MarketData, vintage: number): number[] {
  const first = vintage - data.start;
  if (first < 0 || first + FUND_YEARS > data.market.length) {
    throw new RangeError(`no market data for a ${vintage} fund`);
  }
  return data.market.slice(first, first + FUND_YEARS);
}

/** The latest first year whose ten years are all in the data. */
export function lastVintage(data: MarketData): number {
  return data.start + data.market.length - FUND_YEARS;
}

/**
 * Two market accounts, valued at the end of each fund year: one takes every
 * pay-in, the other every payout, and both earn the market's return. Cash
 * moves at year end, so the first year's return applies to nothing.
 */
export function accounts(fund: Fund, scale: number, returns: number[]) {
  const d = scaled(fund, scale);
  let payIn = 0;
  let payOut = 0;
  return fund.calls.map((c, t) => {
    const growth = t === 0 ? 1 : 1 + returns[t] / 100;
    payIn = payIn * growth + c;
    payOut = payOut * growth + d[t];
    return { year: t + 1, payIn, payOut };
  });
}

/**
 * Kaplan and Schoar's public market equivalent: every payout and every pay-in
 * carried to the end of the fund at the market's actual return, payouts over
 * pay-ins. Above 1, the fund beat the market.
 */
export function pme(fund: Fund, scale: number, returns: number[]): number {
  const last = accounts(fund, scale, returns)[FUND_YEARS - 1];
  return last.payOut / last.payIn;
}

/**
 * How a PME reads. The page prints it to two decimals, so one that prints as
 * 1.00 is a tie rather than a win or a loss.
 */
export function pmeVerdict(ratio: number): 'beat' | 'matched' | 'lost' {
  if (ratio.toFixed(2) === '1.00') return 'matched';
  return ratio > 1 ? 'beat' : 'lost';
}

/** The market's compound return per year over years 2 to 10 of the fund. */
export function compoundReturn(returns: number[]): number {
  const growth = returns.slice(1).reduce((g, r) => g * (1 + r / 100), 1);
  return (growth ** (1 / (returns.length - 1)) - 1) * 100;
}
