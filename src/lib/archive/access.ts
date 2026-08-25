import { isStaff, isAdmin, isInstructor, type UserRole } from '@lib/roles';
import { getAdminClient } from '@lib/supabase/admin';
import { ArchiveServiceUnavailableError } from './errors';
import { hasAcceptedCurrentTerms } from '@lib/auth/terms';

/**
 * True iff the current viewer may see gated, course-scoped archive content
 * (past exams/assignments, etc.) for `courseSlug`: a signed-in user who is
 * either enrolled in the course or is staff (instructor/ta/admin).
 *
 * Centralizes the enrolled-or-staff check used by the archive pages, the
 * quiz viewer, and the grade API so the rule lives in one auditable place.
 * Fails closed: no user, or no Supabase (per CLAUDE.md #5), => false.
 */
export async function canViewCourse(
  locals: App.Locals,
  courseSlug: string,
): Promise<boolean> {
  const user = locals.user;
  if (!user) return false;
  if (!hasAcceptedCurrentTerms(locals.profile)) return false;
  if (isStaff(locals.profile?.role)) return true;
  const supabase = locals.supabase;
  if (!supabase) return false;
  // A student can have one enrollments row per semester for the same course,
  // so this may return >1 row. limit(1) + length check — .maybeSingle()
  // errors (PGRST116) on multiple rows, wrongly denying a re-enrolled student.
  const { data, error } = await supabase
    .from('enrollments')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('course_slug', courseSlug)
    .limit(1);
  if (error) {
    console.error('[archive] enrollment_access_check_failed', {
      code: error.code,
    });
    throw new ArchiveServiceUnavailableError('access_check');
  }
  return !!data && data.length > 0;
}

/**
 * True iff `userId` may manage content for `courseSlug`: an admin (any
 * course), or an instructor with an active assignment for at least one term
 * of that course. Authority is never inferred from student enrollment rows.
 * Fails closed on missing env / error.
 */
export async function instructorOwnsCourse(
  userId: string,
  courseSlug: string,
  role: UserRole | null | undefined,
): Promise<boolean> {
  if (isAdmin(role)) return true;
  if (!isInstructor(role)) return false;
  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('teaching_assignments')
      .select('instructor_id')
      .eq('instructor_id', userId)
      .eq('course_slug', courseSlug)
      .eq('active', true)
      .limit(1);
    if (error) {
      console.error('[archive] ownership_check_failed', { code: error.code });
      throw new ArchiveServiceUnavailableError('ownership_check');
    }
    return !!(data && data.length > 0);
  } catch (error) {
    if (error instanceof ArchiveServiceUnavailableError) throw error;
    console.error('[archive] ownership_check_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new ArchiveServiceUnavailableError('ownership_check');
  }
}
