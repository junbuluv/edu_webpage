import type { APIRoute } from 'astro';
import { getEntry } from 'astro:content';
import { gradeQuiz, type AnswerMap, type GradableQuestion } from '@lib/quiz/grade';

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

export const POST: APIRoute = async ({ request }) => {
  let body: { slug?: unknown; answers?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const slug = typeof body.slug === 'string' ? body.slug : null;
  if (!slug) return json({ error: 'missing_slug' }, 400);

  const answers: AnswerMap =
    body.answers && typeof body.answers === 'object' ? (body.answers as AnswerMap) : {};

  const entry = await getEntry('quizzes', slug);
  if (!entry) return json({ error: 'quiz_not_found' }, 404);

  const result = gradeQuiz(
    entry.data.questions as GradableQuestion[],
    answers,
    entry.data.passingScore,
  );
  return json(result);
};
