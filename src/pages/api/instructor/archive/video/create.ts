import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getAdminClient } from '@lib/supabase/admin';
import { isContentManager } from '@lib/roles';
import { instructorOwnsCourse } from '@lib/archive/access';
import { normalizeLessonSlug } from '@lib/archive/build';
import { logDisclosureSafe } from '@lib/audit';

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
  const course = String(form.get('course_slug') ?? '');
  const lessonSlug = String(form.get('lesson_slug') ?? '');
  const term = String(form.get('semester_term') ?? '');
  const year = Number(form.get('semester_year') ?? NaN);
  const title = String(form.get('title') ?? '').trim();
  const provider = String(form.get('provider') ?? '');
  const videoId = String(form.get('video_id') ?? '').trim();
  const description = String(form.get('description') ?? '').trim() || null;
  const durationRaw = Number(form.get('duration_minutes') ?? NaN);
  const durationMinutes =
    Number.isFinite(durationRaw) && durationRaw > 0
      ? Math.floor(durationRaw)
      : null;

  if (!user) return err('unauthenticated');
  if (!isContentManager(role)) return err('forbidden');
  if (course !== 'eco-1002') return err('invalid_course');
  if (!(await instructorOwnsCourse(user.id, course, role)))
    return err('not_course_instructor');

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

  // lesson_slug must be a real ECO 1002 lesson.
  const lessons = await getCollection(
    'lessons',
    (l) => l.data.course === course,
  );
  const validSlugs = new Set(lessons.map((l) => normalizeLessonSlug(l.id)));
  if (!validSlugs.has(lessonSlug)) return err('invalid_lesson');

  const admin = getAdminClient();
  const { data: inserted, error } = await admin
    .from('archive_videos')
    .insert({
      course_slug: course,
      lesson_slug: lessonSlug,
      semester_term: term as 'spring' | 'summer' | 'fall',
      semester_year: year,
      title,
      provider: provider as 'youtube' | 'vimeo',
      video_id: videoId,
      description,
      duration_minutes: durationMinutes,
      created_by: user.id,
    })
    .select('id')
    .single();
  if (error) return err('insert_failed');

  await logDisclosureSafe({
    actorId: user.id,
    actorRole: role as 'instructor' | 'admin',
    action: 'manage_archive',
    request,
    targetResource: `video create: ${title} (${course})`,
    metadata: { resource: 'video', op: 'create', id: inserted.id, course },
  });

  return new Response(null, {
    status: 303,
    headers: { Location: `/instructor/archive?ok=created` },
  });
};
