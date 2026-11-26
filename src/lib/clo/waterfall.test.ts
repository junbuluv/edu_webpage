// Run: node --test src/lib/clo/waterfall.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ILLUSTRATIVE_TRANCHES as T,
  allocateLosses,
  poolLoss,
  residualInterest,
} from './waterfall.ts';

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

// Every default/recovery pair on a 5-point grid, as pool loss in percent.
const GRID: number[] = [];
for (let d = 0; d <= 100; d += 5)
  for (let r = 0; r <= 100; r += 5) GRID.push(poolLoss(d / 100, r / 100) * 100);

test('the illustrative tranches fund the whole pool', () => {
  assert.equal(sum(T.map((t) => t.size)), 100);
});

test('pool loss is the default rate times the share not recovered', () => {
  assert.ok(near(poolLoss(0.2, 0.65), 0.07));
  assert.equal(poolLoss(0.2, 1), 0);
  assert.equal(poolLoss(1, 0), 1);
});

test('tranche losses sum to the pool loss', () => {
  for (const loss of GRID) {
    const rows = allocateLosses(T, loss);
    assert.ok(near(sum(rows.map((r) => r.lost)), loss), `loss ${loss}`);
    for (const r of rows) assert.ok(near(r.lost + r.intact, r.size));
  }
});

test('a tranche loses nothing until every tranche below it is wiped out', () => {
  for (const loss of GRID) {
    const rows = allocateLosses(T, loss);
    rows.forEach((r, i) => {
      if (r.lost === 0) return;
      for (const junior of rows.slice(i + 1))
        assert.equal(junior.intact, 0, `${r.name} hit before ${junior.name}`);
    });
  }
});

test('zero defaults give zero losses', () => {
  for (const r of allocateLosses(T, poolLoss(0, 0.65) * 100)) {
    assert.equal(r.lost, 0);
    assert.equal(r.intact, r.size);
  }
});

test('total loss wipes out every tranche', () => {
  for (const r of allocateLosses(T, poolLoss(1, 0) * 100)) {
    assert.equal(r.lost, r.size);
    assert.equal(r.intact, 0);
  }
});

test('a loss larger than the pool, or negative, is capped', () => {
  assert.equal(sum(allocateLosses(T, 250).map((r) => r.lost)), 100);
  assert.equal(sum(allocateLosses(T, -5).map((r) => r.lost)), 0);
});

test('the chart baseline: 20% defaults at 65% recovery cost equity 78%', () => {
  const rows = allocateLosses(T, 7);
  assert.deepEqual(
    rows.map((r) => r.lost),
    [0, 0, 0, 0, 0, 7],
  );
  assert.equal(Math.round((7 / 9) * 100), 78);
});

// The lesson's worked example, in millions of dollars with SOFR at 4%.
const LESSON_NOTES = [
  { size: 310, rate: 0.053 },
  { size: 60, rate: 0.058 },
  { size: 30, rate: 0.063 },
  { size: 30, rate: 0.073 },
  { size: 25, rate: 0.105 },
];

test("the lesson's equity example", () => {
  const residual = residualInterest(500, 0.075, LESSON_NOTES, 0.005);
  assert.ok(near(residual, 8.385));
  assert.equal(((residual / 45) * 100).toFixed(1), '18.6');
  const afterLosses = residual - poolLoss(0.02, 0.65) * 500;
  assert.ok(near(afterLosses, 4.885));
  assert.equal(((afterLosses / 45) * 100).toFixed(1), '10.9');
});

test('the quiz answers match the math', () => {
  const quiz = JSON.parse(
    readFileSync(
      new URL(
        '../../content/quizzes/fin-3610-clos-and-leveraged-loans.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const answer = (id: string): number =>
    quiz.questions.find((q: { id: string }) => q.id === id).answer;

  // q1: 30% defaults at 60% recovery, loss to the BB tranche.
  const bb = allocateLosses(T, poolLoss(0.3, 0.6) * 100).find(
    (r) => r.name === 'BB',
  )!;
  assert.ok(near(answer('q1'), (bb.lost / bb.size) * 100));

  // q3: equity cash yield before losses.
  const residual = residualInterest(
    400,
    0.08,
    [{ size: 360, rate: 0.06 }],
    0.005,
  );
  assert.ok(near(answer('q3'), (residual / 40) * 100));

  // q5: every loan defaults at 50% recovery, loss to the AAA tranche.
  const aaa = allocateLosses(T, poolLoss(1, 0.5) * 100)[0];
  assert.equal(Math.round((aaa.lost / aaa.size) * 100), 19);
});
