// Single source of truth for staff identity. Three roles since the TA role was
// retired on 2026-10-07: staff means instructor or admin. What an instructor
// may manage is narrowed further by admin-granted teaching assignments (see
// src/lib/instructor/class-access.ts). Keep these sets in sync with the
// user_role enum and the corresponding RLS policies.

export type UserRole = 'student' | 'instructor' | 'admin';

const STAFF_ROLES = new Set<UserRole>(['instructor', 'admin']);
const ADMIN_ROLES = new Set<UserRole>(['admin']);

export function isStaff(role: UserRole | null | undefined): boolean {
  return role ? STAFF_ROLES.has(role) : false;
}

export function isAdmin(role: UserRole | null | undefined): boolean {
  return role ? ADMIN_ROLES.has(role) : false;
}

/** Human-readable label for the role, for instructor profiles and UI hints. */
export function roleLabel(role: UserRole | null | undefined): string {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'instructor':
      return 'Instructor';
    case 'student':
      return 'Student';
    default:
      return 'Guest';
  }
}
