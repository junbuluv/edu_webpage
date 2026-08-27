// Pure, alias-free logic for an admin acting on a staff-access request, so it
// can run under `node --test`. Mirrors role-assign.ts (convention #3).

export type RoleDecision = 'approve' | 'deny';

export function isRoleDecision(value: string): value is RoleDecision {
  return value === 'approve' || value === 'deny';
}

export type RoleDecisionOutcome =
  | 'ok'
  | 'invalid_decision'
  | 'not_found'
  | 'already_decided'
  | 'cannot_modify_admin';

/**
 * Decide whether an admin's approve/deny may proceed. Cheapest checks first:
 * reject a forged decision value, then require the request to exist, then
 * refuse to re-decide a settled request (so a double-submitted form or a
 * stale open tab cannot silently re-apply a role), and finally never touch an
 * existing admin — same anti-phishing guard as direct role assignment.
 */
export function classifyRoleDecision(input: {
  decision: string;
  exists: boolean;
  status: string;
  currentRole: string;
}): RoleDecisionOutcome {
  if (!isRoleDecision(input.decision)) return 'invalid_decision';
  if (!input.exists) return 'not_found';
  if (input.status !== 'pending') return 'already_decided';
  if (input.currentRole === 'admin') return 'cannot_modify_admin';
  return 'ok';
}
