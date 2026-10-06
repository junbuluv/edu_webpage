// Run: node --test src/lib/tutor/errors.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyStreamError,
  isRetryable,
  parseTutorError,
  TUTOR_ERROR_COPY,
} from './errors.ts';

test('402 anywhere in the cause chain means budget', () => {
  assert.equal(classifyStreamError({ statusCode: 402 }), 'budget_exhausted');
  assert.equal(
    classifyStreamError({ message: 'wrapped', cause: { statusCode: 402 } }),
    'budget_exhausted',
  );
});

test('budget rejection surfacing as a 500-class SDK error', () => {
  const err = Object.assign(new Error('Gateway error'), {
    name: 'GatewayInternalServerError',
    statusCode: 500,
    cause: {
      message: 'Project budget exceeded. type: quota_for_entity_exceeded',
    },
  });
  assert.equal(classifyStreamError(err), 'budget_exhausted');
});

test('other failures are generic', () => {
  assert.equal(classifyStreamError(new Error('socket hang up')), 'unavailable');
  assert.equal(classifyStreamError(undefined), 'unavailable');
});

test('parses JSON error bodies from the route', () => {
  assert.equal(parseTutorError('{"error":"rate_limited"}'), 'rate_limited');
  assert.equal(parseTutorError('{"error":"forbidden"}'), 'forbidden');
  assert.equal(parseTutorError('{"error":"unauthorized"}'), 'forbidden');
  assert.equal(parseTutorError('{"error":"tutor_unavailable"}'), 'unavailable');
});

test('parses the middleware terms response', () => {
  assert.equal(
    parseTutorError('{"ok":false,"reason":"terms_acceptance_required"}'),
    'terms_required',
  );
});

test('parses bare codes and junk safely', () => {
  assert.equal(parseTutorError('budget_exhausted'), 'budget_exhausted');
  assert.equal(parseTutorError('Request body is too large.'), 'unavailable');
  assert.equal(parseTutorError('null'), 'unavailable');
  assert.equal(parseTutorError('__proto__'), 'unavailable');
  assert.equal(parseTutorError(undefined), 'unavailable');
});

test('copy has no em dashes and only unavailable is retryable', () => {
  for (const text of Object.values(TUTOR_ERROR_COPY)) {
    assert.ok(!text.includes('—'));
  }
  assert.ok(TUTOR_ERROR_COPY.rate_limited.includes('40'));
  assert.equal(isRetryable('unavailable'), true);
  assert.equal(isRetryable('rate_limited'), false);
  assert.equal(isRetryable('budget_exhausted'), false);
});
