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
