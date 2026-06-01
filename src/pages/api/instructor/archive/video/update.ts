import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getAdminClient } from '@lib/supabase/admin';
import { isContentManager, isAdmin } from '@lib/roles';
import { instructorOwnsCourse } from '@lib/archive/access';
import { normalizeLessonSlug } from '@lib/archive/build';

const TERMS = new Set(['spring', 'summer', 'fall']);
const PROVIDERS = new Set(['youtube', 'vimeo']);

function err(reason: string): Response {
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/instructor/archive?error=${encodeURIComponent(reason)}`,
    },
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  const role = locals.profile?.role ?? 'student';

  const form = await request.formData();
  const id = String(form.get('id') ?? '');
  const lessonSlug = String(form.get('lesson_slug') ?? '');
  const term = String(form.get('semester_term') ?? '');
  const year = Number(form.get('semester_year') ?? NaN);
  const title = String(form.get('title') ?? '').trim();
  const provider = String(form.get('provider') ?? '');
  const videoId = String(form.get('video_id') ?? '').trim();
  const description = String(form.get('description') ?? '').trim() || null;
  // Unchecked checkbox is absent from formData; presence => published.
  const published = form.get('published') != null;

  if (!user) return err('unauthenticated');
  if (!isContentManager(role)) return err('forbidden');
  if (!id) return err('invalid_input');

  const admin = getAdminClient();
  const { data: row } = await admin
    .from('archive_videos')
    .select('course_slug, created_by')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!row) return err('not_found');

  if (!(await instructorOwnsCourse(user.id, row.course_slug, role)))
    return err('not_course_instructor');
  if (!isAdmin(role) && row.created_by !== user.id) return err('not_owner');

  if (
    !title ||
    !videoId ||
    !TERMS.has(term) ||
    !PROVIDERS.has(provider) ||
    !Number.isInteger(year) ||
    year < 2020 ||
    year > 2100
  ) {
    return err('invalid_input');
  }

  const lessons = await getCollection(
    'lessons',
    (l) => l.data.course === row.course_slug,
  );
  const validSlugs = new Set(lessons.map((l) => normalizeLessonSlug(l.id)));
  if (!validSlugs.has(lessonSlug)) return err('invalid_lesson');

  const { error } = await admin
    .from('archive_videos')
    .update({
      lesson_slug: lessonSlug,
      semester_term: term as 'spring' | 'summer' | 'fall',
      semester_year: year,
      title,
      provider: provider as 'youtube' | 'vimeo',
      video_id: videoId,
      description,
      published,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) return err('update_failed');

  return new Response(null, {
    status: 303,
    headers: { Location: `/instructor/archive?ok=updated` },
  });
};
