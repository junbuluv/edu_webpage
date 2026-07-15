import type { APIRoute } from 'astro';
import { getAdminClient, listAllAuthUsers } from '@lib/supabase/admin';
import { isAdmin, isInstructor } from '@lib/roles';
import { isCourseSlug } from '@lib/courses';
import {
  canManageClass,
  hasActiveTeachingAssignment,
} from '@lib/instructor/class-access';
import { classifyEnroll } from '@lib/instructor/enroll-classify';
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
const err = (c: string, s: string, i: string, reason: string) =>
  redirect(c, s, i, `error=${encodeURIComponent(reason)}`);
const ok = (c: string, s: string, i: string, reason: string) =>
  redirect(c, s, i, `ok=${encodeURIComponent(reason)}`);

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
  const email = String(form.get('email') ?? '')
    .trim()
    .toLowerCase();
  const studentName = String(form.get('student_name') ?? '').trim() || null;
  const rawSection = String(form.get('section') ?? '').trim();
  const requestedInstructorId = String(form.get('instructor_id') ?? '').trim();
  const targetInstructorId = isAdmin(role) ? requestedInstructorId : user.id;

  // Build redirect targets defensively even on bad input.
  const fail = (reason: string) =>
    course && isCourseSlug(course)
      ? err(course, semester, targetInstructorId || user.id, reason)
      : new Response(null, {
          status: 303,
          headers: { Location: '/instructor/classes' },
        });

  if (
    !isCourseSlug(course) ||
    !semester ||
    semester.length > 64 ||
    !isUuid(targetInstructorId) ||
    !email ||
    email.length > 254 ||
    (studentName?.length ?? 0) > 120
  )
    return fail('invalid_input');
  if (!(await canManageClass(user.id, course, semester, role)))
    return fail('not_course_instructor');
  if (
    !(await hasActiveTeachingAssignment(targetInstructorId, course, semester))
  )
    return fail('invalid_instructor');
  const usesSections = COURSES_WITH_SECTIONS.has(course);
  let section: string | null = null;
  if (usesSections) {
    if (!SECTIONS.has(rawSection))
      return err(course, semester, targetInstructorId, 'invalid_section');
    section = rawSection;
  }

  // The admin client + auth-user listing can throw (missing service-role
  // env, transient auth-API failure). Degrade to a banner on the page
  // rather than a raw 500 that strands the instructor mid-form.
  let admin: ReturnType<typeof getAdminClient>;
  let userId: string | null;
  try {
    admin = getAdminClient();
    const users = await listAllAuthUsers();
    userId = users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
  } catch {
    return err(course, semester, targetInstructorId, 'lookup_failed');
  }

  let alreadyEnrolled = false;
  if (userId) {
    const { data } = await admin
      .from('enrollments')
      .select('user_id')
      .eq('user_id', userId)
      .eq('course_slug', course)
      .eq('semester', semester)
      .maybeSingle();
    alreadyEnrolled = !!data;
  }

  const outcome = classifyEnroll({ emailFound: !!userId, alreadyEnrolled });
  if (outcome === 'no_account')
    return err(course, semester, targetInstructorId, 'no_account');
  if (outcome === 'already_enrolled')
    return ok(course, semester, targetInstructorId, 'already_enrolled');

  const { data: enrolled, error } = await admin.rpc('mutate_enrollment', {
    p_actor_id: user.id,
    p_user_id: userId!,
    p_course_slug: course,
    p_semester: semester,
    p_instructor_id: targetInstructorId,
    p_student_name: studentName,
    p_section: section,
    p_operation: 'insert',
  });
  if (error?.code === '23505')
    return ok(course, semester, targetInstructorId, 'already_enrolled');
  if (error || !enrolled)
    return err(course, semester, targetInstructorId, 'insert_failed');

  await logDisclosureSafe({
    actorId: user.id,
    actorRole: role as 'instructor' | 'ta' | 'admin',
    action: 'manage_enrollment',
    targetUserId: userId!,
    targetResource: `enroll student in ${course} (${semester})`,
    metadata: {
      op: 'enroll',
      course,
      semester,
      instructorId: targetInstructorId,
    },
    request,
  });
  return ok(course, semester, targetInstructorId, 'enrolled');
};
