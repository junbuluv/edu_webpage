import type { APIRoute } from 'astro';
import { isCourseSlug } from '@lib/courses';

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.supabase || !locals.user) {
    return json({ ok: false, reason: 'unauthenticated' }, 401);
  }

  const body = await safeJson(request);
  const slug = body?.course_slug;
  if (typeof slug !== 'string' || !isCourseSlug(slug)) {
    return json({ ok: false, reason: 'invalid_course_slug' }, 400);
  }

  // Any course in the catalog is a valid active course — students can
  // browse non-enrolled courses too. The accessibility gate previously
  // here was overly restrictive.

  const { error } = await locals.supabase
    .from('profiles')
    .update({ active_course_slug: slug })
    .eq('id', locals.user.id);

  if (error) {
    // Surface Supabase's actual error so callers (and the user) can
    // distinguish missing-column from RLS denial from a network blip.
    return json(
      {
        ok: false,
        reason: 'update_failed',
        detail: error.message,
        code: error.code,
        hint: error.hint,
      },
      500,
    );
  }

  return json({ ok: true, redirectTo: `/dashboard?course=${slug}` });
};

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function safeJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}
