export function operatingIncome(
  revenue: number,
  grossMargin: number,
  cashOpexRate: number,
  depreciation: number,
) {
  const cogs = revenue * (1 - grossMargin);
  const cashOpex = revenue * cashOpexRate;
  const ebitda = revenue - cogs - cashOpex;
  return { cogs, cashOpex, ebitda, ebit: ebitda - depreciation };
}

export function logNetExports(
  realExchangeRate: number,
  intercept: number,
  slope: number,
) {
  return intercept - slope * Math.log(realExchangeRate);
}

export function solveLogExchangeRate(
  netExports: number,
  intercept: number,
  slope: number,
) {
  return Math.exp((intercept - netExports) / slope);
}

export function okunOutcome(
  outputGap: number,
  naturalUnemployment: number,
  expectedInflation: number,
  phillipsSlope: number,
  okunCoefficient: number,
) {
  const unemployment = naturalUnemployment - okunCoefficient * outputGap;
  const inflation =
    expectedInflation - phillipsSlope * (unemployment - naturalUnemployment);
  return { unemployment, inflation };
}

export function maxLocalOkunGap(
  naturalUnemployment: number,
  okunCoefficient: number,
  requestedMaximum = 5,
  minimumUnemployment = 1,
) {
  return Math.min(
    requestedMaximum,
    (naturalUnemployment - minimumUnemployment) / okunCoefficient,
  );
}

export function loanableFundsEquilibrium(
  investmentIntercept: number,
  savingIntercept: number,
  investmentSlope: number,
  savingSlope: number,
  deficit: number,
) {
  const realRate =
    (investmentIntercept - savingIntercept + deficit) /
    (investmentSlope + savingSlope);
  const quantity = investmentIntercept - investmentSlope * realRate;
  return { realRate, quantity };
}

export function loanableFundsRateDomain(
  investmentIntercept: number,
  savingIntercept: number,
  investmentSlope: number,
  savingSlope: number,
  deficit: number,
  equilibriumRate: number,
) {
  const minimumFeasibleRate = (deficit - savingIntercept) / savingSlope;
  const maximumFeasibleRate = investmentIntercept / investmentSlope;
  const minimum = Math.max(
    minimumFeasibleRate,
    Math.min(0, equilibriumRate - 4),
  );
  const maximum = Math.min(
    maximumFeasibleRate,
    Math.max(20, equilibriumRate + 4),
  );
  return { minimum, maximum };
}

export function paddedReturnDomain(values: number[]): [number, number] {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return [0, 0.1];
  const minimum = Math.min(0, ...finite);
  const maximum = Math.max(0, ...finite);
  const padding = Math.max(0.02, (maximum - minimum) * 0.1);
  return [Math.min(0, minimum - padding), maximum + padding];
}

export function irrForCashflows(cashflows: number[]): number | null {
  if (
    cashflows.length < 2 ||
    cashflows.some((cashflow) => !Number.isFinite(cashflow)) ||
    !cashflows.some((cashflow) => cashflow < 0) ||
    !cashflows.some((cashflow) => cashflow > 0)
  ) {
    return null;
  }

  const npv = (rate: number) =>
    cashflows.reduce(
      (total, cashflow, period) =>
        total + cashflow / Math.pow(1 + rate, period),
      0,
    );

  let low = -0.999999;
  let high = 1;
  let lowNpv = npv(low);
  let highNpv = npv(high);
  if (!Number.isFinite(lowNpv) || !Number.isFinite(highNpv)) return null;

  while (lowNpv * highNpv > 0 && high < 1_000_000) {
    high = high * 2 + 1;
    highNpv = npv(high);
    if (!Number.isFinite(highNpv)) return null;
  }
  if (lowNpv * highNpv > 0) return null;

  for (let iteration = 0; iteration < 100; iteration++) {
    const midpoint = (low + high) / 2;
    const midpointNpv = npv(midpoint);
    if (Math.abs(midpointNpv) < 1e-9) return midpoint;
    if (lowNpv * midpointNpv < 0) {
      high = midpoint;
      highNpv = midpointNpv;
    } else {
      low = midpoint;
      lowNpv = midpointNpv;
    }
  }
  return (low + high) / 2;
}
