import type { APIRoute } from 'astro';
import { getAdminClient } from '@lib/supabase/admin';
import { hmacPIIHex } from '@lib/crypto/pii';
import { readDeviceId } from '@lib/device';
import { haversineMeters } from '@lib/geo';

// Server-side workshop attendance stamp.
// Validates: signed in, valid administration, window open, geofence
// (when set), one-stamp-per-user (DB-enforced), one-stamp-per-device
// (DB-enforced via unique constraint on (administration_id, device_id)).
//
// Uses the admin (service-role) client to bypass RLS for the insert.
// RLS is the read-scoping layer; the insert path is gated here.

interface Body {
  administration_id?: unknown;
  lat?: unknown;
  lng?: unknown;
}

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  if (!locals.user) return json({ ok: false, reason: 'unauthenticated' }, 401);

  const body = await safeJson(request);
  const administrationId = typeof body.administration_id === 'string' ? body.administration_id : null;
  const lat = typeof body.lat === 'number' ? body.lat : null;
  const lng = typeof body.lng === 'number' ? body.lng : null;

  if (!administrationId) {
    return json({ ok: false, reason: 'missing_administration_id' }, 400);
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
      'id, workshop_slug, course_slug, section, week_of, instructor_id, opens_at, closes_at, required_lat, required_lng, required_radius_meters',
    )
    .eq('id', administrationId)
    .maybeSingle();

  if (adminError) {
    return json({ ok: false, reason: 'lookup_failed', detail: adminError.message }, 500);
  }
  if (!administration) {
    return json({ ok: false, reason: 'not_found' }, 404);
  }

  const now = Date.now();
  if (now < Date.parse(administration.opens_at)) {
    return json({ ok: false, reason: 'window_not_open' }, 403);
  }
  if (now > Date.parse(administration.closes_at)) {
    return json({ ok: false, reason: 'window_closed' }, 403);
  }

  // Enrollment check: students must be enrolled in the workshop's course
  // to stamp. (Instructors of the course skip this check.)
  if (locals.user.id !== administration.instructor_id) {
    const { data: enrollment } = await admin
      .from('enrollments')
      .select('user_id')
      .eq('user_id', locals.user.id)
      .eq('course_slug', administration.course_slug)
      .maybeSingle();
    if (!enrollment) {
      return json({ ok: false, reason: 'not_enrolled' }, 403);
    }
  }

  // Geofence check (if set). Same soft-barrier caveat as the proctored
  // exam: browser geolocation can be spoofed.
  if (
    administration.required_lat != null &&
    administration.required_lng != null
  ) {
    if (lat == null || lng == null) {
      return json({ ok: false, reason: 'geo_required' }, 400);
    }
    const dist = haversineMeters(
      lat,
      lng,
      administration.required_lat,
      administration.required_lng,
    );
    if (dist > administration.required_radius_meters) {
      return json(
        {
          ok: false,
          reason: 'out_of_geofence',
          detail: `You are ${Math.round(dist)} m away; required within ${administration.required_radius_meters} m.`,
        },
        403,
      );
    }
  }

  // Insert. Two unique constraints will reject:
  //   (administration_id, user_id)   -> 23505 'already_stamped'
  //   (administration_id, device_id) -> 23505 'device_already_used'
  const ip = clientIp(request);
  const ua = request.headers.get('user-agent');
  const { error: insertError } = await admin
    .from('workshop_attendance')
    .insert({
      administration_id: administration.id,
      user_id: locals.user.id,
      device_id: deviceId,
      client_lat: lat ?? null,
      client_lng: lng ?? null,
      client_ip_hmac: ip ? hmacPIIHex(ip) : null,
      user_agent_hmac: ua ? hmacPIIHex(ua) : null,
    });

  if (insertError) {
    // Distinguish the two unique violations by checking the constraint
    // name in the error message.
    if (insertError.code === '23505') {
      if (insertError.message.includes('device_id')) {
        return json(
          {
            ok: false,
            reason: 'device_already_used',
            detail:
              'This device has already been used to stamp into this workshop. If this looks wrong, talk to your instructor.',
          },
          409,
        );
      }
      return json(
        {
          ok: false,
          reason: 'already_stamped',
          detail: 'You are already stamped in for this workshop.',
        },
        409,
      );
    }
    return json(
      { ok: false, reason: 'insert_failed', detail: insertError.message, code: insertError.code },
      500,
    );
  }

  return json({
    ok: true,
    stamped_at: new Date().toISOString(),
    section: administration.section,
    workshop_slug: administration.workshop_slug,
  });
};

function clientIp(request: Request): string | null {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() ?? null;
  return request.headers.get('x-real-ip') ?? null;
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function safeJson(request: Request): Promise<Body> {
  try {
    return (await request.json()) as Body;
  } catch {
    return {};
  }
}
