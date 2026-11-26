// The beta case: how much one estimate of beta depends on which months of
// returns go into it. Monthly excess returns (percent) for two industry
// portfolios and the market, from the factor regressions lesson's data file.
// Pure and alias-free, so `node --test` can import it.
import { ols } from '../factors/ols.ts';
import { mulberry32 } from './random.ts';

/** Months in one estimation window: five years, a common choice. */
export const WINDOW = 60;

export const INDUSTRIES = ['utilities', 'high-tech'] as const;
export type Industry = (typeof INDUSTRIES)[number];

export interface BetaData {
  /** First month, YYYY-MM. */
  start: string;
  source: string;
  sourceUrl: string;
  copyright: string;
  /** The market's return over the Treasury bill rate, each month. */
  market: number[];
  /** Each industry's return over the Treasury bill rate, each month. */
  returns: Record<Industry, number[]>;
}

/** The parts of src/lib/factors/regressions.json this case reads. */
interface RegressionsFile {
  source: string;
  sourceUrl: string;
  copyright: string;
  sample: { start: string };
  models: { id: string; market: number[] }[];
  portfolios: { id: string; models: { capm: { y: number[] } } }[];
}

export function betaDataFrom(raw: RegressionsFile): BetaData {
  const capm = raw.models.find((m) => m.id === 'capm');
  if (!capm) throw new Error('beta data: no CAPM model in the file');
  const series = (id: Industry) => {
    const p = raw.portfolios.find((q) => q.id === id);
    if (!p) throw new Error(`beta data: no ${id} portfolio in the file`);
    return p.models.capm.y;
  };
  return {
    start: raw.sample.start,
    source: raw.source,
    sourceUrl: raw.sourceUrl,
    copyright: raw.copyright,
    market: capm.market,
    returns: {
      utilities: series('utilities'),
      'high-tech': series('high-tech'),
    },
  };
}

const toMonths = (label: string) => {
  const [y, m] = label.split('-').map(Number);
  return y * 12 + (m - 1);
};

/** YYYY-MM of the month `index` months after `start`. */
export function monthLabel(start: string, index: number): string {
  const t = toMonths(start) + index;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}

/** Position of month `label` (YYYY-MM) in data that begins at `start`. */
export function monthIndex(start: string, label: string): number {
  return toMonths(label) - toMonths(start);
}

export interface WindowBeta {
  beta: number;
  /** Standard error of beta. */
  se: number;
  alpha: number;
  r2: number;
}

/** Regress y on x over the `length` months that end at month `end`. */
export function windowBeta(
  y: number[],
  x: number[],
  end: number,
  length = WINDOW,
): WindowBeta {
  const from = end - length + 1;
  if (from < 0 || end >= x.length) {
    throw new RangeError(`no ${length}-month window ends at month ${end}`);
  }
  const r = ols(y.slice(from, end + 1), [x.slice(from, end + 1)]);
  return { beta: r.coef[1], se: r.se[1], alpha: r.coef[0], r2: r.r2 };
}

/** Beta for every window; entry i is the window that ends at month i + length - 1. */
export function rollingBetas(y: number[], x: number[], length = WINDOW) {
  const out: number[] = [];
  for (let end = length - 1; end < x.length; end += 1) {
    out.push(windowBeta(y, x, end, length).beta);
  }
  return out;
}

/**
 * `draws` betas, each from `length` months picked at random, with
 * replacement, from the whole history. The spread shows how far an estimate
 * from that many months can land from the full-history beta by chance alone.
 */
export function sampleBetas(
  y: number[],
  x: number[],
  draws: number,
  seed: number,
  length = WINDOW,
): number[] {
  const rand = mulberry32(seed);
  const out: number[] = [];
  for (let d = 0; d < draws; d += 1) {
    const ys: number[] = [];
    const xs: number[] = [];
    for (let k = 0; k < length; k += 1) {
      const i = Math.floor(rand() * x.length);
      ys.push(y[i]);
      xs.push(x[i]);
    }
    out.push(ols(ys, [xs]).coef[1]);
  }
  return out;
}

/** CAPM cost of equity, in percent: risk-free rate + beta x premium. */
export function costOfEquity(riskFree: number, premium: number, beta: number) {
  return riskFree + beta * premium;
}
