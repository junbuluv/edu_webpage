// Union Pacific Corporation: numbers copied by hand from its annual report
// (Form 10-K) for fiscal year 2025, filed 6 February 2026, and the market
// inputs the cost of capital case pairs with them. Dollar amounts are in
// millions; rates are in percent. Each group names where it was read.
import type { InputRanges, WaccInputs } from './wacc.ts';

export const FILING_URL =
  'https://www.sec.gov/Archives/edgar/data/100885/000010088526000037/unp-20251231.htm';

export const UNION_PACIFIC = {
  // Item 5: "At January 30, 2026, there were 593,391,460 shares of common
  // stock outstanding ... the closing price of the common stock on the NYSE
  // was $235.10."
  sharesOutstanding: 593_391_460,
  sharePrice: 235.1,
  marketValueOfEquity: 139_506, // shares x price

  // Consolidated Statements of Financial Position, 31 December 2025.
  debtDueWithinOneYear: 1_520,
  debtDueAfterOneYear: 30_294,
  bookDebt: 31_814,
  bookEquity: 18_467, // total common shareholders' equity

  // Fair value note: "At December 31, 2025, the fair value of total debt was
  // $26.5 billion, approximately $5.3 billion less than the carrying value."
  fairValueOfDebt: 26_500,

  // Consolidated Statements of Income, 2025.
  interestExpense: 1_309,
  incomeBeforeTaxes: 9_166,
  incomeTaxExpense: 2_028,

  // Item 7: "weighted-average debt level of $32.1 billion in 2025" and "the
  // effective interest rate of 4.1% in 2025".
  averageDebt: 32_100,
  effectiveInterestRate: 4.1,

  // Income tax note: effective rate 22.1%; federal 21.0%; "The state
  // statutory rate, net of federal benefits, was 3.1%".
  effectiveTaxRate: 22.1,
  federalTaxRate: 21.0,
  stateTaxRate: 3.1,
} as const;

export const MARKET = {
  // FRED, daily Treasury yields: DGS10 on 31 December 2025 and on 30 January
  // 2026, and DGS30 on 30 January 2026.
  tenYearAtYearEnd: 4.18,
  tenYear: 4.26,
  thirtyYear: 4.87,

  // FRED, Moody's seasoned corporate bond yields for January 2026 (series
  // AAA and BAA; bonds with 20 or more years to maturity).
  aaaYield: 5.34,
  baaYield: 5.88,

  // Aswath Damodaran, "Betas by Sector (US)", data as of January 2026:
  // Transportation (Railroads), 4 firms: beta 0.98, D/E 27.79%. All of
  // Transportation, 19 firms: beta 0.86.
  railroadBeta: 0.98,
  railroadDebtToEquity: 27.79,
  transportationBeta: 0.86,

  // Damodaran, "Historical Implied Equity Risk Premiums", January 2026: the
  // implied premium at the end of 2025. And the 1928-2025 arithmetic average
  // of the S&P 500 return minus the 10-year Treasury bond return, computed
  // from his "Historical Returns on Stocks, Bonds and Bills" table (11.86%
  // minus 4.82%).
  impliedPremium: 4.23,
  historicalPremium: 7.03,
} as const;

const UP = UNION_PACIFIC;
const round2 = (x: number) => Math.round(x * 100) / 100;

/** Debt at fair value over debt at fair value plus equity at market value. */
export const MARKET_DEBT_SHARE = round2(
  (UP.fairValueOfDebt / (UP.fairValueOfDebt + UP.marketValueOfEquity)) * 100,
);
/** The same ratio from the balance sheet: what the case warns against. */
export const BOOK_DEBT_SHARE = round2(
  (UP.bookDebt / (UP.bookDebt + UP.bookEquity)) * 100,
);
/** The railroad industry's debt share, from Damodaran's D/E of 27.79%. */
export const INDUSTRY_DEBT_SHARE = round2(
  (MARKET.railroadDebtToEquity / (100 + MARKET.railroadDebtToEquity)) * 100,
);

/** The case's own estimate, as of 30 January 2026. */
export const ESTIMATE: WaccInputs = {
  riskFree: MARKET.tenYear,
  premium: MARKET.impliedPremium,
  beta: MARKET.railroadBeta,
  // Investment grade (the 10-K lists a fall "below investment grade" as a
  // risk): halfway between the Aaa and Baa yields.
  costOfDebt: round2((MARKET.aaaYield + MARKET.baaYield) / 2),
  // The rate on the next dollar of income: federal plus state.
  taxRate: round2(UP.federalTaxRate + UP.stateTaxRate),
  debtShare: MARKET_DEBT_SHARE,
};

/**
 * What a reasonable analyst might use instead, one input at a time. Only the
 * top of the beta range is an assumption: it sits as far above the railroad
 * beta as the all-Transportation beta sits below it.
 */
export const RANGES: InputRanges = {
  riskFree: [MARKET.tenYearAtYearEnd, MARKET.thirtyYear],
  premium: [MARKET.impliedPremium, MARKET.historicalPremium],
  beta: [
    MARKET.transportationBeta,
    round2(2 * MARKET.railroadBeta - MARKET.transportationBeta),
  ],
  costOfDebt: [UP.effectiveInterestRate, MARKET.baaYield],
  taxRate: [UP.federalTaxRate, round2(UP.federalTaxRate + UP.stateTaxRate)],
  debtShare: [MARKET_DEBT_SHARE, INDUSTRY_DEBT_SHARE],
};
