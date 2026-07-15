import type { APIRoute } from 'astro';
import { getEntry } from 'astro:content';
import { getAdminClient } from '@lib/supabase/admin';
import { isAdmin, isInstructor } from '@lib/roles';
import { isCourseSlug } from '@lib/courses';
import {
  isUuid,
  parseNewYorkWallTime,
  sectionMatchesWeekday,
  validCoordinates,
  validRadiusMeters,
  validWorkshopWindow,
  type WorkshopSection,
} from '@lib/workshop-policy';
import { logDisclosureSafe } from '@lib/audit';

// Open a new workshop_administrations row for one workshop window.
// Instructor only. Posted as form data (so the page's plain <form>
// submission works without JS).
//
// ECO 1002 runs four per-day sections (CML/CTL/CWL/CRL); the form sends
// `section` and we store it. FIN 3610 has no per-day sections; the form
// omits `section` and we store NULL. The DB has partial unique indexes
// keyed on either (workshop_slug, semester, section, week_of, instructor_id)
// or (workshop_slug, semester, week_of, instructor_id), depending on whether
// section is set.

const SECTIONS = new Set(['CML', 'CTL', 'CWL', 'CRL']);
const COURSES_WITH_SECTIONS = new Set(['eco-1002']);

interface ClassSelection {
  instructorId: string;
  semester: string;
  section: string | null;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  const role = locals.profile?.role ?? 'student';

  if (!user) return errorRedirect('', 'unauthenticated');
  if (!isInstructor(role)) return errorRedirect('', 'forbidden');

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorRedirect('', 'invalid_input');
  }
  const workshopSlug = String(form.get('workshop_slug') ?? '');
  const courseSlug = String(form.get('course_slug') ?? '');
  const classSelection = parseClassSelection(
    String(form.get('class_key') ?? ''),
  );
  const classInstructorId = classSelection?.instructorId ?? '';
  const semester = classSelection?.semester.trim() ?? '';
  const rawSection = classSelection?.section ?? null;
  const opensAt = String(form.get('opens_at') ?? '');
  const closesAt = String(form.get('closes_at') ?? '');
  const rawLat = String(form.get('required_lat') ?? '').trim();
  const rawLng = String(form.get('required_lng') ?? '').trim();
  const rawRadius = String(form.get('required_radius_meters') ?? '').trim();
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  const radius = Number(rawRadius);
  const locationLabel = String(form.get('location_label') ?? '').trim();
  const notes = String(form.get('notes') ?? '').trim() || null;

  if (
    !workshopSlug ||
    !isCourseSlug(courseSlug) ||
    !isUuid(classInstructorId) ||
    !semester ||
    semester.length > 64 ||
    !opensAt ||
    !closesAt
  ) {
    return errorRedirect(workshopSlug, 'invalid_input');
  }

  const workshop = await getEntry('workshops', workshopSlug);
  if (!workshop || workshop.data.course !== courseSlug) {
    return errorRedirect(workshopSlug, 'invalid_input');
  }

  const courseUsesSections = COURSES_WITH_SECTIONS.has(courseSlug);
  const section: WorkshopSection | null = courseUsesSections
    ? typeof rawSection === 'string' && SECTIONS.has(rawSection)
      ? (rawSection as WorkshopSection)
      : null
    : null;
  if (
    (courseUsesSections && section == null) ||
    (!courseUsesSections && rawSection != null)
  ) {
    return errorRedirect(workshopSlug, 'invalid_input');
  }

  if (!isAdmin(role) && classInstructorId !== user.id) {
    return errorRedirect(workshopSlug, 'not_course_instructor');
  }

  const admin = getAdminClient();
  const { data: teachingAssignment, error: classError } = await admin
    .from('teaching_assignments')
    .select('instructor_id')
    .eq('instructor_id', classInstructorId)
    .eq('course_slug', courseSlug)
    .eq('semester', semester)
    .eq('active', true)
    .maybeSingle();
  if (classError || !teachingAssignment) {
    return errorRedirect(workshopSlug, 'not_course_instructor');
  }

  const parsedOpen = parseNewYorkWallTime(opensAt);
  const parsedClose = parseNewYorkWallTime(closesAt);
  if (!parsedOpen.ok || !parsedClose.ok) {
    const hasDstIssue =
      (!parsedOpen.ok && parsedOpen.reason !== 'invalid') ||
      (!parsedClose.ok && parsedClose.reason !== 'invalid');
    return errorRedirect(
      workshopSlug,
      hasDstIssue ? 'ambiguous_or_missing_time' : 'invalid_time',
    );
  }
  if (!validWorkshopWindow(parsedOpen.date, parsedClose.date)) {
    return errorRedirect(workshopSlug, 'invalid_window');
  }
  if (section && !sectionMatchesWeekday(section, parsedOpen.weekday)) {
    return errorRedirect(workshopSlug, 'wrong_section_day');
  }
  if (
    !rawLat ||
    !rawLng ||
    !rawRadius ||
    !validCoordinates(lat, lng) ||
    !validRadiusMeters(radius) ||
    locationLabel.length < 1 ||
    locationLabel.length > 120 ||
    (notes?.length ?? 0) > 200
  ) {
    return errorRedirect(workshopSlug, 'invalid_location');
  }

  const { data: inserted, error } = await admin
    .from('workshop_administrations')
    .insert({
      workshop_slug: workshopSlug,
      course_slug: courseSlug,
      semester,
      section,
      week_of: parsedOpen.weekOf,
      instructor_id: classInstructorId,
      opens_at: parsedOpen.iso,
      closes_at: parsedClose.iso,
      required_lat: lat,
      required_lng: lng,
      required_radius_meters: radius,
      location_label: locationLabel,
      notes,
    })
    .select('id')
    .single();

  if (error) {
    // 23505 unique violation on whichever partial index applies (with-section
    // for ECO; no-section for FIN).
    const reason = error.code === '23505' ? 'already_opened' : 'insert_failed';
    console.error('[instructor/workshops/open] insert_failed', error);
    return errorRedirect(workshopSlug, reason);
  }

  await logDisclosureSafe({
    actorId: user.id,
    actorRole: role as 'instructor' | 'admin',
    action: 'manage_workshop',
    targetResource: inserted.id,
    metadata: {
      op: 'open',
      course: courseSlug,
      semester,
      workshop: workshopSlug,
      section,
      class_instructor_id: classInstructorId,
    },
    request,
  });

  return new Response(null, {
    status: 303,
    headers: { Location: `/instructor/workshops/${workshopSlug}?ok=opened` },
  });
};

// Redirect back to the per-workshop manage *page* (not the API URL) with
// the error encoded in the query string. Falls back to the workshops
// index if the slug is missing (which can only happen on a malformed
// request).
function errorRedirect(
  workshopSlug: string,
  reason: string,
  detail?: string,
): Response {
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

function parseClassSelection(raw: string): ClassSelection | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    const value = parsed as Record<string, unknown>;
    if (
      typeof value.instructorId !== 'string' ||
      typeof value.semester !== 'string' ||
      (value.section !== null && typeof value.section !== 'string')
    ) {
      return null;
    }
    return {
      instructorId: value.instructorId,
      semester: value.semester,
      section: value.section,
    };
  } catch {
    return null;
  }
}
