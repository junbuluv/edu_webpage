// Pure, alias-free validation for the role + student-ID fields on the signup
// form, so it can run under `node --test` (which doesn't resolve @lib/*).
//
// Picking a role at signup does NOT grant it. 'instructor' and 'ta' are
// recorded as a request in role_requests and stay inert until an admin
// approves; only 'student' is applied immediately (it is also the DB default).
// 'admin' is deliberately absent here and rejected by a CHECK constraint on
// role_requests, so a forged form value cannot escalate.

export type SignupRole = 'student' | 'instructor' | 'ta';

export const SIGNUP_ROLES: readonly SignupRole[] = [
  'student',
  'instructor',
  'ta',
];

/** Roles that require an admin decision before they take effect. */
export const STAFF_SIGNUP_ROLES: readonly SignupRole[] = ['instructor', 'ta'];

export function isSignupRole(value: string): value is SignupRole {
  return (SIGNUP_ROLES as readonly string[]).includes(value);
}

export function isStaffSignupRole(value: string): boolean {
  return (STAFF_SIGNUP_ROLES as readonly string[]).includes(value);
}

/**
 * Strip the decoration registrar exports carry so the same student always
 * hashes to the same value: Brightspace writes "#15113468", people type
 * "15113468" or "15-113-468".
 */
export function normalizeStudentId(raw: string): string {
  return raw.replace(/[\s#-]/g, '');
}

/**
 * CUNY EMPLIDs are 8 digits (verified against all 85 rows of the Fall 2026
 * FIN 3610 registrar export). Requiring the exact length catches the common
 * typo of a dropped or doubled digit, which a loose rule would silently
 * accept and then fail to match against the roster later.
 */
export function isValidStudentId(normalized: string): boolean {
  return /^\d{8}$/.test(normalized);
}

export type SignupOutcome =
  | 'ok'
  | 'invalid_role'
  | 'student_id_required'
  | 'student_id_invalid';

/**
 * Decide whether a signup submission is acceptable. Staff submissions ignore
 * any student ID that was left in the form (the field is hidden, not removed,
 * when a staff role is selected).
 */
export function classifySignup(input: {
  role: string;
  studentId: string;
}): SignupOutcome {
  if (!isSignupRole(input.role)) return 'invalid_role';
  if (isStaffSignupRole(input.role)) return 'ok';

  const normalized = normalizeStudentId(input.studentId);
  if (normalized.length === 0) return 'student_id_required';
  if (!isValidStudentId(normalized)) return 'student_id_invalid';
  return 'ok';
}

/** Last 4 digits for staff-facing display, e.g. "••••3468". */
export function maskStudentId(normalized: string): string {
  if (normalized.length <= 4) return normalized;
  return '••••' + normalized.slice(-4);
}
