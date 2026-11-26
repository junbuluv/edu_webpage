// Pure calculations for the yield curve case study. Alias-free so
// `node --test` and scripts/cases/yield-curve-data.ts can import it.

export interface YieldCurveData {
  source: string;
  sourceUrl: string;
  /** FRED series ids, in column order, then the recession series. */
  series: string[];
  /** Maturity of each column, in years. */
  maturities: number[];
  /** Month of row 0, as YYYY-MM. */
  start: string;
  /** Month-end yields in percent, one row per month. null = not quoted. */
  yields: (number | null)[][];
  /** 1 when the month falls in a US recession (NBER dates), else 0. */
  recession: number[];
}

/** Column of each maturity in a row of `yields`. */
export const TENOR = { m3: 0, y1: 1, y2: 2, y5: 3, y10: 4, y30: 5 } as const;

export interface DatedRow {
  date: string;
  values: (number | null)[];
}

/** Rows of a FRED graph CSV. A blank or "." cell is a missing value. */
export function parseFredCsv(text: string): DatedRow[] {
  return text
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => {
      const [date, ...cells] = line.split(',');
      return {
        date,
        values: cells.map((c) => (c === '' || c === '.' ? null : Number(c))),
      };
    });
}

/** YYYY-MM of the month `index` months after `start`. */
export function monthAt(start: string, index: number): string {
  const [y, m] = start.split('-').map(Number);
  const n = y * 12 + (m - 1) + index;
  return `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, '0')}`;
}

/** Row index of `month` (YYYY-MM) when row 0 is `start`. */
export function monthIndex(start: string, month: string): number {
  const [y0, m0] = start.split('-').map(Number);
  const [y, m] = month.split('-').map(Number);
  return (y - y0) * 12 + (m - m0);
}

/**
 * One row per month from `from` through `through` (YYYY-MM, inclusive): each
 * series' last quoted value in that month. A month with no quote is null.
 */
export function monthEndRows(
  rows: DatedRow[],
  from: string,
  through: string,
): (number | null)[][] {
  const width = rows[0]?.values.length ?? 0;
  const byMonth = new Map<string, (number | null)[]>();
  for (const row of rows) {
    const month = row.date.slice(0, 7);
    const last = byMonth.get(month) ?? new Array(width).fill(null);
    row.values.forEach((v, i) => {
      if (v !== null) last[i] = v;
    });
    byMonth.set(month, last);
  }
  const out: (number | null)[][] = [];
  for (let i = 0; monthAt(from, i) <= through; i++) {
    out.push(byMonth.get(monthAt(from, i)) ?? new Array(width).fill(null));
  }
  return out;
}

/** Long yield minus short yield, in percentage points. */
export function spread(
  row: (number | null)[],
  long: number,
  short: number,
): number | null {
  const a = row[long];
  const b = row[short];
  return a === null || b === null ? null : a - b;
}

/**
 * The 1-year rate one year ahead that makes two 1-year loans in a row pay
 * the same as one 2-year loan: (1 + y2)^2 / (1 + y1) - 1. Percent in and out.
 */
export function impliedForward(y1: number, y2: number): number {
  return ((1 + y2 / 100) ** 2 / (1 + y1 / 100) - 1) * 100;
}

/** [first, last] index of each unbroken stretch of truthy flags. */
export function runs(flags: (boolean | number)[]): [number, number][] {
  const out: [number, number][] = [];
  flags.forEach((flag, i) => {
    if (!flag) return;
    const last = out[out.length - 1];
    if (last && last[1] === i - 1) last[1] = i;
    else out.push([i, i]);
  });
  return out;
}

/** [first, last] row index of each unbroken run of months with long < short. */
export function inversionSpells(
  rows: (number | null)[][],
  long: number,
  short: number,
): [number, number][] {
  return runs(rows.map((row) => (spread(row, long, short) ?? 0) < 0));
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "2023-07" as "July 2023". No Intl, so server and browser always agree. */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/**
 * The forecast in month `index`'s curve and what happened: the 1-year rate
 * one year ahead implied by that month's 1- and 2-year yields, and the 1-year
 * yield actually quoted twelve months later (null if not yet known).
 */
export function forwardCheck(
  rows: (number | null)[][],
  index: number,
): { implied: number; realized: number | null } {
  const row = rows[index];
  return {
    implied: impliedForward(row[TENOR.y1] ?? NaN, row[TENOR.y2] ?? NaN),
    realized: rows[index + 12]?.[TENOR.y1] ?? null,
  };
}
