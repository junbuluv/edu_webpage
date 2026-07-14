import { type CourseSlug } from '@lib/courses';
import { isAdmin, isInstructor, type UserRole } from '@lib/roles';
import { getAdminClient } from '@lib/supabase/admin';

export async function canManageClass(
  userId: string,
  course: CourseSlug,
  semester: string,
  role: UserRole | null | undefined,
  allowEmptyClass = false,
): Promise<boolean> {
  if (isAdmin(role)) return true;
  if (!isInstructor(role)) return false;

  try {
    const admin = getAdminClient();
    const { data: owned } = await admin
      .from('enrollments')
      .select('user_id')
      .eq('instructor_id', userId)
      .eq('course_slug', course)
      .eq('semester', semester)
      .limit(1);
    if ((owned ?? []).length > 0) return true;
    if (!allowEmptyClass) return false;

    const { data: existing } = await admin
      .from('enrollments')
      .select('user_id')
      .eq('course_slug', course)
      .eq('semester', semester)
      .limit(1);
    return (existing ?? []).length === 0;
  } catch {
    return false;
  }
}
