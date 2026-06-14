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

test('happy path: valid role, account exists, target not admin, role changes → ok', () => {
  assert.equal(
    classifyRoleAssign({
      requestedRole: 'instructor',
      emailFound: true,
      currentRole: 'student',
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
      currentRole: 'admin',
    }),
    'invalid_role',
  );
  assert.equal(
    classifyRoleAssign({
      requestedRole: 'garbage',
      emailFound: false,
      currentRole: 'student',
    }),
    'invalid_role',
  );
});

test('unknown email → no_account (when requested role is valid)', () => {
  assert.equal(
    classifyRoleAssign({
      requestedRole: 'ta',
      emailFound: false,
      currentRole: 'student',
    }),
    'no_account',
  );
});

test('existing admin target cannot be modified', () => {
  assert.equal(
    classifyRoleAssign({
      requestedRole: 'student',
      emailFound: true,
      currentRole: 'admin',
    }),
    'cannot_modify_admin',
  );
});

test('same role requested → no_change (no UPDATE, no audit entry)', () => {
  assert.equal(
    classifyRoleAssign({
      requestedRole: 'instructor',
      emailFound: true,
      currentRole: 'instructor',
    }),
    'no_change',
  );
  assert.equal(
    classifyRoleAssign({
      requestedRole: 'student',
      emailFound: true,
      currentRole: 'student',
    }),
    'no_change',
  );
});

test('admin guard outranks the no_change check', () => {
  // currentRole 'admin' never reports no_change even though admin is not an
  // assignable requested value: the admin guard fires first.
  assert.equal(
    classifyRoleAssign({
      requestedRole: 'ta',
      emailFound: true,
      currentRole: 'admin',
    }),
    'cannot_modify_admin',
  );
});
