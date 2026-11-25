// Union Pacific Corporation: numbers copied by hand from its annual report
// (Form 10-K) for fiscal year 2025, filed 6 February 2026, and the market
// inputs the cost of capital case pairs with them. Dollar amounts are in
// millions; rates are in percent. Each group names where it was read.
import { historicalFcf, type DcfInputs, type DcfRanges } from './dcf.ts';
import { relever, wacc, type InputRanges, type WaccInputs } from './wacc.ts';

export const FILING_URL =
  'https://www.sec.gov/Archives/edgar/data/100885/000010088526000037/unp-20251231.htm';
/** The 10-K for fiscal year 2023, filed 9 February 2024: years 2021 and 2022. */
export const FILING_2023_URL =
  'https://www.sec.gov/Archives/edgar/data/100885/000143774924003599/unp20231231_10k.htm';

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
  cash: 1_266, // cash and cash equivalents
  shortTermInvestments: 250,

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

  // Item 7: "our operating ratio improved 10 basis points to 59.8% in 2025",
  // and the non-GAAP table: "Return on invested capital as adjusted" 16.3%.
  operatingRatio2025: 59.8,
  roic2025: 16.3,
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

  // Aswath Damodaran, "Betas by Sector (US)", data as of January 2026. The
  // row Transportation (Railroads), 4 firms: beta 0.98, D/E 27.79%, unlevered
  // beta 0.81. The row Transportation, 19 firms: beta 0.86.
  railroadBeta: 0.98,
  railroadUnleveredBeta: 0.81,
  railroadDebtToEquity: 27.79,
  transportationBeta: 0.86,

  // Damodaran, "Historical Implied Equity Risk Premiums", January 2026: the
  // implied premium at the end of 2025. And the 1928-2025 arithmetic average
  // of the S&P 500 return minus the 10-year Treasury bond return, computed
  // from the 98 yearly rows of his "Historical Returns on Stocks, Bonds and
  // Bills" table: 11.855% minus 4.822% (11.86% and 4.82% when rounded).
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

const TAX_RATE = round2(UP.federalTaxRate + UP.stateTaxRate);

/** The case's own estimate, as of 30 January 2026. */
export const ESTIMATE: WaccInputs = {
  riskFree: MARKET.tenYear,
  premium: MARKET.impliedPremium,
  // The lesson's procedure: the railroads' unlevered beta, re-levered at
  // Union Pacific's own debt-to-equity ratio (26.5 / 139.5 = 0.19).
  beta: round2(
    relever(
      MARKET.railroadUnleveredBeta,
      TAX_RATE,
      UP.fairValueOfDebt / UP.marketValueOfEquity,
    ),
  ),
  // Investment grade (the 10-K lists a fall "below investment grade" as a
  // risk): halfway between the Aaa and Baa yields.
  costOfDebt: round2((MARKET.aaaYield + MARKET.baaYield) / 2),
  // The rate on the next dollar of income: federal plus state.
  taxRate: TAX_RATE,
  debtShare: MARKET_DEBT_SHARE,
};

/**
 * What a careful analyst might use instead, one input at a time. Every end
 * of every range is a published or filed number. For beta: Damodaran's
 * Transportation group, and the railroad average as published, before any
 * adjustment for Union Pacific's lighter debt.
 */
export const RANGES: InputRanges = {
  riskFree: [MARKET.tenYearAtYearEnd, MARKET.thirtyYear],
  premium: [MARKET.impliedPremium, MARKET.historicalPremium],
  beta: [MARKET.transportationBeta, MARKET.railroadBeta],
  costOfDebt: [MARKET.aaaYield, MARKET.baaYield],
  taxRate: [UP.federalTaxRate, TAX_RATE],
  debtShare: [MARKET_DEBT_SHARE, INDUSTRY_DEBT_SHARE],
};

// ---------------------------------------------------------------------------
// The valuation case (case 4)

/**
 * Consolidated Statements of Income and of Cash Flows. 2023 to 2025 from the
 * 10-K for 2025; 2021 and 2022 from the 10-K for 2023, which also prints 2023
 * with the same figures. `currentItems` are the five "Changes in current
 * assets and liabilities" lines as printed: accounts receivable; materials
 * and supplies; other current assets; accounts payable and other current
 * liabilities; income and other taxes.
 */
export const HISTORY = [
  {
    year: 2021,
    revenue: 21_804,
    operatingIncome: 9_338,
    depreciation: 2_208,
    capitalInvestments: 2_936,
    currentItems: [-217, 17, 31, 184, 188],
    incomeTaxExpense: 1_955,
  },
  {
    year: 2022,
    revenue: 24_875,
    operatingIncome: 9_917,
    depreciation: 2_246,
    capitalInvestments: 3_620,
    currentItems: [-169, -120, 5, 565, -273],
    incomeTaxExpense: 2_074,
  },
  {
    year: 2023,
    revenue: 24_119,
    operatingIncome: 9_082,
    depreciation: 2_318,
    capitalInvestments: 3_606,
    currentItems: [-177, -2, -38, -215, 129],
    incomeTaxExpense: 1_854,
  },
  {
    year: 2024,
    revenue: 24_250,
    operatingIncome: 9_713,
    depreciation: 2_398,
    capitalInvestments: 3_452,
    currentItems: [179, -26, -69, 189, -87],
    incomeTaxExpense: 2_047,
  },
  {
    year: 2025,
    revenue: 24_510,
    operatingIncome: 9_846,
    depreciation: 2_465,
    capitalInvestments: 3_791,
    currentItems: [34, -18, 25, -196, -206],
    incomeTaxExpense: 2_028,
  },
];

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Debt at fair value, less cash and short-term investments, 31 Dec 2025. */
export const NET_DEBT = UP.fairValueOfDebt - UP.cash - UP.shortTermInvestments;

/** Net investment over after-tax operating income, 2021 to 2025 together. */
export const REINVESTMENT_SHARE = (() => {
  const rows = HISTORY.map((h) => historicalFcf(h, TAX_RATE));
  const reinvested = rows.reduce((a, r) => a + r.reinvestment, 0);
  const nopat = rows.reduce((a, r) => a + r.nopat, 0);
  return round1((reinvested / nopat) * 100);
})();

/**
 * The case's base case, valued at 31 December 2025. Revenue growth of 3% is
 * 2021 to 2025 compound growth (2.97%) rounded; the 40% margin is the 2021
 * to 2025 average (40.1%) rounded; long-run growth of 3% is the case's
 * assumption.
 */
export const DCF_BASE: DcfInputs = {
  revenue: HISTORY[HISTORY.length - 1].revenue,
  revenueGrowth: 3,
  operatingMargin: 40,
  taxRate: TAX_RATE,
  reinvestmentShare: REINVESTMENT_SHARE,
  wacc: round2(wacc(ESTIMATE).wacc),
  longRunGrowth: 3,
  netDebt: NET_DEBT,
  shares: UP.sharesOutstanding / 1e6,
};

/**
 * Low, most likely and high values for the random draws. The margin range
 * covers 2021 to 2025 (37.7% to 42.8%) rounded outward; the growth ranges
 * are the case's assumptions.
 */
export const DCF_RANGES: DcfRanges = {
  revenueGrowth: { low: 0, mode: 3, high: 5 },
  operatingMargin: { low: 37, mode: 40, high: 43 },
  longRunGrowth: { low: 2, mode: 3, high: 4 },
};
