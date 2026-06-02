import type { APIRoute } from 'astro';
import { loadGradableQuiz } from '@lib/quiz/resolve';
import {
  gradeQuiz,
  type AnswerMap,
  type GradableQuestion,
} from '@lib/quiz/grade';
import { canViewCourse } from '@lib/archive/access';

// Server-side quiz grading. The quiz (including answer keys + explanations)
// is loaded here from the content collection and never shipped to the client;
// the browser only sends { slug, answers } and gets back score + per-question
// {correct, explanation}. This is what keeps answers out of the page bundle.

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  let body: { slug?: unknown; answers?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const slug = typeof body.slug === 'string' ? body.slug : null;
  if (!slug) return json({ error: 'missing_slug' }, 400);

  const answers: AnswerMap =
    body.answers && typeof body.answers === 'object'
      ? (body.answers as AnswerMap)
      : {};

  const quiz = await loadGradableQuiz(slug);
  if (!quiz) return json({ error: 'quiz_not_found' }, 404);

  // Practice quizzes grade publicly. Exam/assignment papers are gated to
  // enrolled students + staff, matching the page-level gate — otherwise the
  // grader would leak answer explanations for archive papers by slug.
  if (quiz.kind !== 'practice') {
    if (!locals.user) return json({ error: 'unauthorized' }, 401);
    if (!(await canViewCourse(locals, quiz.course))) {
      return json({ error: 'forbidden' }, 403);
    }
  }

  const result = gradeQuiz(
    quiz.questions as GradableQuestion[],
    answers,
    quiz.passingScore,
  );
  return json(result);
};
