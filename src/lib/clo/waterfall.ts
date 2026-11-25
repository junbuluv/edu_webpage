// Pure math for the CLO lesson and its chart. Alias-free so `node --test` can
// load it. Tranche sizes, losses, and note sizes share one unit of the caller's
// choice (a fraction of the pool, percent of the pool, or dollars).

export interface Tranche {
  name: string;
  /** Principal of the tranche. */
  size: number;
}

export interface TrancheResult extends Tranche {
  lost: number;
  intact: number;
}

/** Share of the loan pool lost: defaults times the part not recovered. */
export function poolLoss(defaultRate: number, recoveryRate: number): number {
  return defaultRate * (1 - recoveryRate);
}

/**
 * Charge a pool loss to tranches from the bottom up. `tranches` are listed
 * senior first, so the last one (equity) absorbs losses first and each tranche
 * is hit only after every tranche below it is wiped out.
 */
export function allocateLosses(
  tranches: Tranche[],
  loss: number,
): TrancheResult[] {
  let remaining = Math.max(0, loss);
  return [...tranches]
    .reverse()
    .map((t) => {
      const lost = Math.min(t.size, remaining);
      remaining -= lost;
      return { ...t, lost, intact: t.size - lost };
    })
    .reverse();
}

export interface Note {
  /** Principal of the note class. */
  size: number;
  /** Annual interest rate as a fraction. */
  rate: number;
}

/**
 * One year of interest left for the equity tranche before any loan losses:
 * loan interest, minus fees charged on the pool, minus interest on the notes.
 */
export function residualInterest(
  poolPar: number,
  loanRate: number,
  notes: Note[],
  feeRate = 0,
): number {
  const noteInterest = notes.reduce((sum, n) => sum + n.size * n.rate, 0);
  return poolPar * (loanRate - feeRate) - noteInterest;
}

/**
 * The funding mix the lesson and chart use, in percent of the pool, senior
 * first. Illustrative, not a real deal; see the lesson for how it compares
 * with reported averages.
 */
export const ILLUSTRATIVE_TRANCHES: Tranche[] = [
  { name: 'AAA', size: 62 },
  { name: 'AA', size: 12 },
  { name: 'A', size: 6 },
  { name: 'BBB', size: 6 },
  { name: 'BB', size: 5 },
  { name: 'Equity', size: 9 },
];
