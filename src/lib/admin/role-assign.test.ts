import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyRoleAssign,
  isAssignableRole,
  ASSIGNABLE_ROLES,
} from './role-assign.ts';

test('isAssignableRole accepts the three assignable roles, rejects admin/garbage', () => {
  assert.deepEqual([...ASSIGNABLE_ROLES], ['student', 'instructor', 'ta']);
  assert.ok(isAssignableRole('student'));
  assert.ok(isAssignableRole('instructor'));
  assert.ok(isAssignableRole('ta'));
  assert.ok(!isAssignableRole('admin'));
  assert.ok(!isAssignableRole(''));
  assert.ok(!isAssignableRole('superuser'));
});

test('happy path: valid role, account exists, target not admin → ok', () => {
  assert.equal(
    classifyRoleAssign({
      requestedRole: 'instructor',
      emailFound: true,
      targetIsAdmin: false,
    }),
    'ok',
  );
});

test("requesting 'admin' is rejected as invalid_role before anything else", () => {
  // Even with a found, admin target, the invalid requested role wins.
  assert.equal(
    classifyRoleAssign({
      requestedRole: 'admin',
      emailFound: true,
      targetIsAdmin: true,
    }),
    'invalid_role',
  );
  assert.equal(
    classifyRoleAssign({
      requestedRole: 'garbage',
      emailFound: false,
      targetIsAdmin: false,
    }),
    'invalid_role',
  );
});

test('unknown email → no_account (when requested role is valid)', () => {
  assert.equal(
    classifyRoleAssign({
      requestedRole: 'ta',
      emailFound: false,
      targetIsAdmin: false,
    }),
    'no_account',
  );
});

test('existing admin target cannot be modified', () => {
  assert.equal(
    classifyRoleAssign({
      requestedRole: 'student',
      emailFound: true,
      targetIsAdmin: true,
    }),
    'cannot_modify_admin',
  );
});
