import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareLessons, findPrevNext } from './sequence.ts';

type TestLesson = Parameters<typeof compareLessons>[0];

function lesson(slug: string, unit: string, order: number): TestLesson {
  return {
    slug,
    data: { course: 'fin-3610', unit, order, draft: false },
  } as TestLesson;
}

test('lesson order follows the unit sequence before the order number', () => {
  const foundations = lesson('fin-3610/npv-decision-rule', 'Foundations', 9);
  const risk = lesson('fin-3610/capm-and-sml', 'Risk and return', 2);
  const credit = lesson(
    'fin-3610/callable-bonds',
    'Credit markets and private equity',
    1,
  );

  assert.deepEqual(
    [credit, risk, foundations].sort(compareLessons).map((item) => item.slug),
    [foundations.slug, risk.slug, credit.slug],
  );
});

test('prev/next uses the same comparator and excludes drafts', () => {
  const first = lesson('fin-3610/corporation-and-markets', 'Foundations', 1);
  const second = lesson('fin-3610/law-of-one-price', 'Foundations', 2);
  const draft = {
    ...lesson('fin-3610/draft', 'Foundations', 3),
    data: { ...lesson('fin-3610/draft', 'Foundations', 3).data, draft: true },
  } as TestLesson;

  const result = findPrevNext(second, [draft, second, first]);
  assert.equal(result.prev?.slug, first.slug);
  assert.equal(result.next, null);
});
