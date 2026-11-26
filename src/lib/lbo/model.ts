// A yearly leveraged-buyout model for the Private Equity lesson and its chart.
// Pure and alias-free so `node --test` can run it.
//
// The buyer pays entryMultiple x EBITDA, borrows debtToEbitda x EBITDA and
// puts in the rest as equity. Each year EBITDA grows at a constant rate and a
// fixed share of it is cash available to pay lenders and owners. Interest is
// charged on the opening debt balance and whatever is left repays debt. Once
// the debt is gone, spare cash is paid to the owners that year, so the same
// purchase with no debt pays out every year's cash flow.

export interface LboInputs {
  /** EBITDA in the year before the purchase. */
  ebitda: number;
  /** Purchase price as a multiple of that EBITDA. */
  entryMultiple: number;
  /** Opening debt as a multiple of that EBITDA. */
  debtToEbitda: number;
  /** Annual EBITDA growth, e.g. 0.05. */
  growth: number;
  /** Sale price as a multiple of final-year EBITDA. */
  exitMultiple: number;
  /** Holding period in whole years. */
  years: number;
  /** Annual interest rate on the opening debt balance. */
  interestRate: number;
  /** Cash flow after taxes and investment, before interest, as a share of EBITDA. */
  cashShare: number;
}

export interface LboYear {
  year: number;
  ebitda: number;
  cashFlow: number;
  interest: number;
  /** Debt repaid this year; never negative. */
  paydown: number;
  /** Interest the year's cash flow could not cover; added to the debt. */
  shortfall: number;
  /** Cash paid to the owners this year (only once the debt is repaid). */
  dividend: number;
  /** Closing debt balance. */
  debt: number;
}

export interface LboResult {
  entryValue: number;
  entryDebt: number;
  entryEquity: number;
  schedule: LboYear[];
  exitEbitda: number;
  exitValue: number;
  exitDebt: number;
  /** Sale price minus debt. Negative means the lenders lose that much. */
  exitEquity: number;
  /** Total cash paid to the owners before the sale. */
  dividends: number;
  /** Everything the owners receive: dividends plus exit equity, floored at zero. */
  proceeds: number;
  /** Multiple of invested capital: proceeds over equity put in. */
  moic: number;
  irr: number;
  /** Total unpaid interest over the holding period. */
  shortfall: number;
  /** Three parts that sum to exitEquity + dividends - entryEquity. */
  bridge: { growth: number; multiple: number; paydown: number };
}

/**
 * Internal rate of return of yearly cash flows: one payment out at t = 0,
 * then payments in that are never negative. NPV then falls as the rate
 * rises, so bisection finds the single root.
 */
export function irr(flows: number[]): number {
  if (flows.slice(1).every((f) => f <= 0)) return -1;
  let lo = -0.999;
  let hi = 10;
  for (let k = 0; k < 100; k++) {
    const mid = (lo + hi) / 2;
    const npv = flows.reduce((sum, f, t) => sum + f / (1 + mid) ** t, 0);
    if (npv > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function runLbo(i: LboInputs): LboResult {
  const entryValue = i.entryMultiple * i.ebitda;
  const entryDebt = i.debtToEbitda * i.ebitda;
  const entryEquity = entryValue - entryDebt;
  if (!(entryEquity > 0)) {
    throw new RangeError('debt must be below the purchase price');
  }

  const schedule: LboYear[] = [];
  let ebitda = i.ebitda;
  let debt = entryDebt;
  let dividends = 0;
  let shortfall = 0;
  for (let year = 1; year <= i.years; year++) {
    ebitda *= 1 + i.growth;
    const cashFlow = i.cashShare * ebitda;
    const interest = i.interestRate * debt;
    const afterInterest = Math.max(0, cashFlow - interest);
    const unpaid = Math.max(0, interest - cashFlow);
    const paydown = Math.min(debt, afterInterest);
    const dividend = afterInterest - paydown;
    // shortcut: unpaid interest is added to the debt and the deal carries on,
    // as if the lenders accepted more notes instead of cash. Model a default
    // if a lesson ever needs what happens to the firm after a missed payment.
    debt += unpaid - paydown;
    dividends += dividend;
    shortfall += unpaid;
    schedule.push({
      year,
      ebitda,
      cashFlow,
      interest,
      paydown,
      shortfall: unpaid,
      dividend,
      debt,
    });
  }

  const exitValue = i.exitMultiple * ebitda;
  const exitEquity = exitValue - debt;
  // Limited liability: the owners cannot receive less than zero at the sale.
  const atSale = Math.max(0, exitEquity);
  const proceeds = dividends + atSale;
  const flows = [-entryEquity, ...schedule.map((y) => y.dividend)];
  flows[i.years] += atSale;
  return {
    entryValue,
    entryDebt,
    entryEquity,
    schedule,
    exitEbitda: ebitda,
    exitValue,
    exitDebt: debt,
    exitEquity,
    dividends,
    proceeds,
    moic: proceeds / entryEquity,
    irr: irr(flows),
    shortfall,
    bridge: {
      growth: (ebitda - i.ebitda) * i.entryMultiple,
      multiple: (i.exitMultiple - i.entryMultiple) * ebitda,
      paydown: entryDebt - debt + dividends,
    },
  };
}

/** The same purchase paid for entirely with equity. */
export const unleveredLbo = (i: LboInputs): LboResult =>
  runLbo({ ...i, debtToEbitda: 0 });
