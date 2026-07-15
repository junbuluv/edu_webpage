import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quizQuestionsSchema } from '../quiz/question-schema.ts';
import { removeChoiceAt, validCoversForLessons } from './quiz-builder.ts';

test('removing a choice remaps single and multi-select answer indices', () => {
  assert.deepEqual(
    removeChoiceAt(
      {
        choices: ['a', 'b', 'c', 'd'],
        correctIndex: 3,
        correctIndices: [0, 2, 3],
      },
      1,
    ),
    {
      choices: ['a', 'c', 'd'],
      correctIndex: 2,
      correctIndices: [0, 1, 2],
    },
  );
});

test('removing the selected choice leaves a valid single answer index', () => {
  assert.deepEqual(
    removeChoiceAt(
      {
        choices: ['a', 'b', 'c'],
        correctIndex: 2,
        correctIndices: [2],
      },
      2,
    ),
    {
      choices: ['a', 'b'],
      correctIndex: 1,
      correctIndices: [],
    },
  );
});

test('choice removal stops at two choices', () => {
  const question = {
    choices: ['a', 'b'],
    correctIndex: 1,
    correctIndices: [1],
  };
  assert.equal(removeChoiceAt(question, 0), question);
});

test('course changes retain only covers valid for the next course', () => {
  assert.deepEqual(
    validCoversForLessons(['shared', 'old-only'], ['shared', 'new-only']),
    ['shared'],
  );
});

const multipleChoice = {
  type: 'multiple_choice' as const,
  id: 'q-1',
  prompt: 'Which answer is correct?',
  choices: ['First', 'Second'],
  correctIndex: 0,
  explanation: '',
};

test('question schema accepts decimal numeric answers', () => {
  assert.equal(
    quizQuestionsSchema.safeParse([
      {
        type: 'numeric',
        id: 'q-decimal',
        prompt: 'Enter the value.',
        answer: 1.25,
        explanation: '',
      },
    ]).success,
    true,
  );
});

test('question schema rejects blank prompts and choices', () => {
  assert.equal(
    quizQuestionsSchema.safeParse([{ ...multipleChoice, prompt: '   ' }])
      .success,
    false,
  );
  assert.equal(
    quizQuestionsSchema.safeParse([
      { ...multipleChoice, choices: ['First', '   '] },
    ]).success,
    false,
  );
});

test('question schema rejects out-of-range answer indices', () => {
  assert.equal(
    quizQuestionsSchema.safeParse([{ ...multipleChoice, correctIndex: 2 }])
      .success,
    false,
  );
  assert.equal(
    quizQuestionsSchema.safeParse([
      {
        type: 'multi_select',
        id: 'q-multi',
        prompt: 'Select all correct answers.',
        choices: ['First', 'Second'],
        correctIndices: [0, 2],
        explanation: '',
      },
    ]).success,
    false,
  );
});

test('question schema rejects duplicate multi-select indices', () => {
  assert.equal(
    quizQuestionsSchema.safeParse([
      {
        type: 'multi_select',
        id: 'q-multi',
        prompt: 'Select all correct answers.',
        choices: ['First', 'Second'],
        correctIndices: [0, 0],
        explanation: '',
      },
    ]).success,
    false,
  );
});

test('question schema rejects duplicate question ids', () => {
  assert.equal(
    quizQuestionsSchema.safeParse([
      multipleChoice,
      { ...multipleChoice, prompt: 'A different prompt.' },
    ]).success,
    false,
  );
});
