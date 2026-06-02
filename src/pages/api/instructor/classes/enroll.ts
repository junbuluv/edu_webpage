import type { APIRoute } from 'astro';
import { getAdminClient, listAllAuthUsers } from '@lib/supabase/admin';
import { isStaff } from '@lib/roles';
import { isCourseSlug } from '@lib/courses';
import { instructorOwnsCourse } from '@lib/archive/access';
import { classifyEnroll } from '@lib/instructor/enroll-classify';
import { logDisclosureSafe } from '@lib/audit';

const SECTIONS = new Set(['CML', 'CTL', 'CWL', 'CRL']);
const COURSES_WITH_SECTIONS = new Set(['eco-1002']);

function redirect(course: string, semester: string, qs: string): Response {
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/instructor/classes/${course}?semester=${encodeURIComponent(semester)}&${qs}`,
    },
  });
}
const err = (c: string, s: string, reason: string) =>
  redirect(c, s, `error=${encodeURIComponent(reason)}`);
const ok = (c: string, s: string, reason: string) =>
  redirect(c, s, `ok=${encodeURIComponent(reason)}`);

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  const role = locals.profile?.role ?? 'student';

  const form = await request.formData();
  const course = String(form.get('course_slug') ?? '');
  const semester = String(form.get('semester') ?? '');
  const email = String(form.get('email') ?? '')
    .trim()
    .toLowerCase();
  const studentName = String(form.get('student_name') ?? '').trim() || null;
  const rawSection = String(form.get('section') ?? '').trim();

  // Build redirect targets defensively even on bad input.
  const fail = (reason: string) =>
    course && isCourseSlug(course)
      ? err(course, semester, reason)
      : new Response(null, {
          status: 303,
          headers: { Location: '/instructor/classes' },
        });

  if (!user) return fail('unauthenticated');
  if (!isStaff(role)) return fail('forbidden');
  if (!isCourseSlug(course) || !semester) return fail('invalid_input');
  if (!(await instructorOwnsCourse(user.id, course, role)))
    return fail('not_course_instructor');
  if (!email) return fail('invalid_input');

  const usesSections = COURSES_WITH_SECTIONS.has(course);
  let section: string | null = null;
  if (usesSections && rawSection) {
    if (!SECTIONS.has(rawSection))
      return err(course, semester, 'invalid_section');
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
    return err(course, semester, 'lookup_failed');
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
  if (outcome === 'no_account') return err(course, semester, 'no_account');
  if (outcome === 'already_enrolled')
    return ok(course, semester, 'already_enrolled');

  const { error } = await admin.from('enrollments').insert({
    user_id: userId!,
    course_slug: course,
    semester,
    instructor_id: user.id,
    student_name: studentName,
    section,
  });
  if (error) return err(course, semester, 'insert_failed');

  await logDisclosureSafe({
    actorId: user.id,
    actorRole: role as 'instructor' | 'ta' | 'admin',
    action: 'manage_enrollment',
    targetUserId: userId!,
    targetResource: `enroll student in ${course} (${semester})`,
    metadata: { op: 'enroll', course, semester },
    request,
  });
  return ok(course, semester, 'enrolled');
};
