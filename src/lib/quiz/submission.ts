import type { AnswerMap, AnswerValue } from './grade.ts';

export const MAX_QUIZ_SUBMISSION_BYTES = 32 * 1024;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

export type SubmissionQuestion = {
  id: string;
  type: 'multiple_choice' | 'multi_select' | 'numeric';
  choices?: readonly string[];
};

export type QuizSubmissionEnvelope = {
  slug: string;
  answers: Record<string, unknown>;
  attemptId: string;
};

export type SubmissionError =
  | 'body_too_large'
  | 'invalid_json'
  | 'invalid_submission'
  | 'invalid_answers';

type Result<T> =
  | { ok: true; value: T }
  | { ok: false; reason: SubmissionError };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export async function readQuizSubmissionBody(
  request: Request,
  maxBytes = MAX_QUIZ_SUBMISSION_BYTES,
): Promise<Result<string>> {
  if (!request.body) return { ok: true, value: '' };

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let byteLength = 0;
  let text = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > maxBytes) {
      await reader.cancel();
      return { ok: false, reason: 'body_too_large' };
    }
    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  return { ok: true, value: text };
}

export function parseQuizSubmissionEnvelope(
  raw: string,
): Result<QuizSubmissionEnvelope> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }
  if (!isRecord(parsed)) {
    return { ok: false, reason: 'invalid_submission' };
  }

  const allowedKeys = new Set(['slug', 'answers', 'attemptId']);
  if (Object.keys(parsed).some((key) => !allowedKeys.has(key))) {
    return { ok: false, reason: 'invalid_submission' };
  }
  if (
    typeof parsed.slug !== 'string' ||
    parsed.slug.length < 1 ||
    parsed.slug.length > 200 ||
    typeof parsed.attemptId !== 'string' ||
    !UUID_PATTERN.test(parsed.attemptId) ||
    !isRecord(parsed.answers)
  ) {
    return { ok: false, reason: 'invalid_submission' };
  }

  return {
    ok: true,
    value: {
      slug: parsed.slug,
      answers: parsed.answers,
      attemptId: parsed.attemptId,
    },
  };
}

function numericAnswer(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (
    typeof value !== 'string' ||
    value.length > 100 ||
    !DECIMAL_PATTERN.test(value.trim())
  ) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function answerForQuestion(
  value: unknown,
  question: SubmissionQuestion,
): AnswerValue | null {
  if (question.type === 'multiple_choice') {
    const choiceCount = question.choices?.length ?? 0;
    return typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= 0 &&
      value < choiceCount
      ? value
      : null;
  }
  if (question.type === 'multi_select') {
    const choiceCount = question.choices?.length ?? 0;
    if (!Array.isArray(value) || value.length > choiceCount) {
      return null;
    }
    const indices = value.filter(
      (item): item is number =>
        typeof item === 'number' &&
        Number.isInteger(item) &&
        item >= 0 &&
        item < choiceCount,
    );
    if (
      indices.length !== value.length ||
      new Set(indices).size !== value.length
    ) {
      return null;
    }
    return [...indices].sort((a, b) => a - b);
  }
  return numericAnswer(value);
}

export function validateQuizAnswers(
  answers: Record<string, unknown>,
  questions: readonly SubmissionQuestion[],
): Result<AnswerMap> {
  const questionsById = new Map(
    questions.map((question) => [question.id, question]),
  );
  const canonical: AnswerMap = {};

  for (const [questionId, value] of Object.entries(answers)) {
    const question = questionsById.get(questionId);
    if (!question) return { ok: false, reason: 'invalid_answers' };
    const answer = answerForQuestion(value, question);
    if (answer === null) return { ok: false, reason: 'invalid_answers' };
    canonical[questionId] = answer;
  }

  return { ok: true, value: canonical };
}
