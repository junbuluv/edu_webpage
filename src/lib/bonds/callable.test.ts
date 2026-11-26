// Run: node --test src/lib/bonds/callable.test.ts

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  callableBondValue,
  priceToCall,
  rateTree,
  straightPrice,
  treePrice,
  yieldToCall,
  yieldToMaturity,
  yieldToWorst,
  type CallableBond,
} from './callable.ts';

const near = (a: number, b: number, tol = 1e-6) =>
  assert.ok(Math.abs(a - b) <= tol, `${a} is not within ${tol} of ${b}`);

const bond: CallableBond = {
  couponRate: 0.06,
  maturity: 10,
  firstCall: 3,
  callPrice: 102,
};
const yields = [0.01, 0.03, 0.05, 0.06, 0.07, 0.09, 0.12];
const vols = [0, 0.05, 0.1, 0.15, 0.2, 0.3];
const bonds: CallableBond[] = [
  bond,
  { couponRate: 0.06, maturity: 10, firstCall: 1, callPrice: 100 },
  { couponRate: 0.08, maturity: 30, firstCall: 5, callPrice: 104 },
  { couponRate: 0.03, maturity: 5, firstCall: 4, callPrice: 110 },
];

test('straight price: par when coupon equals yield, textbook value otherwise', () => {
  near(straightPrice(0.06, 10, 0.06), 100, 1e-9);
  // 5-year 6% bond at a 5% yield, face 1,000 (bond-pricing lesson quiz).
  near(straightPrice(0.06, 5, 0.05, 1000), 1043.29, 0.005);
});

test('at zero volatility every rate on the tree is the flat yield', () => {
  for (const row of rateTree(0.05, 0, 6)) {
    for (const r of row) near(r, 0.05, 1e-12);
  }
});

test('the tree prices a straight bond at its flat-yield price for any volatility', () => {
  for (const b of bonds) {
    for (const y of yields) {
      for (const vol of vols) {
        const rates = rateTree(y, vol, b.maturity);
        near(
          treePrice(rates, b.couponRate, b.maturity),
          straightPrice(b.couponRate, b.maturity, y),
        );
      }
    }
  }
});

test('at zero volatility the callable price is the lower of price to maturity and price to first call', () => {
  for (const b of bonds) {
    for (const y of yields) {
      const expected = Math.min(
        straightPrice(b.couponRate, b.maturity, y),
        priceToCall(b.couponRate, b.firstCall, b.callPrice, y),
      );
      near(callableBondValue(b, y, 0).callable, expected);
    }
  }
});

test('the callable price never exceeds the straight price on the same tree', () => {
  for (const b of bonds) {
    for (const y of yields) {
      for (const vol of vols) {
        const { straight, callable, optionValue } = callableBondValue(
          b,
          y,
          vol,
        );
        assert.ok(callable <= straight + 1e-9, JSON.stringify({ b, y, vol }));
        assert.ok(optionValue >= -1e-9);
      }
    }
  }
});

test('a call price nobody would pay gives the straight price', () => {
  for (const y of yields) {
    for (const vol of vols) {
      const { straight, callable } = callableBondValue(
        { ...bond, callPrice: 1e6 },
        y,
        vol,
      );
      near(callable, straight, 1e-9);
    }
  }
});

test('the option value does not fall as volatility rises', () => {
  for (const b of bonds) {
    for (const y of yields) {
      let previous = -Infinity;
      for (const vol of vols) {
        const { optionValue } = callableBondValue(b, y, vol);
        assert.ok(
          optionValue >= previous - 1e-9,
          JSON.stringify({ b, y, vol, optionValue, previous }),
        );
        previous = optionValue;
      }
    }
  }
});

test('a later first call date or a higher call price never lowers the callable price', () => {
  for (const y of yields) {
    const base = callableBondValue(bond, y, 0.15).callable;
    const later = callableBondValue({ ...bond, firstCall: 5 }, y, 0.15);
    const dearer = callableBondValue({ ...bond, callPrice: 105 }, y, 0.15);
    assert.ok(later.callable >= base - 1e-9);
    assert.ok(dearer.callable >= base - 1e-9);
  }
});

test('yield to call and yield to maturity invert the price formulas', () => {
  const price = 104;
  const ytc = yieldToCall(price, 0.06, 3, 102);
  const ytm = yieldToMaturity(price, 0.06, 10);
  assert.ok(ytc !== null && ytm !== null);
  near(priceToCall(0.06, 3, 102, ytc), price);
  near(straightPrice(0.06, 10, ytm), price);
});

test('yield to worst: yield to first call well above the call price, yield to maturity at or below it', () => {
  const premium = yieldToWorst(104, bond);
  const ytc = yieldToCall(104, 0.06, 3, 102);
  assert.ok(premium !== null && ytc !== null);
  near(premium, ytc, 1e-9);

  for (const price of [95, 100, 101, 102]) {
    const worst = yieldToWorst(price, bond);
    const ytm = yieldToMaturity(price, 0.06, 10);
    assert.ok(worst !== null && ytm !== null);
    near(worst, ytm, 1e-9);
  }
});

