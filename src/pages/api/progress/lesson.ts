import type { APIRoute } from 'astro';
import { getEntry } from 'astro:content';
import { getAdminClient } from '@lib/supabase/admin';

type Body = {
  lessonSlug?: unknown;
  status?: unknown;
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return json({ error: 'unauthenticated' }, 401);

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const lessonSlug = typeof body.lessonSlug === 'string' ? body.lessonSlug : null;
  const status = body.status === 'started' || body.status === 'completed'
    ? body.status
    : null;
  if (!lessonSlug || !status) return json({ error: 'invalid_input' }, 400);

  const lesson = await getEntry('lessons', lessonSlug);
  if (!lesson || lesson.data.draft) return json({ error: 'lesson_not_found' }, 404);

  try {
    const { error } = await getAdminClient().from('lesson_progress').upsert(
      {
        user_id: locals.user.id,
        lesson_slug: lesson.slug,
        course_slug: lesson.data.course,
        status,
        completed_at: status === 'completed' ? new Date().toISOString() : null,
      },
      { onConflict: 'user_id,lesson_slug' },
    );
    if (error) {
      console.error('[progress/lesson] save_failed', error);
      return json({ error: 'save_failed' }, 500);
    }
  } catch (error) {
    console.error('[progress/lesson] save_failed', error);
    return json({ error: 'save_failed' }, 500);
  }

  return json({ ok: true });
};

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
