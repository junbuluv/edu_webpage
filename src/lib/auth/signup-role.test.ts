import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifySignup,
  isSignupRole,
  isStaffSignupRole,
  isValidStudentId,
  maskStudentId,
  normalizeStudentId,
} from './signup-role.ts';

test('admin is never a selectable signup role', () => {
  assert.equal(isSignupRole('admin'), false);
  assert.equal(
    classifySignup({ role: 'admin', studentId: '' }),
    'invalid_role',
  );
  for (const role of ['student', 'instructor', 'ta']) {
    assert.equal(isSignupRole(role), true);
  }
});

test('staff roles are the ones needing approval', () => {
  assert.equal(isStaffSignupRole('instructor'), true);
  assert.equal(isStaffSignupRole('ta'), true);
  assert.equal(isStaffSignupRole('student'), false);
});

test('normalizes the shapes a student ID actually arrives in', () => {
  // Brightspace export, hand-typed, and dash/space separated all agree.
  assert.equal(normalizeStudentId('#15113468'), '15113468');
  assert.equal(normalizeStudentId(' 15113468 '), '15113468');
  assert.equal(normalizeStudentId('15-113-468'), '15113468');
  assert.equal(normalizeStudentId('15 113 468'), '15113468');
});

test('accepts exactly 8 digits, rejects near misses', () => {
  assert.equal(isValidStudentId('15113468'), true);
  assert.equal(isValidStudentId('1511346'), false); // dropped a digit
  assert.equal(isValidStudentId('151134689'), false); // doubled a digit
  assert.equal(isValidStudentId('1511346a'), false); // letter
  assert.equal(isValidStudentId(''), false);
});

test('students must supply a valid student ID', () => {
  assert.equal(
    classifySignup({ role: 'student', studentId: '#15113468' }),
    'ok',
  );
  assert.equal(
    classifySignup({ role: 'student', studentId: '  ' }),
    'student_id_required',
  );
  assert.equal(
    classifySignup({ role: 'student', studentId: '1234' }),
    'student_id_invalid',
  );
});

test('a student ID left in the form is ignored for staff signups', () => {
  // The field is hidden by script, not removed, so it can still be submitted.
  assert.equal(classifySignup({ role: 'ta', studentId: 'garbage' }), 'ok');
  assert.equal(classifySignup({ role: 'instructor', studentId: '' }), 'ok');
});

test('masking reveals only the last four digits', () => {
  assert.equal(maskStudentId('15113468'), '••••3468');
  assert.equal(maskStudentId('123'), '123');
});