test('just above the call price the yield to maturity can still be the yield to worst', () => {
  // The switch to the yield to first call comes at a price near 102.65.
  for (const [price, toCall] of [
    [102.5, false],
    [102.6, false],
    [102.7, true],
  ] as const) {
    const worst = yieldToWorst(price, bond)!;
    const ytm = yieldToMaturity(price, 0.06, 10)!;
    const ytc = yieldToCall(price, 0.06, 3, 102)!;
    near(worst, toCall ? ytc : ytm, 1e-9);
    assert.ok(toCall ? ytc < ytm : ytm < ytc);
  }
});

test('the callable price never exceeds the price to first call', () => {
  for (const b of bonds) {
    for (const y of yields) {
      for (const vol of vols) {
        const cap = priceToCall(b.couponRate, b.firstCall, b.callPrice, y);
        assert.ok(callableBondValue(b, y, vol).callable <= cap + 1e-6);
      }
    }
  }
});

// The lesson (callable-bonds.mdx) and its quiz quote these numbers. If the
// model changes, this test says which sentences to rewrite.
test('numbers quoted in the lesson and quiz', () => {
  const cent = 0.005;
  const bp = 0.00005; // yields are quoted to 0.01%

  // Chart baseline and the convexity table: 6% 10-year, callable from year 3
  // at 102, 15% volatility, yields of 5%, 4%, 6% and 1%.
  const at = (y: number) => callableBondValue(bond, y, 0.15);
  near(at(0.05).straight, 107.72, cent);
  near(at(0.05).callable, 102.55, cent);
  near(at(0.04).straight, 116.22, cent);
  near(at(0.04).callable, 106.9, cent);
  near(at(0.06).straight, 100, cent);
  near(at(0.06).callable, 97.46, cent);
  near(at(0.01).straight, 147.36, cent);
  near(at(0.01).callable, 116.65, cent);
  near(at(0.01).callable, priceToCall(0.06, 3, 102, 0.01)); // "exactly its price to call"
  // "about 40 points" and "about 14" from a 5% yield down to 1%.
  near(at(0.01).straight - at(0.05).straight, 40, 0.5);
  near(at(0.01).callable - at(0.05).callable, 14, 0.5);
  // The callable bond's own yield to maturity at the baseline price.
  near(yieldToMaturity(102.55, 0.06, 10)!, 0.0566, bp);
  near(callableBondValue(bond, 0.06, 0).optionValue, 0, 1e-6);
  near(
    callableBondValue({ ...bond, firstCall: 1 }, 0.01, 0.15).callable,
    106.93,
    cent,
  );
  const yearTwo = rateTree(0.05, 0.15, 2)[1];
  near(yearTwo[0], 0.0426, bp);
  near(yearTwo[1], 0.0575, bp);

  // Worked example: the same bond at a price of 104, then 95.
  near(yieldToMaturity(104, 0.06, 10)!, 0.0547, bp);
  near(yieldToCall(104, 0.06, 3, 102)!, 0.0516, bp);
  near(yieldToCall(104, 0.06, 4, 102)!, 0.0533, bp);
  near(yieldToWorst(104, bond)!, 0.0516, bp);
  near(yieldToMaturity(95, 0.06, 10)!, 0.067, bp);
  near(yieldToCall(95, 0.06, 3, 102)!, 0.0857, bp);
  near(yieldToWorst(95, bond)!, 0.067, bp);
  near(yieldToMaturity(102.5, 0.06, 10)!, 0.0567, bp);
  near(yieldToCall(102.5, 0.06, 3, 102)!, 0.057, bp);

  // Coupon that sells at par at a 5% yield: about 5.43% when callable from
  // year 3 at 102, about 5.27% with five years of call protection.
  near(
    callableBondValue({ ...bond, couponRate: 0.0543 }, 0.05, 0.15).callable,
    100,
    0.05,
  );
  near(
    callableBondValue({ ...bond, couponRate: 0.0527, firstCall: 5 }, 0.05, 0.15)
      .callable,
    100,
    0.05,
  );

  // Make-whole example: 5% coupon, 7 years left, discounted at 3.25% and 4%.
  near(straightPrice(0.05, 7, 0.0325), 110.8, cent);
  near(straightPrice(0.05, 7, 0.04), 106.0, cent);

  // Quiz q2 (yield to worst of a 7% 8-year bond callable from year 2 at 103,
  // priced at 105) and q4.
  const quizBond = {
    couponRate: 0.07,
    maturity: 8,
    firstCall: 2,
    callPrice: 103,
  };
  near(yieldToWorst(105, quizBond)!, 0.0574, bp);
  near(yieldToCall(105, 0.07, 2, 103)!, 0.0574, bp);
  near(yieldToCall(105, 0.07, 3, 103)!, 0.0607, bp);
  near(yieldToMaturity(105, 0.07, 8)!, 0.0619, bp);
  near(priceToCall(0.06, 2, 102, 0.03), 107.63, cent);
});
