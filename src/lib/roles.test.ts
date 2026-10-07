import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isContentManager,
  isInstructor,
  isStaff,
  type UserRole,
} from './roles.ts';

// The TA role was retired on 2026-10-07. A stale 'ta' value (an old session or
// a database that has not been migrated yet) must never count as staff.
const RETIRED_TA = 'ta' as unknown as UserRole;

test('staff are instructors and admins only', () => {
  assert.equal(isStaff('instructor'), true);
  assert.equal(isStaff('admin'), true);
  assert.equal(isStaff('student'), false);
  assert.equal(isStaff(RETIRED_TA), false);
  assert.equal(isStaff(null), false);
  assert.equal(isStaff(undefined), false);
});

test('isContentManager: instructor and admin can manage, student cannot', () => {
  assert.equal(isContentManager('instructor'), true);
  assert.equal(isContentManager('admin'), true);
  assert.equal(isContentManager(RETIRED_TA), false);
  assert.equal(isContentManager('student'), false);
  assert.equal(isContentManager(null), false);
  assert.equal(isContentManager(undefined), false);
});

test('isInstructor: instructor and admin can mutate instructor-owned records', () => {
  assert.equal(isInstructor('instructor'), true);
  assert.equal(isInstructor('admin'), true);
  assert.equal(isInstructor(RETIRED_TA), false);
  assert.equal(isInstructor('student'), false);
});
