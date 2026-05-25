import type { APIRoute } from 'astro';
import { getAdminClient } from '@lib/supabase/admin';
import { isStaff } from '@lib/roles';

// Open a new exam_administrations row for one exam in one semester.
// Mirrors /api/instructor/workshops/open. Posted as form data so the
// page's plain <form> works without JS.

const BARUCH_55_LEX = { lat: 40.7411, lng: -73.9837 };

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  const role = locals.profile?.role ?? 'student';
  if (!user) return redirectBack(request, 'unauthenticated');
  if (!isStaff(role)) return redirectBack(request, 'forbidden');

  const form = await request.formData();
  const examSlug = String(form.get('exam_slug') ?? '');
  const courseSlug = String(form.get('course_slug') ?? '');
  const semester = String(form.get('semester') ?? '').trim();
  const opensAt = String(form.get('opens_at') ?? '');
  const closesAt = String(form.get('closes_at') ?? '');
  const duration = Number(form.get('duration_minutes') ?? 60);
  const radius = Number(form.get('required_radius_meters') ?? 200);
  const notes = String(form.get('notes') ?? '').trim() || null;

  if (!examSlug || !courseSlug || !semester || !opensAt || !closesAt) {
    return redirectBack(request, 'invalid_input');
  }

  // Course-instructor scope: instructors must teach the course (enrollments
  // row with instructor_id = self). TAs and admins bypass.
  if (role === 'instructor') {
    const adminClient = getAdminClient();
    const { data: enr } = await adminClient
      .from('enrollments')
      .select('user_id')
      .eq('instructor_id', user.id)
      .eq('course_slug', courseSlug)
      .maybeSingle();
    if (!enr) return redirectBack(request, 'not_course_instructor');
  }

  const admin = getAdminClient();
  const { error } = await admin.from('exam_administrations').insert({
    exam_slug: examSlug,
    course_slug: courseSlug,
    semester,
    instructor_id: user.id,
    opens_at: new Date(opensAt).toISOString(),
    closes_at: new Date(closesAt).toISOString(),
    required_lat: BARUCH_55_LEX.lat,
    required_lng: BARUCH_55_LEX.lng,
    required_radius_meters: Number.isFinite(radius) ? Math.max(10, Math.floor(radius)) : 200,
    duration_minutes: Number.isFinite(duration) ? Math.max(5, Math.floor(duration)) : 60,
    notes,
  });

  if (error) {
    return redirectBack(request, 'insert_failed', error.message);
  }

  return new Response(null, {
    status: 303,
    headers: { Location: `/instructor/exams/${examSlug}?ok=opened` },
  });
};

function redirectBack(request: Request, reason: string, detail?: string): Response {
  const url = new URL(request.url);
  return new Response(null, {
    status: 303,
    headers: {
      Location: `${url.pathname}?error=${encodeURIComponent(reason)}${detail ? `&detail=${encodeURIComponent(detail)}` : ''}`,
    },
  });
}
