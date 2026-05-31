// Run: node --test src/lib/progress-aggregate.test.ts
// (Node >=23 strips the TS types natively; no test-runner dependency.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  countDistinctQuizzes,
  bestScoreByQuiz,
  computeAvgBestScore,
  evaluateRisk,
  type StudentSignals,
} from './progress-aggregate.ts';

// Fixed "now" so the inactivity rule is deterministic.
const NOW = Date.parse('2026-05-30T00:00:00Z');
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

// A student who is doing fine on every axis — the baseline for "not at risk".
const healthy: StudentSignals = {
  lessonsCompleted: 8,
  lessonsTotal: 10,
  lessonStartedCount: 9,
  lastActiveAt: daysAgo(2),
  quizAttemptCount: 6,
  avgBestScore: 0.9,
  attendanceCount: 4,
};

test('countDistinctQuizzes counts unique slugs', () => {
  assert.equal(countDistinctQuizzes([]), 0);
  assert.equal(
    countDistinctQuizzes([{ quiz_slug: 'a' }, { quiz_slug: 'a' }, { quiz_slug: 'b' }]),
    2,
  );
});

test('bestScoreByQuiz keeps the highest fraction per quiz and skips max_score<=0', () => {
  const best = bestScoreByQuiz([
    { quiz_slug: 'a', score: 5, max_score: 10 }, // 0.5
    { quiz_slug: 'a', score: 9, max_score: 10 }, // 0.9 -> wins
    { quiz_slug: 'b', score: 3, max_score: 0 }, // ignored (no denominator)
  ]);
  assert.equal(best.get('a'), 0.9);
  assert.equal(best.has('b'), false);
});

test('computeAvgBestScore averages per-quiz bests, null when nothing scorable', () => {
  assert.equal(computeAvgBestScore([]), null);
  assert.equal(computeAvgBestScore([{ quiz_slug: 'a', score: 1, max_score: 0 }]), null);
  // best(a)=0.9, best(b)=0.5 -> avg 0.7
  assert.equal(
    computeAvgBestScore([
      { quiz_slug: 'a', score: 5, max_score: 10 },
      { quiz_slug: 'a', score: 9, max_score: 10 },
      { quiz_slug: 'b', score: 5, max_score: 10 },
    ]),
    0.7,
  );
});

test('healthy student is not at risk', () => {
  const r = evaluateRisk(healthy, { closedWindowCount: 3, nowMs: NOW });
  assert.equal(r.atRisk, false);
  assert.deepEqual(r.reasons, []);
});

test('rule 1: no activity at all is flagged', () => {
  const r = evaluateRisk(
    { ...healthy, lessonStartedCount: 0, quizAttemptCount: 0, attendanceCount: 0, lastActiveAt: null, avgBestScore: null },
    { closedWindowCount: 0, nowMs: NOW },
  );
  assert.equal(r.atRisk, true);
  assert.ok(r.reasons.includes('No activity yet'));
});

test('rule 2: inactive AND behind is flagged; either alone is not', () => {
  // inactive (20d) AND behind (2/10 = 20%) -> flagged
  const both = evaluateRisk(
    { ...healthy, lessonsCompleted: 2, lastActiveAt: daysAgo(20) },
    { closedWindowCount: 0, nowMs: NOW },
  );
  assert.ok(both.reasons.some((x) => x.startsWith('Inactive')));

  // inactive but NOT behind (8/10) -> rule 2 silent
  const inactiveOnly = evaluateRisk(
    { ...healthy, lessonsCompleted: 8, lastActiveAt: daysAgo(20) },
    { closedWindowCount: 0, nowMs: NOW },
  );
  assert.equal(inactiveOnly.reasons.some((x) => x.startsWith('Inactive')), false);

  // behind but recently active (2d) -> rule 2 silent
  const behindOnly = evaluateRisk(
    { ...healthy, lessonsCompleted: 2, lastActiveAt: daysAgo(2) },
    { closedWindowCount: 0, nowMs: NOW },
  );
  assert.equal(behindOnly.reasons.some((x) => x.startsWith('Inactive')), false);
});

test('rule 2 boundary: exactly inactiveDays is not yet inactive (strict >)', () => {
  const r = evaluateRisk(
    { ...healthy, lessonsCompleted: 1, lastActiveAt: daysAgo(14) },
    { closedWindowCount: 0, nowMs: NOW },
  );
  assert.equal(r.reasons.some((x) => x.startsWith('Inactive')), false);
});

test('rule 2 never renders "Infinity" when engaged but lastActiveAt is null', () => {
  // Quiz activity but no dated lesson activity: noActivity is false, so rule 2
  // is reachable with daysSinceActive = Infinity. The label must not say "Infinityd".
  const r = evaluateRisk(
    { ...healthy, lessonsCompleted: 0, lessonStartedCount: 0, lastActiveAt: null, quizAttemptCount: 3, avgBestScore: 0.9 },
    { closedWindowCount: 0, nowMs: NOW },
  );
  assert.equal(
    r.reasons.some((x) => x.includes('Infinity')),
    false,
  );
  assert.ok(r.reasons.some((x) => x.startsWith('No recent activity')));
});

test('rule 3: low quiz avg flagged below 60%, boundary 60% is not', () => {
  assert.ok(
    evaluateRisk({ ...healthy, avgBestScore: 0.59 }, { closedWindowCount: 0, nowMs: NOW }).reasons.some(
      (x) => x.startsWith('Low quiz avg'),
    ),
  );
  assert.equal(
    evaluateRisk({ ...healthy, avgBestScore: 0.6 }, { closedWindowCount: 0, nowMs: NOW }).reasons.some(
      (x) => x.startsWith('Low quiz avg'),
    ),
    false,
  );
});

test('rule 4: no attendance flagged only once a window has closed', () => {
  assert.ok(
    evaluateRisk({ ...healthy, attendanceCount: 0 }, { closedWindowCount: 2, nowMs: NOW }).reasons.includes(
      'No workshop attendance',
    ),
  );
  assert.equal(
    evaluateRisk({ ...healthy, attendanceCount: 0 }, { closedWindowCount: 0, nowMs: NOW }).reasons.includes(
      'No workshop attendance',
    ),
    false,
  );
});
