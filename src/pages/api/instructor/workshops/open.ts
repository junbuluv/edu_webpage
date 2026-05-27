import type { APIRoute } from 'astro';
import { getAdminClient } from '@lib/supabase/admin';
import { isStaff } from '@lib/roles';

// Open a new workshop_administrations row for one workshop window.
// Instructor only. Posted as form data (so the page's plain <form>
// submission works without JS).
//
// ECO 1002 runs four per-day sections (CML/CTL/CWL/CRL); the form sends
// `section` and we store it. FIN 3610 has no per-day sections; the form
// omits `section` and we store NULL. The DB has partial unique indexes
// keyed on either (workshop_slug, section, week_of) or
// (workshop_slug, week_of) depending on whether section is set.

const SECTIONS = new Set(['CML', 'CTL', 'CWL', 'CRL']);
const COURSES_WITH_SECTIONS = new Set(['eco-1002']);
const BARUCH_55_LEX = { lat: 40.7411, lng: -73.9837 };

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  const role = locals.profile?.role ?? 'student';

  // Parse the form up front so we have workshopSlug available for error
  // redirects below — without it we'd have to bounce errors back to the
  // API URL itself, which has no GET handler and would 404.
  const form = await request.formData();
  const workshopSlug = String(form.get('workshop_slug') ?? '');
  const courseSlug = String(form.get('course_slug') ?? '');
  const rawSection = String(form.get('section') ?? '');
  const weekOf = String(form.get('week_of') ?? '');
  const opensAt = String(form.get('opens_at') ?? '');
  const closesAt = String(form.get('closes_at') ?? '');
  const radius = Number(form.get('required_radius_meters') ?? 200);
  const notes = String(form.get('notes') ?? '').trim() || null;

  if (!user) return errorRedirect(workshopSlug, 'unauthenticated');
  if (!isStaff(role)) return errorRedirect(workshopSlug, 'forbidden');

  if (!workshopSlug || !courseSlug || !weekOf || !opensAt || !closesAt) {
    return errorRedirect(workshopSlug, 'invalid_input');
  }

  const courseUsesSections = COURSES_WITH_SECTIONS.has(courseSlug);
  const section: 'CML' | 'CTL' | 'CWL' | 'CRL' | null = courseUsesSections
    ? (SECTIONS.has(rawSection) ? (rawSection as 'CML' | 'CTL' | 'CWL' | 'CRL') : null)
    : null;
  if (courseUsesSections && section == null) {
    return errorRedirect(workshopSlug, 'invalid_input');
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
    if (!enr) return errorRedirect(workshopSlug, 'not_course_instructor');
  }

  const admin = getAdminClient();
  const { error } = await admin.from('workshop_administrations').insert({
    workshop_slug: workshopSlug,
    course_slug: courseSlug,
    section,
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
    // 23505 unique violation on whichever partial index applies (with-section
    // for ECO; no-section for FIN).
    const reason = error.code === '23505' ? 'already_opened' : 'insert_failed';
    return errorRedirect(workshopSlug, reason, error.message);
  }

  return new Response(null, {
    status: 303,
    headers: { Location: `/instructor/workshops/${workshopSlug}?ok=opened` },
  });
};

// Redirect back to the per-workshop manage *page* (not the API URL) with
// the error encoded in the query string. Falls back to the workshops
// index if the slug is missing (which can only happen on a malformed
// request).
function errorRedirect(workshopSlug: string, reason: string, detail?: string): Response {
  const target = workshopSlug
    ? `/instructor/workshops/${workshopSlug}`
    : '/instructor/workshops';
  const detailQs = detail ? `&detail=${encodeURIComponent(detail)}` : '';
  return new Response(null, {
    status: 303,
    headers: {
      Location: `${target}?error=${encodeURIComponent(reason)}${detailQs}`,
    },
  });
}
