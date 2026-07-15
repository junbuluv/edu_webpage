import type { APIRoute } from 'astro';
import { getEntry } from 'astro:content';
import { getAdminClient } from '@lib/supabase/admin';

type Body = {
  lessonSlug?: unknown;
  operation?: unknown;
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return json({ error: 'unauthenticated' }, 401);

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const lessonSlug =
    typeof body.lessonSlug === 'string' ? body.lessonSlug : null;
  const operation =
    body.operation === 'start' ||
    body.operation === 'complete' ||
    body.operation === 'reset'
      ? body.operation
      : null;
  if (!lessonSlug || !operation) {
    return json({ error: 'invalid_input' }, 400);
  }

  const lesson = await getEntry('lessons', lessonSlug);
  if (!lesson || lesson.data.draft)
    return json({ error: 'lesson_not_found' }, 404);

  try {
    const { data: outcome, error } = await getAdminClient().rpc(
      'record_lesson_progress',
      {
        p_user_id: locals.user.id,
        p_lesson_slug: lesson.slug,
        p_course_slug: lesson.data.course,
        p_operation: operation,
      },
    );
    if (error) {
      console.error('[progress/lesson] save_failed', error);
      return json({ error: 'save_failed' }, 500);
    }
    if (outcome === 'ambiguous') {
      return json({ error: 'enrollment_scope_ambiguous' }, 409);
    }
    if (
      outcome !== 'started' &&
      outcome !== 'completed' &&
      outcome !== 'reset'
    ) {
      console.error('[progress/lesson] unexpected_outcome', outcome);
      return json({ error: 'save_failed' }, 500);
    }
    return json({
      ok: true,
      status: outcome === 'completed' ? 'completed' : 'started',
    });
  } catch (error) {
    console.error('[progress/lesson] save_failed', error);
    return json({ error: 'save_failed' }, 500);
  }
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
