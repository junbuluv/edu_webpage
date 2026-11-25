// Run: node --test src/lib/lbo/model.test.ts

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { irr, runLbo, unleveredLbo, type LboInputs } from './model.ts';

// The chart's baseline and the lesson's worked example.
const base: LboInputs = {
  ebitda: 100,
  entryMultiple: 10,
  debtToEbitda: 5,
  growth: 0.05,
  exitMultiple: 10,
  years: 5,
  interestRate: 0.08,
  cashShare: 0.5,
};

const close = (actual: number, expected: number, tol = 1e-9) =>
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `expected ${expected}, got ${actual}`,
  );

const bridgeSum = (r: ReturnType<typeof runLbo>) =>
  r.bridge.growth + r.bridge.multiple + r.bridge.paydown;

test('irr solves one payment out followed by payments in', () => {
  close(irr([-100, 10, 110]), 0.1);
  close(irr([-200, 0, 0, 0, 0, 400]), 2 ** (1 / 5) - 1);
  assert.equal(irr([-100, 0, 0]), -1);
});

test('baseline deal: sources, debt schedule and returns', () => {
  const r = runLbo(base);
  assert.equal(r.entryValue, 1000);
  assert.equal(r.entryDebt, 500);
  assert.equal(r.entryEquity, 500);

  // Year 1 by hand: EBITDA 105, cash flow 52.5, interest 8% x 500 = 40,
  // so 12.5 repays debt.
  const y1 = r.schedule[0];
  close(y1.ebitda, 105);
  close(y1.cashFlow, 52.5);
  close(y1.interest, 40);
  close(y1.paydown, 12.5);
  close(y1.debt, 487.5);
  assert.equal(y1.shortfall, 0);
  assert.equal(y1.dividend, 0);

  close(r.exitEbitda, 100 * 1.05 ** 5);
  close(r.exitValue, 1000 * 1.05 ** 5);
  close(r.exitDebt, 396.83, 0.005);
  close(r.exitEquity, 879.45, 0.005);
  assert.equal(r.dividends, 0);
  close(r.moic, 1.7589, 0.00005);
  close(r.irr, 0.1196, 0.00005);
  // One payment in and one out: the IRR has a closed form.
  close(r.irr, r.moic ** (1 / 5) - 1);
  assert.equal(r.shortfall, 0);
});

test('the three bridge parts sum to exit equity minus entry equity', () => {
  const cases: LboInputs[] = [
    base,
    { ...base, exitMultiple: 12, growth: 0.1 },
    { ...base, exitMultiple: 7, growth: -0.05, debtToEbitda: 7 }, // wiped out
    { ...base, debtToEbitda: 7, interestRate: 0.14 }, // interest not covered
    { ...base, entryMultiple: 8, exitMultiple: 14, years: 3 },
  ];
  for (const c of cases) {
    const r = runLbo(c);
    assert.equal(r.dividends, 0);
    close(bridgeSum(r), r.exitEquity - r.entryEquity);
  }
  // Debt repaid early: cash paid to the owners counts as well.
  const early = runLbo({ ...base, debtToEbitda: 1, years: 8 });
  assert.ok(early.dividends > 0);
  close(bridgeSum(early), early.exitEquity + early.dividends - 900);
});

test('baseline bridge: growth and paydown, no multiple change', () => {
  const { bridge } = runLbo(base);
  close(bridge.growth, (100 * 1.05 ** 5 - 100) * 10);
  assert.equal(bridge.multiple, 0);
  close(bridge.paydown, 103.17, 0.005);
});

test('with zero debt the levered and unlevered results match', () => {
  const noDebt = runLbo({ ...base, debtToEbitda: 0 });
  assert.deepEqual(noDebt, unleveredLbo(base));
  // No lender: the owner takes every year's cash flow, then the sale price.
  for (const y of noDebt.schedule) close(y.dividend, y.cashFlow);
  close(noDebt.dividends, 290.1, 0.005);
  close(noDebt.exitEquity, noDebt.exitValue);
  close(noDebt.moic, 1.5664, 0.00005);
  // A 5.25% cash yield on opening value plus 5% growth in value.
  close(noDebt.irr, 0.1025);
  // The yearly return does not depend on how long the firm is held.
  close(unleveredLbo({ ...base, years: 8 }).irr, 0.1025);
});

