import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getAdminClient } from '@lib/supabase/admin';
import { isContentManager } from '@lib/roles';
import { instructorOwnsCourse } from '@lib/archive/access';
import { normalizeLessonSlug } from '@lib/archive/build';
import { quizQuestionsSchema } from '@lib/quiz/question-schema';

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

interface Payload {
  course_slug?: unknown;
  kind?: unknown;
  title?: unknown;
  semester_term?: unknown;
  semester_year?: unknown;
  covers?: unknown;
  passing_score?: unknown;
  questions?: unknown;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  const role = locals.profile?.role ?? 'student';

  const form = await request.formData();
  let p: Payload;
  try {
    p = JSON.parse(String(form.get('payload') ?? '')) as Payload;
  } catch {
    return err('invalid_payload');
  }

  const course = typeof p.course_slug === 'string' ? p.course_slug : '';
  const kind = typeof p.kind === 'string' ? p.kind : '';
  const title = (typeof p.title === 'string' ? p.title : '').trim();
  const term = typeof p.semester_term === 'string' ? p.semester_term : '';
  const year = Number(p.semester_year ?? NaN);
  const covers = Array.isArray(p.covers) ? p.covers.map(String) : [];
  const passing = Number(p.passing_score ?? 0.7);

  if (!user) return err('unauthenticated');
  if (!isContentManager(role)) return err('forbidden');
  if (!(await instructorOwnsCourse(user.id, course, role)))
    return err('not_course_instructor');
  if (
    !title ||
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
    (l) => l.data.course === course,
  );
  const valid = new Set(lessons.map((l) => normalizeLessonSlug(l.id)));
  if (covers.some((c) => !valid.has(c))) return err('invalid_lesson');

  const admin = getAdminClient();
  const { error } = await admin.from('archive_quizzes').insert({
    course_slug: course,
    kind: kind as 'exam' | 'assignment',
    title,
    semester_term: term as 'spring' | 'summer' | 'fall',
    semester_year: year,
    covers,
    questions: parsed.data,
    passing_score: passing,
    created_by: user.id,
  });
  if (error) return err('insert_failed');

  return new Response(null, {
    status: 303,
    headers: { Location: `/instructor/archive?ok=quiz_created` },
  });
};
