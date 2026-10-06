// Run: node --test src/lib/tutor/provider-options.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTutorEffort, providerOptionsFor } from './provider-options.ts';

test('OpenAI models get reasoningEffort', () => {
  assert.deepEqual(providerOptionsFor('openai/gpt-6-luna', 'low'), {
    openai: { reasoningEffort: 'low' },
  });
});

test('other providers run with their defaults', () => {
  assert.deepEqual(
    providerOptionsFor('anthropic/claude-haiku-4.5', 'medium'),
    {},
  );
});

test('effort parsing defaults to low', () => {
  assert.equal(parseTutorEffort(undefined), 'low');
  assert.equal(parseTutorEffort(''), 'low');
  assert.equal(parseTutorEffort('medium'), 'medium');
  assert.equal(parseTutorEffort('max'), 'low');
});
