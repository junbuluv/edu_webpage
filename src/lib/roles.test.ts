import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAdmin, isStaff, type UserRole } from './roles.ts';

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

test('only admins are admins', () => {
  assert.equal(isAdmin('admin'), true);
  assert.equal(isAdmin('instructor'), false);
  assert.equal(isAdmin('student'), false);
  assert.equal(isAdmin(RETIRED_TA), false);
});
