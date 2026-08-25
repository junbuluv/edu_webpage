import type { APIRoute } from 'astro';
import { getAdminClient } from '@lib/supabase/admin';
import { isAdmin, isInstructor } from '@lib/roles';
import { isCourseSlug } from '@lib/courses';
import {
  canManageClass,
  hasActiveTeachingAssignment,
} from '@lib/instructor/class-access';
import { logDisclosureSafe } from '@lib/audit';
import { isUuid } from '@lib/workshop-policy';

const SECTIONS = new Set(['CML', 'CTL', 'CWL', 'CRL']);
const COURSES_WITH_SECTIONS = new Set(['eco-1002']);

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
  const studentName = String(form.get('student_name') ?? '').trim() || null;
  const rawSection = String(form.get('section') ?? '').trim();
  const requestedInstructorId = String(form.get('instructor_id') ?? '');
  const currentInstructorId = isAdmin(role) ? requestedInstructorId : user.id;
  const requestedNewInstructorId = String(form.get('new_instructor_id') ?? '');
  const newInstructorId =
    isAdmin(role) && requestedNewInstructorId
      ? requestedNewInstructorId
      : currentInstructorId;

  const fail = (reason: string) =>
    course && isCourseSlug(course)
      ? redirect(
          course,
          semester,
          currentInstructorId || user.id,
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
    !isUuid(currentInstructorId) ||
    !isUuid(newInstructorId) ||
    (studentName?.length ?? 0) > 120
  )
    return fail('invalid_input');
  if (!(await canManageClass(user.id, course, semester, role)))
    return fail('not_course_instructor');
  if (
    newInstructorId !== currentInstructorId &&
    !(await hasActiveTeachingAssignment(newInstructorId, course, semester))
  )
    return fail('invalid_instructor');

  let section: string | null = null;
  if (COURSES_WITH_SECTIONS.has(course)) {
    if (!SECTIONS.has(rawSection)) return fail('invalid_section');
    section = rawSection;
  }

  const admin = getAdminClient();
  if (newInstructorId !== currentInstructorId) {
    const { data: transferred, error } = await admin.rpc(
      'transfer_enrollment_scope',
      {
        p_actor_id: user.id,
        p_user_id: userId,
        p_course_slug: course,
        p_semester: semester,
        p_current_instructor_id: currentInstructorId,
        p_new_instructor_id: newInstructorId,
        p_student_name: studentName,
        p_section: section,
      },
    );
    if (error) return fail('update_failed');
    if (!transferred) return fail('not_found');
  } else {
    const { data, error } = await admin.rpc('mutate_enrollment', {
      p_actor_id: user.id,
      p_user_id: userId,
      p_course_slug: course,
      p_semester: semester,
      p_instructor_id: currentInstructorId,
      p_student_name: studentName,
      p_section: section,
      p_operation: 'update',
    });
    if (error) return fail('update_failed');
    if (!data) return fail('not_found');
  }

  await logDisclosureSafe({
    actorId: user.id,
    actorRole: role as 'instructor' | 'ta' | 'admin',
    action: 'manage_enrollment',
    targetUserId: userId,
    targetResource: `update student in ${course} (${semester})`,
    metadata: {
      op: 'update',
      course,
      semester,
      fromInstructorId: currentInstructorId,
      toInstructorId: newInstructorId,
    },
    request,
  });
  return redirect(course, semester, newInstructorId, 'ok=updated');
};
