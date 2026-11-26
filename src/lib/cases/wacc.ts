// Weighted average cost of capital for the Union Pacific case study. Pure
// and alias-free, so `node --test` can import it. Rates are in percent.

export interface WaccInputs {
  /** Risk-free rate. */
  riskFree: number;
  /** Equity risk premium: expected market return minus the risk-free rate. */
  premium: number;
  beta: number;
  /** Cost of debt before tax. */
  costOfDebt: number;
  taxRate: number;
  /** Debt as a percent of firm value, D / (D + E). */
  debtShare: number;
}

export interface WaccResult {
  /** CAPM: riskFree + beta x premium. */
  costOfEquity: number;
  afterTaxCostOfDebt: number;
  /** Equity's share of value times the cost of equity. */
  equityPart: number;
  /** Debt's share of value times the after-tax cost of debt. */
  debtPart: number;
  wacc: number;
}

export function wacc(i: WaccInputs): WaccResult {
  const costOfEquity = i.riskFree + i.beta * i.premium;
  const afterTaxCostOfDebt = i.costOfDebt * (1 - i.taxRate / 100);
  const equityPart = (1 - i.debtShare / 100) * costOfEquity;
  const debtPart = (i.debtShare / 100) * afterTaxCostOfDebt;
  return {
    costOfEquity,
    afterTaxCostOfDebt,
    equityPart,
    debtPart,
    wacc: equityPart + debtPart,
  };
}

export type InputRanges = Record<keyof WaccInputs, [low: number, high: number]>;

export interface Swing {
  key: keyof WaccInputs;
  low: number;
  high: number;
  waccAtLow: number;
  waccAtHigh: number;
  /** Distance between the two WACCs, in percentage points. */
  swing: number;
}

/**
 * How far the WACC moves when one input goes from the low end of its range
 * to the high end and the others stay at `base`. Largest swing first; ties
 * keep the order of the inputs.
 */
export function sensitivity(base: WaccInputs, ranges: InputRanges): Swing[] {
  return (Object.keys(base) as (keyof WaccInputs)[])
    .map((key) => {
      const [low, high] = ranges[key];
      const waccAtLow = wacc({ ...base, [key]: low }).wacc;
      const waccAtHigh = wacc({ ...base, [key]: high }).wacc;
      return {
        key,
        low,
        high,
        waccAtLow,
        waccAtHigh,
        swing: Math.abs(waccAtHigh - waccAtLow),
      };
    })
    .sort((a, b) => b.swing - a.swing);
}

/**
 * The lesson's re-levering step: an unlevered beta at a firm's own debt-to-
 * equity ratio (a plain ratio, not a percent) and tax rate (percent).
 * beta_L = beta_U x [1 + (1 - t) x D/E].
 */
export function relever(
  unleveredBeta: number,
  taxRate: number,
  debtToEquity: number,
): number {
  return unleveredBeta * (1 + (1 - taxRate / 100) * debtToEquity);
}

/** Present value of `cashFlow` a year forever at `rate` percent. */
export function perpetuityValue(cashFlow: number, rate: number): number {
  return cashFlow / (rate / 100);
}
