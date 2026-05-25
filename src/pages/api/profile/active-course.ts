import type { APIRoute } from 'astro';
import { isCourseSlug } from '@lib/courses';
import { listAvailableCourses } from '@lib/dashboard';

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.supabase || !locals.user) {
    return new Response(JSON.stringify({ ok: false, reason: 'unauthenticated' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const body = await safeJson(request);
  const slug = body?.course_slug;
  if (typeof slug !== 'string' || !isCourseSlug(slug)) {
    return json({ ok: false, reason: 'invalid_course_slug' }, 400);
  }

  const available = await listAvailableCourses(locals.supabase, locals.user.id);
  if (!available.some((c) => c.slug === slug)) {
    return json({ ok: false, reason: 'not_accessible' }, 403);
  }

  const { error } = await locals.supabase
    .from('profiles')
    .update({ active_course_slug: slug })
    .eq('id', locals.user.id);

  if (error) {
    return json({ ok: false, reason: 'update_failed' }, 500);
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
