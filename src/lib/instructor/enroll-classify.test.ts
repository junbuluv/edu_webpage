import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyEnroll } from './enroll-classify.ts';

test('no account when email not found', () => {
  assert.equal(
    classifyEnroll({ emailFound: false, alreadyEnrolled: false }),
    'no_account',
  );
  assert.equal(
    classifyEnroll({ emailFound: false, alreadyEnrolled: true }),
    'no_account',
  );
});
test('already enrolled when found + existing row', () => {
  assert.equal(
    classifyEnroll({ emailFound: true, alreadyEnrolled: true }),
    'already_enrolled',
  );
});
test('ok when found + not enrolled', () => {
  assert.equal(
    classifyEnroll({ emailFound: true, alreadyEnrolled: false }),
    'ok',
  );
});
