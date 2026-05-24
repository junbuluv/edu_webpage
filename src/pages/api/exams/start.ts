import type { APIRoute } from 'astro';
import { getAdminClient } from '@lib/supabase/admin';
import { haversineMeters } from '@lib/geo';

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ ok: false, reason: 'not signed in' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const body = (await request.json().catch(() => null)) as
    | { adminId?: string; lat?: number; lng?: number }
    | null;
  if (!body?.adminId) {
    return new Response(JSON.stringify({ ok: false, reason: 'missing adminId' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const admin = getAdminClient();

  // Fetch the administration row.
  const { data: row } = await admin
    .from('exam_administrations')
    .select('*')
    .eq('id', body.adminId)
    .maybeSingle();
  if (!row) {
    return resp({ ok: false, reason: 'administration not found' }, 404);
  }

  // Time window check.
  const now = Date.now();
  const opens = Date.parse(row.opens_at);
  const closes = Date.parse(row.closes_at);
  if (now < opens) return resp({ ok: false, reason: 'window not open yet' });
  if (now > closes) return resp({ ok: false, reason: 'window closed' });

  // Geo check (only if administration specifies coordinates).
  if (row.required_lat != null && row.required_lng != null) {
    if (typeof body.lat !== 'number' || typeof body.lng !== 'number') {
      return resp({ ok: false, reason: 'location required but not provided' });
    }
    const d = haversineMeters(
      body.lat,
      body.lng,
      Number(row.required_lat),
      Number(row.required_lng),
    );
    if (d > row.required_radius_meters) {
      return resp({
        ok: false,
        reason: `outside required radius (${Math.round(d)} m vs ${row.required_radius_meters} m)`,
      });
    }
  }

  // Single-attempt rule: insert; DB unique (administration_id, user_id)
  // index catches races with a 23505, which we resolve by re-selecting.
  const { data: existing } = await admin
    .from('exam_attempts')
    .select('id, started_at, submitted_at')
    .eq('administration_id', body.adminId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing?.submitted_at) {
    return resp({ ok: false, reason: 'already submitted' });
  }
  // Resume an already-started attempt. CRITICAL: deadline must be based
  // on the ORIGINAL started_at — otherwise reloading the start endpoint
  // resets the timer and the duration cap is meaningless.
  if (existing) {
    const deadlineMs = Math.min(
      closes,
      Date.parse(existing.started_at) + row.duration_minutes * 60_000,
    );
    return resp({ ok: true, attemptId: existing.id, deadlineMs });
  }

  // Brand-new attempt.
  const { data: created, error } = await admin
    .from('exam_attempts')
    .insert({
      administration_id: body.adminId,
      user_id: user.id,
      started_at: new Date().toISOString(),
      client_lat_start: body.lat ?? null,
      client_lng_start: body.lng ?? null,
    })
    .select('id, started_at')
    .single();
  if (error || !created) {
    // Race: another parallel start INSERTed first. Re-select and treat
    // as resume.
    if (error?.code === '23505') {
      const { data: refetch } = await admin
        .from('exam_attempts')
        .select('id, started_at, submitted_at')
        .eq('administration_id', body.adminId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (refetch && !refetch.submitted_at) {
        const deadlineMs = Math.min(
          closes,
          Date.parse(refetch.started_at) + row.duration_minutes * 60_000,
        );
        return resp({ ok: true, attemptId: refetch.id, deadlineMs });
      }
    }
    return resp({ ok: false, reason: error?.message ?? 'insert failed' }, 500);
  }

  const deadlineMs = Math.min(
    closes,
    Date.parse(created.started_at) + row.duration_minutes * 60_000,
  );
  return resp({ ok: true, attemptId: created.id, deadlineMs });
};

function resp(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
