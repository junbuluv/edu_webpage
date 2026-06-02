import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quizQuestionsSchema } from './question-schema.ts';

test('accepts a valid mixed question array', () => {
  const r = quizQuestionsSchema.safeParse([
    {
      type: 'multiple_choice',
      id: 'q1',
      prompt: 'p',
      choices: ['a', 'b'],
      correctIndex: 0,
      explanation: 'e',
    },
    { type: 'numeric', id: 'q2', prompt: 'p', answer: 1.5, explanation: 'e' },
    {
      type: 'multi_select',
      id: 'q3',
      prompt: 'p',
      choices: ['a', 'b', 'c'],
      correctIndices: [0, 2],
      explanation: 'e',
    },
  ]);
  assert.equal(r.success, true);
});

test('rejects empty array', () => {
  assert.equal(quizQuestionsSchema.safeParse([]).success, false);
});

test('rejects multiple_choice with no choices / bad index', () => {
  assert.equal(
    quizQuestionsSchema.safeParse([
      {
        type: 'multiple_choice',
        id: 'q',
        prompt: 'p',
        choices: ['only-one'],
        correctIndex: 0,
        explanation: 'e',
      },
    ]).success,
    false,
  );
});

test('rejects unknown type', () => {
  assert.equal(
    quizQuestionsSchema.safeParse([
      { type: 'essay', id: 'q', prompt: 'p', explanation: 'e' },
    ]).success,
    false,
  );
});