test('leverage raises the return only when the assets out-earn the debt', () => {
  // Baseline: the purchase earns 10.25% a year unlevered, above the 8% debt.
  assert.ok(runLbo(base).irr > unleveredLbo(base).irr);
  // No growth: it earns 5% unlevered, below the 8% debt.
  const flat = { ...base, growth: 0 };
  close(unleveredLbo(flat).irr, 0.05);
  close(runLbo(flat).irr, 0.0224, 0.00005);
  // Debt at exactly the unlevered return changes nothing.
  close(runLbo({ ...base, interestRate: 0.1025 }).irr, 0.1025);
});

test('year 1 of the baseline matches MM Proposition II', () => {
  const r = runLbo(base);
  const equityAfterYear1 = 10 * r.schedule[0].ebitda - r.schedule[0].debt;
  const rU = unleveredLbo(base).irr;
  close(equityAfterYear1 / r.entryEquity - 1, rU + (500 / 500) * (rU - 0.08));
});

test('unpaid interest is reported as a shortfall, never a negative paydown', () => {
  // Year 1: cash flow 52.5 against interest of 14% x 700 = 98.
  const r = runLbo({ ...base, debtToEbitda: 7, interestRate: 0.14 });
  const y1 = r.schedule[0];
  close(y1.shortfall, 45.5);
  assert.equal(y1.paydown, 0);
  close(y1.debt, 745.5); // the unpaid interest is owed too
  let opening = 700;
  for (const y of r.schedule) {
    assert.ok(y.paydown >= 0);
    assert.ok(y.shortfall >= 0);
    close(y.debt, opening - y.paydown + y.shortfall);
    opening = y.debt;
  }
  close(
    r.shortfall,
    r.schedule.reduce((sum, y) => sum + y.shortfall, 0),
  );
  // Unaffordable debt lowers the return below the same deal at 8%.
  assert.ok(r.irr < runLbo({ ...base, debtToEbitda: 7 }).irr);
});

test('paydown stops at zero debt and spare cash goes to the owners', () => {
  const r = runLbo({ ...base, debtToEbitda: 1, years: 8 });
  assert.equal(r.exitDebt, 0);
  for (const y of r.schedule) {
    assert.ok(y.debt >= 0);
    close(y.paydown + y.dividend, y.cashFlow - y.interest);
  }
  close(r.exitEquity, r.exitValue);
  close(r.proceeds, r.exitValue + r.dividends);
  // Cheap debt still helps a little: above the 10.25% unlevered return.
  assert.ok(r.irr > 0.1025);
});

test('equity is wiped out, not negative, when the sale cannot repay the debt', () => {
  const r = runLbo({
    ...base,
    debtToEbitda: 7,
    growth: -0.05,
    exitMultiple: 7,
  });
  assert.ok(r.exitEquity < 0); // the lenders' loss
  assert.equal(r.proceeds, 0);
  assert.equal(r.moic, 0);
  assert.equal(r.irr, -1);
});

test('debt at or above the purchase price is rejected', () => {
  assert.throws(() => runLbo({ ...base, debtToEbitda: 10 }), RangeError);
});

// The practice quiz's answers (fin-3610-private-equity-and-lbos.json).
test('quiz answers', () => {
  const q = runLbo({
    ebitda: 50,
    entryMultiple: 8,
    debtToEbitda: 4,
    growth: 0.1,
    exitMultiple: 9,
    years: 2,
    interestRate: 0.1,
    cashShare: 0.5,
  });
  assert.equal(q.entryEquity, 200); // q1
  close(q.schedule[0].paydown, 7.5);
  close(q.exitDebt, 181.5);
  close(q.exitEquity, 363); // q2
  close(irr([-150, 0, 0, 330]), 0.3006, 0.00005); // q3
  // q4: entry 9x on 40 with debt 200, exit 10x on 50 with debt 150.
  const [growth, multiple, paydown] = [9 * (50 - 40), (10 - 9) * 50, 200 - 150];
  assert.deepEqual([growth, multiple, paydown], [90, 50, 50]);
  assert.equal(growth + multiple + paydown, 10 * 50 - 150 - (9 * 40 - 200));
});
