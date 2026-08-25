import type { APIRoute } from 'astro';
import { getEntry } from 'astro:content';
import { getAdminClient } from '@lib/supabase/admin';
import {
  canRevealWorkshopQuestions,
  isUuid,
  publicWorkshopQuestions,
  workshopWindowStatus,
} from '@lib/workshop-policy';

export const GET: APIRoute = async ({ request, locals }) => {
  if (!locals.user || !locals.supabase) {
    return json({ ok: false, reason: 'unauthenticated' }, 401);
  }

  const administrationId = new URL(request.url).searchParams.get(
    'administration_id',
  );
  if (!administrationId || !isUuid(administrationId)) {
    return json({ ok: false, reason: 'invalid_administration_id' }, 400);
  }

  const admin = getAdminClient();
  const { data: attendance, error: attendanceError } = await admin
    .from('workshop_attendance')
    .select('id')
    .eq('administration_id', administrationId)
    .eq('user_id', locals.user.id)
    .maybeSingle();
  if (attendanceError) {
    console.error('[workshops/status] attendance_lookup_failed', {
      message: attendanceError.message,
    });
    return json({ ok: false, reason: 'temporarily_unavailable' }, 503);
  }
  if (!attendance) return json({ ok: false, reason: 'not_found' }, 404);

  const { data: administration, error: administrationError } = await admin
    .from('workshop_administrations')
    .select(
      'id, workshop_slug, opens_at, closes_at, cancelled_at, questions_revealed_at',
    )
    .eq('id', administrationId)
    .maybeSingle();
  if (administrationError) {
    console.error('[workshops/status] administration_lookup_failed', {
      message: administrationError.message,
    });
    return json({ ok: false, reason: 'temporarily_unavailable' }, 503);
  }
  if (!administration) return json({ ok: false, reason: 'not_found' }, 404);

  const questionsVisible = canRevealWorkshopQuestions(
    true,
    administration.questions_revealed_at,
  );
  let questions: Array<{ id: string; prompt: string }> | null = null;
  if (questionsVisible) {
    const workshop = await getEntry('workshops', administration.workshop_slug);
    if (!workshop) {
      return json({ ok: false, reason: 'workshop_not_found' }, 404);
    }
    questions = publicWorkshopQuestions(workshop.data.questions);
  }

  return json({
    ok: true,
    status: workshopWindowStatus(
      administration.opens_at,
      administration.closes_at,
      administration.cancelled_at,
    ),
    questions,
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
