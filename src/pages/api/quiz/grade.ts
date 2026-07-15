import type { APIRoute } from 'astro';
import { loadGradableQuiz } from '@lib/quiz/resolve';
import {
  gradeQuiz,
  type AnswerMap,
  type GradableQuestion,
} from '@lib/quiz/grade';
import { canViewCourse } from '@lib/archive/access';
import {
  ArchiveServiceUnavailableError,
  QuizInvalidError,
  QuizUnavailableError,
} from '@lib/archive/errors';
import { getAdminClient } from '@lib/supabase/admin';
import {
  parseQuizSubmissionEnvelope,
  readQuizSubmissionBody,
  validateQuizAnswers,
} from '@lib/quiz/submission';

// Server-side quiz grading. The quiz (including answer keys + explanations)
// is loaded here from the content collection and never shipped to the client;
// the browser only sends { slug, answers } and gets back score + per-question
// {correct, explanation}. This is what keeps answers out of the page bundle.

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'private, no-store',
    },
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  const bodyResult = await readQuizSubmissionBody(request);
  if (!bodyResult.ok) return json({ error: bodyResult.reason }, 413);
  const envelope = parseQuizSubmissionEnvelope(bodyResult.value);
  if (!envelope.ok) return json({ error: envelope.reason }, 400);

  let quiz;
  try {
    quiz = await loadGradableQuiz(envelope.value.slug);
  } catch (error) {
    if (error instanceof QuizInvalidError) {
      return json({ error: 'quiz_invalid' }, 422);
    }
    if (error instanceof QuizUnavailableError) {
      return json({ error: 'quiz_unavailable' }, 503);
    }
    console.error('[quiz/grade] quiz_load_failed', error);
    return json({ error: 'quiz_unavailable' }, 503);
  }
  if (!quiz) return json({ error: 'quiz_not_found' }, 404);

  // Practice quizzes grade publicly. Exam/assignment papers are gated to
  // enrolled students + staff, matching the page-level gate — otherwise the
  // grader would leak answer explanations for archive papers by slug.
  if (quiz.kind !== 'practice') {
    if (!locals.user) return json({ error: 'unauthorized' }, 401);
    try {
      if (!(await canViewCourse(locals, quiz.course))) {
        return json({ error: 'forbidden' }, 403);
      }
    } catch (error) {
      if (!(error instanceof ArchiveServiceUnavailableError)) {
        console.error('[quiz/grade] access_check_failed', error);
      }
      return json({ error: 'quiz_unavailable' }, 503);
    }
  }

  const answerResult = validateQuizAnswers(
    envelope.value.answers,
    quiz.questions,
  );
  if (!answerResult.ok) return json({ error: answerResult.reason }, 400);
  const answers: AnswerMap = answerResult.value;

  const result = gradeQuiz(
    quiz.questions as GradableQuestion[],
    answers,
    quiz.passingScore,
  );

  let attempt:
    | { state: 'local'; attemptId: string }
    | {
        state: 'saved' | 'rate_limited' | 'ambiguous' | 'unsynced';
        attemptId: string;
      } = { state: 'local', attemptId: envelope.value.attemptId };

  if (locals.user) {
    try {
      const { data: outcome, error } = await getAdminClient().rpc(
        'record_quiz_attempt',
        {
          p_user_id: locals.user.id,
          p_quiz_slug: quiz.slug,
          p_course_slug: quiz.course,
          p_score: result.score,
          p_max_score: result.maxScore,
          p_answers: answers as never,
          p_client_attempt_id: envelope.value.attemptId,
        },
      );
      if (error) {
        console.error('[quiz/grade] attempt_save_failed', error);
        attempt = {
          state: 'unsynced',
          attemptId: envelope.value.attemptId,
        };
      } else if (outcome === 'recorded' || outcome === 'duplicate') {
        attempt = { state: 'saved', attemptId: envelope.value.attemptId };
      } else if (outcome === 'rate_limited' || outcome === 'ambiguous') {
        attempt = { state: outcome, attemptId: envelope.value.attemptId };
      } else {
        console.error('[quiz/grade] unexpected_attempt_outcome', outcome);
        attempt = {
          state: 'unsynced',
          attemptId: envelope.value.attemptId,
        };
      }
    } catch (error) {
      console.error('[quiz/grade] attempt_save_failed', error);
      attempt = { state: 'unsynced', attemptId: envelope.value.attemptId };
    }
  }

  return json({ ...result, attempt });
};
