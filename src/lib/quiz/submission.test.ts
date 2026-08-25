import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_QUIZ_SUBMISSION_BYTES,
  parseQuizSubmissionEnvelope,
  readQuizSubmissionBody,
  validateQuizAnswers,
  type SubmissionQuestion,
} from './submission.ts';

const questions: SubmissionQuestion[] = [
  { id: 'mc', type: 'multiple_choice', choices: ['A', 'B'] },
  { id: 'multi', type: 'multi_select', choices: ['A', 'B', 'C'] },
  { id: 'numeric', type: 'numeric' },
];

test('quiz submission accepts only the expected envelope', () => {
  const parsed = parseQuizSubmissionEnvelope(
    JSON.stringify({
      slug: 'quiz-one',
      answers: {},
      attemptId: '51d60934-caf8-4ebc-9e86-a2d32b849ac7',
    }),
  );
  assert.equal(parsed.ok, true);
  assert.equal(
    parseQuizSubmissionEnvelope(
      JSON.stringify({
        slug: 'quiz-one',
        answers: {},
        attemptId: '51d60934-caf8-4ebc-9e86-a2d32b849ac7',
        nested: {},
      }),
    ).ok,
    false,
  );
  assert.equal(
    parseQuizSubmissionEnvelope(
      JSON.stringify({ slug: 'quiz-one', answers: [], attemptId: 'bad' }),
    ).ok,
    false,
  );
});

test('quiz answers are canonicalized by known question type and range', () => {
  assert.deepEqual(
    validateQuizAnswers(
      { mc: 1, multi: [2, 0], numeric: ' -1.25e2 ' },
      questions,
    ),
    {
      ok: true,
      value: { mc: 1, multi: [0, 2], numeric: -125 },
    },
  );
});

test('quiz answers reject unknown ids, nested values, duplicates, and bad ranges', () => {
  for (const answers of [
    { unknown: 0 },
    { mc: { choice: 0 } },
    { mc: 2 },
    { multi: [0, 0] },
    { multi: [3] },
    { numeric: '0x10' },
    { numeric: '1e999' },
  ]) {
    assert.deepEqual(validateQuizAnswers(answers, questions), {
      ok: false,
      reason: 'invalid_answers',
    });
  }
});

test('quiz request reader enforces actual UTF-8 bytes without Content-Length', async () => {
  const exact = new Request('https://example.test/api/quiz/grade', {
    method: 'POST',
    body: 'a'.repeat(MAX_QUIZ_SUBMISSION_BYTES),
  });
  const accepted = await readQuizSubmissionBody(exact);
  assert.equal(accepted.ok && accepted.value.length, MAX_QUIZ_SUBMISSION_BYTES);

  const oversized = new Request('https://example.test/api/quiz/grade', {
    method: 'POST',
    body: '🙂'.repeat(MAX_QUIZ_SUBMISSION_BYTES / 4 + 1),
  });
  assert.deepEqual(await readQuizSubmissionBody(oversized), {
    ok: false,
    reason: 'body_too_large',
  });
});
