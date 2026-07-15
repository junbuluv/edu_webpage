import type { APIRoute } from 'astro';
import { getAdminClient } from '@lib/supabase/admin';
import { hmacPIIHex } from '@lib/crypto/pii';
import { readDeviceId } from '@lib/device';
import {
  acceptableGeolocationAccuracy,
  withinGeofenceWithAccuracy,
} from '@lib/geo';
import {
  canUseStudentWorkshopAttendance,
  isUuid,
  matchWorkshopEnrollment,
  validCoordinates,
  workshopDeviceDedupeInput,
} from '@lib/workshop-policy';

// Server-side workshop attendance stamp.
// Validates: signed in, valid administration, window open, geofence
// (when set), one-stamp-per-user (DB-enforced), one-stamp-per-device
// (DB-enforced via unique constraint on (administration_id, device_hmac)).
//
// Uses the admin (service-role) client to bypass RLS for the insert.
// RLS is the read-scoping layer; the insert path is gated here.

interface Body {
  administration_id?: unknown;
  lat?: unknown;
  lng?: unknown;
  accuracy?: unknown;
}

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  if (!locals.user) return json({ ok: false, reason: 'unauthenticated' }, 401);
  if (!canUseStudentWorkshopAttendance(locals.profile?.role)) {
    return json(
      {
        ok: false,
        reason: 'role_not_student',
        detail: 'Attendance stamping is only available to student accounts.',
      },
      403,
    );
  }

  const body = await safeJson(request);
  if (!body) return json({ ok: false, reason: 'invalid_json' }, 400);
  const administrationId =
    typeof body.administration_id === 'string' ? body.administration_id : null;
  const lat = typeof body.lat === 'number' ? body.lat : null;
  const lng = typeof body.lng === 'number' ? body.lng : null;
  const accuracy = typeof body.accuracy === 'number' ? body.accuracy : null;

  if (!administrationId || !isUuid(administrationId)) {
    return json({ ok: false, reason: 'invalid_administration_id' }, 400);
  }

  const deviceId = readDeviceId(cookies);
  if (!deviceId) {
    return json({ ok: false, reason: 'missing_device_id' }, 400);
  }

  const admin = getAdminClient();

  // Load the administration. We use the admin client so we can see all
  // rows; the request is gated by user identity and the unique
  // constraints below.
  const { data: administration, error: adminError } = await admin
    .from('workshop_administrations')
    .select(
      'id, workshop_slug, course_slug, semester, section, week_of, instructor_id, opens_at, closes_at, cancelled_at, required_lat, required_lng, required_radius_meters',
    )
    .eq('id', administrationId)
    .maybeSingle();

  if (adminError) {
    // Log the raw DB error server-side; the client gets a generic detail
    // so we don't leak schema info / index names / etc.
    console.error('[workshops/stamp] lookup_failed', adminError);
    return json({ ok: false, reason: 'lookup_failed' }, 500);
  }
  if (!administration) {
    return json({ ok: false, reason: 'not_found' }, 404);
  }
  if (administration.cancelled_at) {
    return json(
      {
        ok: false,
        reason: 'window_cancelled',
        detail: 'This workshop window was cancelled.',
      },
      403,
    );
  }

  const now = Date.now();
  if (now < Date.parse(administration.opens_at)) {
    return json({ ok: false, reason: 'window_not_open' }, 403);
  }
  if (now > Date.parse(administration.closes_at)) {
    return json({ ok: false, reason: 'window_closed' }, 403);
  }

  const { data: enrollment, error: enrollmentError } = await admin
    .from('enrollments')
    .select('course_slug, semester, section, instructor_id')
    .eq('user_id', locals.user.id)
    .eq('course_slug', administration.course_slug)
    .eq('semester', administration.semester)
    .maybeSingle();
  if (enrollmentError) {
    console.error(
      '[workshops/stamp] enrollment_lookup_failed',
      enrollmentError,
    );
    return json({ ok: false, reason: 'enrollment_lookup_failed' }, 500);
  }
  const enrollmentMatch = matchWorkshopEnrollment(
    enrollment
      ? {
          courseSlug: enrollment.course_slug,
          semester: enrollment.semester,
          section: enrollment.section,
          instructorId: enrollment.instructor_id,
        }
      : null,
    {
      courseSlug: administration.course_slug,
      semester: administration.semester,
      section: administration.section,
      instructorId: administration.instructor_id,
    },
  );
  if (enrollmentMatch !== 'ok') {
    const detail =
      enrollmentMatch === 'wrong_section'
        ? 'This window is for a different section.'
        : enrollmentMatch === 'section_assignment_required'
          ? 'Your roster does not have a section assignment. Ask your instructor to update it.'
          : 'You are not enrolled in this workshop class.';
    return json({ ok: false, reason: enrollmentMatch, detail }, 403);
  }

  // Geofence check (if set). Same soft-barrier caveat as the proctored
  // exam: browser geolocation can be spoofed.
  if (
    administration.required_lat != null &&
    administration.required_lng != null
  ) {
    if (
      lat == null ||
      lng == null ||
      accuracy == null ||
      !validCoordinates(lat, lng)
    ) {
      return json(
        {
          ok: false,
          reason: 'invalid_coordinates',
          detail:
            'We could not verify a valid location. Retry or ask your instructor for manual verification.',
        },
        400,
      );
    }
    if (
      !acceptableGeolocationAccuracy(
        accuracy,
        administration.required_radius_meters,
      )
    ) {
      return json(
        {
          ok: false,
          reason: 'location_accuracy_insufficient',
          detail:
            'Your location reading is not accurate enough for this workshop. Move near a window, retry, or ask your instructor for manual verification.',
        },
        422,
      );
    }
    if (
      !withinGeofenceWithAccuracy(
        lat,
        lng,
        accuracy,
        administration.required_lat,
        administration.required_lng,
        administration.required_radius_meters,
      )
    ) {
      // Don't disclose the distance or the required radius to the client —
      // doing so is a roadmap for geofence spoofing tools.
      return json(
        {
          ok: false,
          reason: 'out_of_geofence',
          detail:
            'Location could not verify this workshop. If you are present, ask your instructor for manual verification.',
        },
        403,
      );
    }
  }

  // Insert. Two unique constraints will reject:
  //   (administration_id, user_id)   -> 23505 'already_stamped'
  //   (administration_id, device_hmac) -> 23505 'device_already_used'
  const geofenceRequired =
    administration.required_lat != null && administration.required_lng != null;
  const { data: stamped, error: insertError } = await admin.rpc(
    'record_workshop_stamp',
    {
      p_user_id: locals.user.id,
      p_administration_id: administration.id,
      p_device_hmac: hmacPIIHex(
        workshopDeviceDedupeInput(administration.id, deviceId),
      ),
      p_verification_method: geofenceRequired ? 'geofence' : 'window',
    },
  );

  if (insertError) {
    // Distinguish the two unique violations server-side for analytics /
    // instructor view (reason code), but show the *same* student-visible
    // detail for both so the API doesn't disclose which dedupe key
    // (user vs device cookie) triggered.
    if (insertError.code === '23505') {
      const serverReason = insertError.message.includes('device_hmac')
        ? 'device_already_used'
        : 'already_stamped';
      console.info('[workshops/stamp] duplicate', { reason: serverReason });
      return json(
        {
          ok: false,
          reason: 'already_recorded',
          detail:
            'You are already stamped in for this workshop. If this looks wrong, talk to your instructor.',
        },
        409,
      );
    }
    // Log the raw DB error server-side; client gets generic detail.
    console.error('[workshops/stamp] insert_failed', insertError);
    return json({ ok: false, reason: 'insert_failed' }, 500);
  }
  if (!stamped) {
    return json(
      {
        ok: false,
        reason: 'eligibility_changed',
        detail:
          'This workshop window or your enrollment changed. Refresh before trying again.',
      },
      409,
    );
  }

  return json({
    ok: true,
    stamped_at: new Date().toISOString(),
    section: administration.section,
    workshop_slug: administration.workshop_slug,
  });
};

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'private, no-store',
    },
  });
}

async function safeJson(request: Request): Promise<Body | null> {
  try {
    const parsed: unknown = await request.json();
    return parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
      ? (parsed as Body)
      : null;
  } catch {
    return null;
  }
}
