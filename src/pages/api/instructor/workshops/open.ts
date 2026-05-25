import type { APIRoute } from 'astro';
import { getAdminClient } from '@lib/supabase/admin';
import { isStaff } from '@lib/roles';

// Open a new workshop_administrations row for one section in one week.
// Instructor only. Posted as form data (so the page's plain <form>
// submission works without JS).

const SECTIONS = new Set(['CML', 'CTL', 'CWL', 'CRL']);
const BARUCH_55_LEX = { lat: 40.7411, lng: -73.9837 };

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  const role = locals.profile?.role ?? 'student';
  if (!user) return redirectBack(request, 'unauthenticated');
  if (!isStaff(role)) {
    return redirectBack(request, 'forbidden');
  }

  const form = await request.formData();
  const workshopSlug = String(form.get('workshop_slug') ?? '');
  const courseSlug = String(form.get('course_slug') ?? '');
  const section = String(form.get('section') ?? '');
  const weekOf = String(form.get('week_of') ?? '');
  const opensAt = String(form.get('opens_at') ?? '');
  const closesAt = String(form.get('closes_at') ?? '');
  const radius = Number(form.get('required_radius_meters') ?? 200);
  const notes = String(form.get('notes') ?? '').trim() || null;

  if (!workshopSlug || !courseSlug || !SECTIONS.has(section) || !weekOf || !opensAt || !closesAt) {
    return redirectBack(request, 'invalid_input');
  }

  // Admin role: must be instructor for this course in some enrollment row.
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
  const { error } = await admin.from('workshop_administrations').insert({
    workshop_slug: workshopSlug,
    course_slug: courseSlug,
    section: section as 'CML' | 'CTL' | 'CWL' | 'CRL',
    week_of: weekOf,
    instructor_id: user.id,
    opens_at: new Date(opensAt).toISOString(),
    closes_at: new Date(closesAt).toISOString(),
    required_lat: BARUCH_55_LEX.lat,
    required_lng: BARUCH_55_LEX.lng,
    required_radius_meters: Number.isFinite(radius) ? Math.max(10, Math.floor(radius)) : 200,
    notes,
  });

  if (error) {
    // Most common: 23505 unique violation on (workshop_slug, section, week_of)
    const reason = error.code === '23505' ? 'already_opened' : 'insert_failed';
    return redirectBack(request, reason, error.message);
  }

  return new Response(null, {
    status: 303,
    headers: { Location: `/instructor/workshops/${workshopSlug}?ok=opened` },
  });
};

function redirectBack(request: Request, reason: string, detail?: string): Response {
  const url = new URL(request.url);
  // Extract slug from form value to redirect to the right page.
  // Falls back to the index if we can't tell.
  return new Response(null, {
    status: 303,
    headers: {
      Location: `${url.pathname}?error=${encodeURIComponent(reason)}${detail ? `&detail=${encodeURIComponent(detail)}` : ''}`,
    },
  });
}
