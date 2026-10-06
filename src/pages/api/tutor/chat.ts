// Lesson tutor (2026-10-05 design). Streams a coach-mode reply grounded in
// the lesson the student is reading. Gate order: signed in -> gateway key ->
// valid body -> published lesson -> course flag -> enrolled-or-staff ->
// daily cap. The lesson is loaded here by slug; the browser never supplies
// lesson text, and quiz or workshop JSON never enters the prompt.
import type { APIRoute } from 'astro';
import { getEntry } from 'astro:content';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'ai';
import { canViewCourse } from '@lib/archive/access';
import { ArchiveServiceUnavailableError } from '@lib/archive/errors';
import { getTutorCourse } from '@lib/tutor/access';
import { classifyStreamError } from '@lib/tutor/errors';
import { lessonToContext } from '@lib/tutor/lesson-context';
import { TUTOR_MAX_OUTPUT_TOKENS } from '@lib/tutor/limits';
import {
  getTutorModel,
  tutorModelId,
  tutorProviderOptions,
} from '@lib/tutor/model';
import { buildTutorInstructions } from '@lib/tutor/prompt';
import { parseTutorRequest } from '@lib/tutor/request';
import { consumeTutorQuota, recordTutorUsage } from '@lib/tutor/usage';

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'private, no-store',
    },
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return json({ error: 'unauthorized' }, 401);
  const model = getTutorModel();
  if (!model) return json({ error: 'tutor_unavailable' }, 503);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }
  const parsed = parseTutorRequest(raw);
  if (!parsed.ok) return json({ error: parsed.reason }, 400);

  const lesson = await getEntry('lessons', parsed.value.lessonSlug);
  if (!lesson || lesson.data.draft)
    return json({ error: 'lesson_not_found' }, 404);
  const courseSlug = lesson.data.course;
  const course = await getTutorCourse(courseSlug);
  if (!course) return json({ error: 'tutor_not_enabled' }, 404);

  try {
    if (!(await canViewCourse(locals, courseSlug))) {
      return json({ error: 'forbidden' }, 403);
    }
  } catch (error) {
    if (!(error instanceof ArchiveServiceUnavailableError)) {
      console.error('[tutor/chat] access_check_failed', error);
    }
    return json({ error: 'tutor_unavailable' }, 503);
  }

  const quota = await consumeTutorQuota(
    locals.user.id,
    courseSlug,
    lesson.slug,
  );
  if (quota.status === 'error')
    return json({ error: 'tutor_unavailable' }, 503);
  if (quota.status === 'rate_limited')
    return json({ error: 'rate_limited' }, 429);

  const modelId = tutorModelId();
  const result = streamText({
    model,
    instructions: buildTutorInstructions({
      courseCode: course.data.code,
      courseTitle: course.data.title,
      lessonContext: lessonToContext(lesson.body ?? '', lesson.data),
    }),
    // TutorMessage is a structural subset of UIMessage (text parts only).
    messages: await convertToModelMessages(
      parsed.value.messages as UIMessage[],
    ),
    maxOutputTokens: TUTOR_MAX_OUTPUT_TOKENS,
    providerOptions: tutorProviderOptions(),
    abortSignal: request.signal,
    // AI SDK 7: onEnd replaces the deprecated onFinish.
    onEnd: async ({ usage }) => {
      await recordTutorUsage(quota.messageId, modelId, {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        reasoningTokens: usage.outputTokenDetails?.reasoningTokens,
      });
    },
    onError: ({ error }) => {
      console.error('[tutor/chat] stream_failed', {
        code: classifyStreamError(error),
      });
    },
  });

  // AI SDK 7: result.toUIMessageStreamResponse is deprecated in favor of
  // createUIMessageStreamResponse + toUIMessageStream. onError's return value
  // is the only error text the browser sees.
  return createUIMessageStreamResponse({
    headers: { 'cache-control': 'private, no-store' },
    stream: toUIMessageStream({
      stream: result.stream,
      onError: (error) => classifyStreamError(error),
    }),
  });
};
