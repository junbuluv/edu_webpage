import type { CourseSlug } from '@lib/courses';
import { getAdminClient } from '@lib/supabase/admin';

export interface EnrollmentScope {
  semester: string;
  instructorId: string;
}

/** Resolve the one explicitly active offering for a student's write. */
export async function resolveEnrollmentScope(
  userId: string,
  course: CourseSlug,
): Promise<EnrollmentScope | null> {
  const { data, error } = await getAdminClient().rpc(
    'resolve_current_enrollment_scope',
    {
      p_user_id: userId,
      p_course_slug: course,
    },
  );

  if (error)
    throw new Error(`enrollment scope lookup failed: ${error.message}`);
  const row = data?.[0];
  return row
    ? { semester: row.semester, instructorId: row.instructor_id }
    : null;
}
