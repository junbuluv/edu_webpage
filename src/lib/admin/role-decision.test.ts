import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyRoleDecision, isRoleDecision } from './role-decision.ts';

const base = {
  decision: 'approve',
  exists: true,
  status: 'pending',
  currentRole: 'student',
};

test('accepts only approve/deny', () => {
  assert.equal(isRoleDecision('approve'), true);
  assert.equal(isRoleDecision('deny'), true);
  assert.equal(isRoleDecision('promote'), false);
  assert.equal(
    classifyRoleDecision({ ...base, decision: 'promote' }),
    'invalid_decision',
  );
});

test('a pending request for a non-admin can be decided either way', () => {
  assert.equal(classifyRoleDecision(base), 'ok');
  assert.equal(classifyRoleDecision({ ...base, decision: 'deny' }), 'ok');
});

test('a missing request is not found', () => {
  assert.equal(classifyRoleDecision({ ...base, exists: false }), 'not_found');
});

test('a settled request cannot be re-decided', () => {
  // Guards the double-submit / stale-tab case: approving twice must not
  // silently re-apply a role that was later changed by hand.
  assert.equal(
    classifyRoleDecision({ ...base, status: 'approved' }),
    'already_decided',
  );
  assert.equal(
    classifyRoleDecision({ ...base, status: 'denied' }),
    'already_decided',
  );
});

test('an existing admin is never modified', () => {
  assert.equal(
    classifyRoleDecision({ ...base, currentRole: 'admin' }),
    'cannot_modify_admin',
  );
});
