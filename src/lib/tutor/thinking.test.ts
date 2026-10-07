// Run: node --test src/lib/tutor/thinking.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { awaitingFirstWords } from './thinking.ts';

const user = { role: 'user', parts: [{ type: 'text', text: 'Why?' }] };

test('thinking while the request is out', () => {
  assert.equal(awaitingFirstWords('submitted', [user]), true);
});

test('still thinking after the stream starts but before any words', () => {
  const started = { role: 'assistant', parts: [{ type: 'step-start' }] };
  assert.equal(awaitingFirstWords('streaming', [user, started]), true);
  assert.equal(awaitingFirstWords('streaming', [user]), true);
  const blank = { role: 'assistant', parts: [{ type: 'text', text: '  ' }] };
  assert.equal(awaitingFirstWords('streaming', [user, blank]), true);
});

test('stops once words arrive or the exchange ends', () => {
  const words = { role: 'assistant', parts: [{ type: 'text', text: 'Start' }] };
  assert.equal(awaitingFirstWords('streaming', [user, words]), false);
  assert.equal(awaitingFirstWords('ready', [user, words]), false);
  assert.equal(awaitingFirstWords('error', [user]), false);
});
