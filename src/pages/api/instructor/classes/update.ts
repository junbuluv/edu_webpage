import type { APIRoute } from 'astro';
import { getAdminClient } from '@lib/supabase/admin';
import { isStaff } from '@lib/roles';
import { isCourseSlug } from '@lib/courses';
import { instructorOwnsCourse } from '@lib/archive/access';
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

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  const role = locals.profile?.role ?? 'student';
  const form = await request.formData();
  const course = String(form.get('course_slug') ?? '');
  const semester = String(form.get('semester') ?? '');
  const userId = String(form.get('user_id') ?? '');
  const studentName = String(form.get('student_name') ?? '').trim() || null;
  const rawSection = String(form.get('section') ?? '').trim();

  const fail = (reason: string) =>
    course && isCourseSlug(course)
      ? redirect(course, semester, `error=${encodeURIComponent(reason)}`)
      : new Response(null, {
          status: 303,
          headers: { Location: '/instructor/classes' },
        });

  if (!user) return fail('unauthenticated');
  if (!isStaff(role)) return fail('forbidden');
  if (!isCourseSlug(course) || !semester || !userId)
    return fail('invalid_input');
  if (!(await instructorOwnsCourse(user.id, course, role)))
    return fail('not_course_instructor');

  let section: string | null = null;
  if (COURSES_WITH_SECTIONS.has(course) && rawSection) {
    if (!SECTIONS.has(rawSection)) return fail('invalid_section');
    section = rawSection;
  }

  const admin = getAdminClient();
  const { error } = await admin
    .from('enrollments')
    .update({ student_name: studentName, section })
    .eq('user_id', userId)
    .eq('course_slug', course)
    .eq('semester', semester);
  if (error) return fail('update_failed');

  await logDisclosureSafe({
    actorId: user.id,
    actorRole: role as 'instructor' | 'ta' | 'admin',
    action: 'manage_enrollment',
    targetUserId: userId,
    targetResource: `update student in ${course} (${semester})`,
    metadata: { op: 'update', course, semester },
    request,
  });
  return redirect(course, semester, 'ok=updated');
};
