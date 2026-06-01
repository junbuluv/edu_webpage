import { isStaff } from '@lib/roles';

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
