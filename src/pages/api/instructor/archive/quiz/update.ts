import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getAdminClient } from '@lib/supabase/admin';
import { isContentManager, isAdmin } from '@lib/roles';
import { instructorOwnsCourse } from '@lib/archive/access';
import { normalizeLessonSlug } from '@lib/archive/build';
import { quizQuestionsSchema } from '@lib/quiz/question-schema';
import { logDisclosureSafe } from '@lib/audit';

const TERMS = new Set(['spring', 'summer', 'fall']);
const KINDS = new Set(['exam', 'assignment']);

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

  if (!user) return err('unauthenticated');
  if (!isContentManager(role)) return err('forbidden');

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return err('invalid_payload');
  }
  let p: Record<string, unknown>;
  const rawPayload = String(form.get('payload') ?? '');
  if (rawPayload.length > 1_000_000) return err('invalid_payload');
  try {
    p = JSON.parse(rawPayload) as Record<string, unknown>;
  } catch {
    return err('invalid_payload');
  }

  const id = typeof p.id === 'string' ? p.id : '';
  const kind = typeof p.kind === 'string' ? p.kind : '';
  const title = (typeof p.title === 'string' ? p.title : '').trim();
  const term = typeof p.semester_term === 'string' ? p.semester_term : '';
  const year = Number(p.semester_year ?? NaN);
  const covers = Array.isArray(p.covers)
    ? p.covers.map(String).filter((c) => c.length > 0)
    : [];
  const passing = Number(p.passing_score ?? 0.7);
  const published = p.published === true;

  if (!id) return err('invalid_input');

  const admin = getAdminClient();
  const { data: row, error: lookupError } = await admin
    .from('archive_quizzes')
    .select('course_slug, created_by')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (lookupError) return err('update_failed');
  if (!row) return err('not_found');
  if (!(await instructorOwnsCourse(user.id, row.course_slug, role)))
    return err('not_course_instructor');
  if (!isAdmin(role) && row.created_by !== user.id) return err('not_owner');

  if (
    !title ||
    title.length > 200 ||
    covers.length > 100 ||
    new Set(covers).size !== covers.length ||
    covers.some((cover) => cover.length > 200) ||
    !KINDS.has(kind) ||
    !TERMS.has(term) ||
    !Number.isInteger(year) ||
    year < 2020 ||
    year > 2100 ||
    !(passing >= 0 && passing <= 1)
  ) {
    return err('invalid_input');
  }
  const parsed = quizQuestionsSchema.safeParse(p.questions);
  if (!parsed.success) return err('invalid_questions');

  const lessons = await getCollection(
    'lessons',
    (l) => l.data.course === row.course_slug,
  );
  const valid = new Set(lessons.map((l) => normalizeLessonSlug(l.id)));
  if (covers.some((c) => !valid.has(c))) return err('invalid_lesson');

  const { data: updated, error } = await admin.rpc('mutate_archive_item', {
    p_actor_id: user.id,
    p_resource: 'quiz',
    p_id: id,
    p_operation: 'update',
    p_patch: {
      kind,
      title,
      semester_term: term,
      semester_year: year,
      covers,
      questions: parsed.data,
      passing_score: passing,
      published,
    },
  });
  if (error) return err('update_failed');
  if (!updated) return err('not_found');

  await logDisclosureSafe({
    actorId: user.id,
    actorRole: role as 'instructor' | 'admin',
    action: 'manage_archive',
    request,
    targetResource: `quiz update: ${title} (${row.course_slug})`,
    metadata: { resource: 'quiz', op: 'update', id, course: row.course_slug },
  });

  return new Response(null, {
    status: 303,
    headers: { Location: `/instructor/archive?ok=quiz_updated` },
  });
};
