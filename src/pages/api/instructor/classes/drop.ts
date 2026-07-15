import type { APIRoute } from 'astro';
import { getAdminClient } from '@lib/supabase/admin';
import { isAdmin, isInstructor } from '@lib/roles';
import { isCourseSlug } from '@lib/courses';
import { canManageClass } from '@lib/instructor/class-access';
import { logDisclosureSafe } from '@lib/audit';
import { isUuid } from '@lib/workshop-policy';

function redirect(
  course: string,
  semester: string,
  instructorId: string,
  qs: string,
): Response {
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/instructor/classes/${course}?semester=${encodeURIComponent(semester)}&instructor=${encodeURIComponent(instructorId)}&${qs}`,
    },
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  const role = locals.profile?.role ?? 'student';
  if (!user) {
    return new Response(null, {
      status: 303,
      headers: { Location: '/auth/signin?next=/instructor/classes' },
    });
  }
  if (!isInstructor(role)) {
    return new Response(null, { status: 303, headers: { Location: '/' } });
  }
  const form = await request.formData();
  const course = String(form.get('course_slug') ?? '');
  const semester = String(form.get('semester') ?? '');
  const userId = String(form.get('user_id') ?? '');
  const requestedInstructorId = String(form.get('instructor_id') ?? '');
  const targetInstructorId = isAdmin(role) ? requestedInstructorId : user.id;

  const fail = (reason: string) =>
    course && isCourseSlug(course)
      ? redirect(
          course,
          semester,
          targetInstructorId || user.id,
          `error=${encodeURIComponent(reason)}`,
        )
      : new Response(null, {
          status: 303,
          headers: { Location: '/instructor/classes' },
        });

  if (
    !isCourseSlug(course) ||
    !semester ||
    semester.length > 64 ||
    !isUuid(userId) ||
    !isUuid(targetInstructorId)
  )
    return fail('invalid_input');
  if (!(await canManageClass(user.id, course, semester, role)))
    return fail('not_course_instructor');

  const admin = getAdminClient();
  const { data, error } = await admin.rpc('mutate_enrollment', {
    p_actor_id: user.id,
    p_user_id: userId,
    p_course_slug: course,
    p_semester: semester,
    p_instructor_id: targetInstructorId,
    p_student_name: null,
    p_section: null,
    p_operation: 'delete',
  });
  if (error) return fail('delete_failed');
  if (!data) return fail('not_found');

  await logDisclosureSafe({
    actorId: user.id,
    actorRole: role as 'instructor' | 'ta' | 'admin',
    action: 'manage_enrollment',
    targetUserId: userId,
    targetResource: `drop student from ${course} (${semester})`,
    metadata: {
      op: 'drop',
      course,
      semester,
      instructorId: targetInstructorId,
    },
    request,
  });
  return redirect(course, semester, targetInstructorId, 'ok=dropped');
};
