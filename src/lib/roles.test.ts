import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isContentManager, isInstructor } from './roles.ts';

test('isContentManager: instructor and admin can manage, ta and student cannot', () => {
  assert.equal(isContentManager('instructor'), true);
  assert.equal(isContentManager('admin'), true);
  assert.equal(isContentManager('ta'), false);
  assert.equal(isContentManager('student'), false);
  assert.equal(isContentManager(null), false);
  assert.equal(isContentManager(undefined), false);
});

test('isInstructor: instructor and admin can mutate instructor-owned records', () => {
  assert.equal(isInstructor('instructor'), true);
  assert.equal(isInstructor('admin'), true);
  assert.equal(isInstructor('ta'), false);
  assert.equal(isInstructor('student'), false);
});
