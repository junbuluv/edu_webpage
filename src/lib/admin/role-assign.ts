// Pure, alias-free logic for the admin "set user role" action so it can be
// unit-tested under `node --test` (which doesn't resolve @lib/* aliases).
// See convention #3 in CLAUDE.md.

/**
 * Roles an admin may assign through the in-app UI. Deliberately excludes
 * 'admin': granting or revoking admin stays SQL-only so a compromised admin
 * account cannot mint new admins or lock out existing ones (see CONTRIBUTING
 * "Bootstrapping the first admin").
 */
export type AssignableRole = 'student' | 'instructor' | 'ta';

export const ASSIGNABLE_ROLES: readonly AssignableRole[] = [
  'student',
  'instructor',
  'ta',
];

export function isAssignableRole(role: string): role is AssignableRole {
  return (ASSIGNABLE_ROLES as readonly string[]).includes(role);
}

export type RoleAssignOutcome =
  | 'invalid_role'
  | 'no_account'
  | 'cannot_modify_admin'
  | 'ok';

/**
 * Decide the outcome of an attempted role assignment. Checks run cheapest
 * first: reject a non-assignable requested role before any account lookup,
 * then require the target account to exist, then refuse to touch an existing
 * admin.
 */
export function classifyRoleAssign(input: {
  requestedRole: string;
  emailFound: boolean;
  targetIsAdmin: boolean;
}): RoleAssignOutcome {
  if (!isAssignableRole(input.requestedRole)) return 'invalid_role';
  if (!input.emailFound) return 'no_account';
  if (input.targetIsAdmin) return 'cannot_modify_admin';
  return 'ok';
}
