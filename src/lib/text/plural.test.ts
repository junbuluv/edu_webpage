// Run: node --test src/lib/text/plural.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pluralize } from './plural.ts';

test('singular only for exactly one', () => {
  assert.equal(pluralize(1, 'workshop'), 'workshop');
  assert.equal(pluralize(0, 'workshop'), 'workshops');
  assert.equal(pluralize(6, 'workshop'), 'workshops');
});

test('takes an explicit plural form', () => {
  assert.equal(pluralize(2, 'quiz', 'quizzes'), 'quizzes');
  assert.equal(pluralize(1, 'quiz', 'quizzes'), 'quiz');
});
