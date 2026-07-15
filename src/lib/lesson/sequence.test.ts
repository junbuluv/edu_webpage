import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareLessons, findPrevNext } from './sequence.ts';

type TestLesson = Parameters<typeof compareLessons>[0];

function lesson(
  slug: string,
  course: 'eco-1002' | 'fin-3610',
  unit: string,
  order: number,
): TestLesson {
  return {
    slug,
    data: { course, unit, order, draft: false },
  } as TestLesson;
}

test('ECO lesson order follows unit sequence before reused unit order', () => {
  const growth = lesson(
    'eco-1002/loanable-funds',
    'eco-1002',
    'Long-run growth',
    2,
  );
  const shortRun = lesson(
    'eco-1002/is-lm-intro',
    'eco-1002',
    'Short-run output and interest',
    1,
  );
  const inflation = lesson(
    'eco-1002/phillips-curve',
    'eco-1002',
    'Inflation and unemployment',
    1,
  );

  assert.deepEqual(
    [inflation, shortRun, growth].sort(compareLessons).map((item) => item.slug),
    [growth.slug, shortRun.slug, inflation.slug],
  );
});

test('prev/next uses the same comparator and excludes drafts', () => {
  const first = lesson('eco-1002/solow', 'eco-1002', 'Long-run growth', 1);
  const second = lesson(
    'eco-1002/loanable-funds',
    'eco-1002',
    'Long-run growth',
    2,
  );
  const draft = {
    ...lesson('eco-1002/draft', 'eco-1002', 'Long-run growth', 3),
    data: {
      ...lesson('eco-1002/draft', 'eco-1002', 'Long-run growth', 3).data,
      draft: true,
    },
  } as TestLesson;

  const result = findPrevNext(second, [draft, second, first]);
  assert.equal(result.prev?.slug, first.slug);
  assert.equal(result.next, null);
});
