// Callable bond pricing on a binomial interest-rate tree. Pure and alias-free
// so `node --test` can run it. Prices are per `face` (100 by default), coupons
// are annual, and one tree step is one year.

import { irrForCashflows } from '../viz/model-math.ts';

export interface CallableBond {
  couponRate: number; // annual coupon as a fraction of face
  maturity: number; // whole years
  firstCall: number; // first year the issuer may call, 1 <= firstCall < maturity
  callPrice: number; // paid by the issuer on a call, in the same units as face
  face?: number;
}

/** Present value of the coupons and face at one flat yield. */
export function straightPrice(
  couponRate: number,
  maturity: number,
  yieldRate: number,
  face = 100,
): number {
  let price = face / Math.pow(1 + yieldRate, maturity);
  for (let t = 1; t <= maturity; t++) {
    price += (couponRate * face) / Math.pow(1 + yieldRate, t);
  }
  return price;
}

/** Price if the issuer is sure to call in `callYear` at `callPrice`. */
export function priceToCall(
  couponRate: number,
  callYear: number,
  callPrice: number,
  yieldRate: number,
  face = 100,
): number {
  let price = callPrice / Math.pow(1 + yieldRate, callYear);
  for (let t = 1; t <= callYear; t++) {
    price += (couponRate * face) / Math.pow(1 + yieldRate, t);
  }
  return price;
}

/**
 * One-year rates for each year and node: rates[i][j] is the rate from year i
 * to i+1 after j up-moves, each move equally likely. Within a year the rates
 * are spaced by a factor exp(2 * vol) (lognormal, so never negative), and the
 * lowest rate is set so the tree prices every zero-coupon bond at the flat
 * `yieldRate`. A straight bond priced on the tree therefore equals
 * straightPrice at that yield, and at zero volatility every rate is the yield.
 * shortcut: no mean reversion, so rates 20+ years out spread very wide; add it
 * before using this for anything but the teaching chart.
 */
export function rateTree(
  yieldRate: number,
  vol: number,
  steps: number,
): number[][] {
  const rates: number[][] = [];
  // statePrice[j]: value today of 1 paid at node j of the current year.
  let statePrice = [1];
  for (let i = 0; i < steps; i++) {
    const spacing = Array.from({ length: i + 1 }, (_, j) =>
      Math.exp(2 * vol * j),
    );
    const target = Math.pow(1 + yieldRate, -(i + 1));
    const zeroPrice = (lowest: number) =>
      statePrice.reduce((sum, q, j) => sum + q / (1 + lowest * spacing[j]), 0);
    // The lowest rate lies between 0 and the yield; the zero price falls as it rises.
    let low = 0;
    let high = Math.max(yieldRate, 0);
    for (let k = 0; k < 60; k++) {
      const mid = (low + high) / 2;
      if (zeroPrice(mid) > target) low = mid;
      else high = mid;
    }
    const lowest = (low + high) / 2;
    const row = spacing.map((s) => lowest * s);
    rates.push(row);
    const next = new Array<number>(i + 2).fill(0);
    row.forEach((r, j) => {
      const half = (0.5 * statePrice[j]) / (1 + r);
      next[j] += half;
      next[j + 1] += half;
    });
    statePrice = next;
  }
  return rates;
}

/**
 * Backward induction on a rate tree. With `call` set, in every year from
 * call.firstCall to maturity - 1 the issuer calls when that is cheaper than
 * leaving the bond outstanding, so after the coupon the holder has the lower
 * of the continuation value and the call price.
 */
export function treePrice(
  rates: number[][],
  couponRate: number,
  maturity: number,
  face = 100,
  call?: { firstCall: number; callPrice: number },
): number {
  const coupon = couponRate * face;
  // values[j]: bond value at node j of the current year, coupon included.
  let values = new Array<number>(maturity + 1).fill(face + coupon);
  for (let i = maturity - 1; i >= 0; i--) {
    const callable = call !== undefined && i >= call.firstCall;
    values = rates[i].map((r, j) => {
      const continuation = (0.5 * (values[j] + values[j + 1])) / (1 + r);
      if (i === 0) return continuation; // today: no coupon, no call
      return (
        coupon +
        (callable ? Math.min(continuation, call.callPrice) : continuation)
      );
    });
  }
  return values[0];
}

/** Straight and callable prices on the same tree, and the call option's value. */
export function callableBondValue(
  bond: CallableBond,
  yieldRate: number,
  vol: number,
): { straight: number; callable: number; optionValue: number } {
  const face = bond.face ?? 100;
  const rates = rateTree(yieldRate, vol, bond.maturity);
  const straight = treePrice(rates, bond.couponRate, bond.maturity, face);
  const callable = treePrice(rates, bond.couponRate, bond.maturity, face, bond);
  return { straight, callable, optionValue: straight - callable };
}

/** Yield earned if the bond is bought at `price` and called in `callYear`. */
export function yieldToCall(
  price: number,
  couponRate: number,
  callYear: number,
  callPrice: number,
  face = 100,
): number | null {
  const coupon = couponRate * face;
  const flows = [-price];
  for (let t = 1; t < callYear; t++) flows.push(coupon);
  flows.push(coupon + callPrice);
  return irrForCashflows(flows);
}

/** Yield to maturity: a "call" at face in the final year. */
export function yieldToMaturity(
  price: number,
  couponRate: number,
  maturity: number,
  face = 100,
): number | null {
  return yieldToCall(price, couponRate, maturity, face, face);
}

/** Lowest yield over every possible call year and maturity. */
export function yieldToWorst(price: number, bond: CallableBond): number | null {
  const face = bond.face ?? 100;
  const yields = [yieldToMaturity(price, bond.couponRate, bond.maturity, face)];
  for (let t = bond.firstCall; t < bond.maturity; t++) {
    yields.push(yieldToCall(price, bond.couponRate, t, bond.callPrice, face));
  }
  if (yields.some((y) => y === null)) return null;
  return Math.min(...(yields as number[]));
}
