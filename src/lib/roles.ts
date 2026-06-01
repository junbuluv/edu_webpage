// Single source of truth for who counts as "staff" (can manage
// workshops, view rosters, take instructor actions). Keep this list in
// sync with the user_role enum in supabase/schema.sql and any RLS
// policies that gate on instructor authority.

export type UserRole = 'student' | 'instructor' | 'ta' | 'admin';

const STAFF_ROLES = new Set<UserRole>(['instructor', 'ta', 'admin']);
const ADMIN_ROLES = new Set<UserRole>(['admin']);

export function isStaff(role: UserRole | null | undefined): boolean {
  return role ? STAFF_ROLES.has(role) : false;
}

export function isAdmin(role: UserRole | null | undefined): boolean {
  return role ? ADMIN_ROLES.has(role) : false;
}

const CONTENT_MANAGER_ROLES = new Set<UserRole>(['instructor', 'admin']);

/**
 * Who may create/edit/delete instructor-managed content (archive videos and
 * papers): instructors and admins, but NOT TAs (TAs are read-only here).
 * Distinct from isStaff, which includes 'ta'.
 */
export function isContentManager(role: UserRole | null | undefined): boolean {
  return role ? CONTENT_MANAGER_ROLES.has(role) : false;
}

/** Human-readable label for the role, for instructor profiles and UI hints. */
export function roleLabel(role: UserRole | null | undefined): string {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'instructor':
      return 'Instructor';
    case 'ta':
      return 'Teaching Assistant';
    case 'student':
      return 'Student';
    default:
      return 'Guest';
  }
}
