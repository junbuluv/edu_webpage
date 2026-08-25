import { type CourseSlug } from '@lib/courses';
import { isAdmin, isInstructor, type UserRole } from '@lib/roles';
import { getAdminClient } from '@lib/supabase/admin';

export async function hasActiveTeachingAssignment(
  instructorId: string,
  course: CourseSlug,
  semester: string,
): Promise<boolean> {
  try {
    const { data, error } = await getAdminClient()
      .from('teaching_assignments')
      .select('instructor_id')
      .eq('instructor_id', instructorId)
      .eq('course_slug', course)
      .eq('semester', semester)
      .eq('active', true)
      .maybeSingle();
    return !error && data != null;
  } catch {
    return false;
  }
}

export async function canManageClass(
  userId: string,
  course: CourseSlug,
  semester: string,
  role: UserRole | null | undefined,
): Promise<boolean> {
  if (isAdmin(role)) return true;
  if (!isInstructor(role)) return false;

  return hasActiveTeachingAssignment(userId, course, semester);
}
