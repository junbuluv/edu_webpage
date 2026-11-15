import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canSwapAgain,
  TIMER_SLACK_MS,
  TYPING_RUN_LIMIT_MS,
} from './typing-limit.ts';

// TypingVerb.astro timing.
const timing = { typeMs: 70, deleteMs: 35, holdMs: 1000 };
const planned = TYPING_RUN_LIMIT_MS - TIMER_SLACK_MS;

// Replays TypingVerb.astro's schedule: swap while the next swap still fits.
function settle(verbs: string[]) {
  let elapsed = 0;
  let i = 0;
  while (
    i < verbs.length - 1 &&
    canSwapAgain(elapsed, verbs[i].length, verbs[i + 1].length, timing)
  ) {
    elapsed +=
      timing.holdMs +
      verbs[i].length * timing.deleteMs +
      verbs[i + 1].length * timing.typeMs;
    i += 1;
  }
  return { elapsed, word: verbs[i] };
}

test('the home headline settles within 5 seconds', () => {
  const run = settle([
    'play with',
    'explore',
    'tinker with',
    'simulate',
    'visualize',
  ]);
  assert.ok(run.elapsed <= planned, `ran ${run.elapsed} ms`);
  assert.equal(run.word, 'tinker with');
});

test('a swap that would end after the limit is refused', () => {
  assert.equal(canSwapAgain(4000, 9, 7, timing), false);
  assert.equal(canSwapAgain(0, 9, 7, timing), true);
});

test('any word list settles, however long', () => {
  const run = settle(Array.from({ length: 50 }, () => 'explore'));
  assert.ok(run.elapsed <= planned);
});
