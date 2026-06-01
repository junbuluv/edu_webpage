import { isStaff, isAdmin } from '@lib/roles';
import { getAdminClient } from '@lib/supabase/admin';

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
  if (isStaff(locals.profile?.role)) return true;
  const supabase = locals.supabase;
  if (!supabase) return false;
  const { data } = await supabase
    .from('enrollments')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('course_slug', courseSlug)
    .maybeSingle();
  return !!data;
}

/**
 * True iff `userId` may manage content for `courseSlug`: an admin (any
 * course), or an instructor listed as instructor_id on some enrollment row
 * for that course. Uses the service-role admin client (enrollments are not
 * readable under a normal client for arbitrary users). Fails closed on
 * missing env / error.
 */
export async function instructorOwnsCourse(
  userId: string,
  courseSlug: string,
  role: string | null | undefined,
): Promise<boolean> {
  if (isAdmin(role as never)) return true;
  try {
    const admin = getAdminClient();
    // An instructor has one enrollments row per enrolled student, so this
    // query returns MANY rows for a real class. Use limit(1) + array check —
    // .maybeSingle() errors (PGRST116) on >1 row, which would wrongly deny
    // ownership for any course with two or more students.
    const { data } = await admin
      .from('enrollments')
      .select('user_id')
      .eq('instructor_id', userId)
      .eq('course_slug', courseSlug)
      .limit(1);
    return !!(data && data.length > 0);
  } catch {
    return false;
  }
}
