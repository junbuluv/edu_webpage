// Run: node --test src/lib/tutor/remaining.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { remainingFromMessages } from './remaining.ts';

test('uses the latest server count on a finished reply', () => {
  const messages = [
    { role: 'user' },
    { role: 'assistant', metadata: { remaining: 12 } },
    { role: 'user' },
    { role: 'assistant', metadata: { remaining: 11 } },
  ];
  assert.equal(remainingFromMessages(messages, 40), 11);
});

test('falls back to the page count before any reply finishes', () => {
  assert.equal(remainingFromMessages([], 40), 40);
  assert.equal(
    remainingFromMessages([{ role: 'user' }, { role: 'assistant' }], 37),
    37,
  );
});

test('skips a reply that carries no count (e.g. aborted before it started)', () => {
  const messages = [
    { role: 'assistant', metadata: { remaining: 20 } },
    { role: 'user' },
    { role: 'assistant' },
  ];
  assert.equal(remainingFromMessages(messages, 40), 20);
});

test('ignores malformed counts and never goes below zero', () => {
  assert.equal(
    remainingFromMessages(
      [{ role: 'assistant', metadata: { remaining: 'lots' } }],
      9,
    ),
    9,
  );
  assert.equal(
    remainingFromMessages(
      [{ role: 'assistant', metadata: { remaining: -3 } }],
      9,
    ),
    0,
  );
  assert.equal(
    remainingFromMessages([{ role: 'user', metadata: { remaining: 2 } }], 9),
    9,
  );
});
