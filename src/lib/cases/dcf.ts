// Discounted free cash flow for the Union Pacific valuation case. Pure and
// alias-free, so `node --test` can import it. Rates are in percent; amounts
// in millions of dollars, shares in millions.
import { mulberry32, triangular } from './random.ts';

export const FORECAST_YEARS = 5;

export interface DcfInputs {
  /** Revenue in the last reported year. */
  revenue: number;
  /** Revenue growth per year in each of the forecast years. */
  revenueGrowth: number;
  /** Operating income over revenue. */
  operatingMargin: number;
  taxRate: number;
  /** Share of after-tax operating income spent on net investment. */
  reinvestmentShare: number;
  wacc: number;
  /** Growth of free cash flow every year after the forecast. */
  longRunGrowth: number;
  /** Debt less cash, at the valuation date. */
  netDebt: number;
  shares: number;
}

export interface DcfYear {
  year: number;
  revenue: number;
  fcf: number;
  /** Present value at the valuation date. */
  pv: number;
}

export interface DcfResult {
  years: DcfYear[];
  pvForecast: number;
  /** Value at the end of the forecast of every later cash flow. */
  terminalValue: number;
  pvTerminal: number;
  enterpriseValue: number;
  equityValue: number;
  perShare: number;
}

export function dcf(i: DcfInputs): DcfResult {
  const r = i.wacc / 100;
  const g = i.longRunGrowth / 100;
  if (g >= r) {
    throw new RangeError('long-run growth must stay below the WACC');
  }
  const cashShare =
    (i.operatingMargin / 100) *
    (1 - i.taxRate / 100) *
    (1 - i.reinvestmentShare / 100);

  const years: DcfYear[] = [];
  let revenue = i.revenue;
  for (let t = 1; t <= FORECAST_YEARS; t++) {
    revenue *= 1 + i.revenueGrowth / 100;
    const fcf = revenue * cashShare;
    years.push({ year: t, revenue, fcf, pv: fcf / (1 + r) ** t });
  }
  const pvForecast = years.reduce((sum, y) => sum + y.pv, 0);
  const terminalValue = (years[FORECAST_YEARS - 1].fcf * (1 + g)) / (r - g);
  const pvTerminal = terminalValue / (1 + r) ** FORECAST_YEARS;
  const enterpriseValue = pvForecast + pvTerminal;
  const equityValue = enterpriseValue - i.netDebt;
  return {
    years,
    pvForecast,
    terminalValue,
    pvTerminal,
    enterpriseValue,
    equityValue,
    perShare: equityValue / i.shares,
  };
}

/**
 * The long-run growth rate at which the value per share equals `price`, the
 * other inputs held fixed. Value rises with growth, so bisection finds it.
 */
export function impliedLongRunGrowth(i: DcfInputs, price: number): number {
  let lo = -10;
  let hi = i.wacc - 1e-6;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (dcf({ ...i, longRunGrowth: mid }).perShare < price) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface StatementYear {
  operatingIncome: number;
  depreciation: number;
  capitalInvestments: number;
  /**
   * "Changes in current assets and liabilities" as the cash flow statement
   * prints them: a positive number added cash.
   */
  currentItems: number[];
}

/** The lesson's FCF = NOPAT + depreciation - change in working capital - CapEx. */
export function historicalFcf(y: StatementYear, taxRate: number) {
  const nopat = y.operatingIncome * (1 - taxRate / 100);
  const workingCapitalInvestment = -y.currentItems.reduce((a, b) => a + b, 0);
  const reinvestment =
    y.capitalInvestments - y.depreciation + workingCapitalInvestment;
  return {
    nopat,
    workingCapitalInvestment,
    reinvestment,
    fcf: nopat - reinvestment,
  };
}

export interface Triangle {
  low: number;
  mode: number;
  high: number;
}

export interface DcfRanges {
  revenueGrowth: Triangle;
  operatingMargin: Triangle;
  longRunGrowth: Triangle;
}

/**
 * `draws` values per share, each from one random revenue growth, operating
 * margin and long-run growth (independent triangular draws). The other inputs
 * stay at `base`. The same `seed` gives the same draws.
 */
export function simulate(
  base: DcfInputs,
  ranges: DcfRanges,
  draws: number,
  seed: number,
): number[] {
  const next = mulberry32(seed);
  const draw = (t: Triangle) => triangular(next(), t.low, t.mode, t.high);
  const out: number[] = [];
  for (let k = 0; k < draws; k++) {
    out.push(
      dcf({
        ...base,
        revenueGrowth: draw(ranges.revenueGrowth),
        operatingMargin: draw(ranges.operatingMargin),
        longRunGrowth: draw(ranges.longRunGrowth),
      }).perShare,
    );
  }
  return out;
}

/** The p-th percentile (0 to 100) of values sorted from low to high. */
export function percentile(sorted: number[], p: number): number {
  const at = (p / 100) * (sorted.length - 1);
  const below = Math.floor(at);
  const above = Math.min(below + 1, sorted.length - 1);
  return sorted[below] + (at - below) * (sorted[above] - sorted[below]);
}

/** Counts of values in bins [from, from + width), from the lowest bin used. */
export function bins(values: number[], width: number) {
  // Bins are keyed by whole-number index; stepping `from += width` drifts
  // for a fractional width and can skip the top bin.
  const counts = new Map<number, number>();
  for (const v of values) {
    const k = Math.floor(v / width);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const ks = [...counts.keys()];
  const out: { from: number; to: number; count: number }[] = [];
  for (let k = Math.min(...ks); k <= Math.max(...ks); k += 1) {
    out.push({
      from: k * width,
      to: (k + 1) * width,
      count: counts.get(k) ?? 0,
    });
  }
  return out;
}
