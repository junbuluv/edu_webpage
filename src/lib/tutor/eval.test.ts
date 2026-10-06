// Run: node --test src/lib/tutor/eval.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  accuracyPasses,
  formatEvalQuestion,
  isRateLimitError,
  parseEvalAnswer,
  type EvalQuestion,
} from './eval.ts';

const mc: EvalQuestion = {
  type: 'multiple_choice',
  id: 'q1',
  prompt: 'IS slopes?',
  choices: ['Up', 'Down', 'Flat'],
  correctIndex: 1,
  explanation: '',
  points: 1,
};
const ms: EvalQuestion = {
  type: 'multi_select',
  id: 'q2',
  prompt: 'Shift IS right?',
  choices: ['G up', 'T up', 'Confidence up'],
  correctIndices: [0, 2],
  explanation: '',
  points: 1,
};
const num: EvalQuestion = {
  type: 'numeric',
  id: 'q3',
  prompt: 'Multiplier at MPC 0.8?',
  answer: 5,
  tolerance: 0.01,
  explanation: '',
  points: 1,
};

test('formats lettered choices and the final-line format', () => {
  const text = formatEvalQuestion(mc);
  assert.ok(text.includes('A. Up\nB. Down\nC. Flat'));
  assert.ok(text.includes('ANSWER: B'));
  assert.ok(formatEvalQuestion(ms).includes('ANSWER: A, C'));
  assert.ok(formatEvalQuestion(num).includes('ANSWER: 12.5'));
});

test('parses the last ANSWER line', () => {
  assert.equal(parseEvalAnswer(mc, 'Hmm. ANSWER: A\nActually\nANSWER: B'), 1);
  assert.deepEqual(parseEvalAnswer(ms, 'ANSWER: C, A'), [0, 2]);
  assert.equal(parseEvalAnswer(num, 'ANSWER: $5.00'), 5);
  assert.equal(parseEvalAnswer(num, 'ANSWER: 1,250.5 dollars'), 1250.5);
});

test('unparseable or ambiguous replies count as unanswered', () => {
  assert.equal(parseEvalAnswer(mc, 'I think B'), undefined);
  assert.equal(parseEvalAnswer(mc, 'ANSWER: A or B'), undefined);
  assert.equal(parseEvalAnswer(num, 'ANSWER: about five'), undefined);
});

test('pass bar: 90% of ECO points and 8 of 10 FIN numeric', () => {
  assert.equal(accuracyPasses(44, 48, 8), true);
  assert.equal(accuracyPasses(43, 48, 10), false);
  assert.equal(accuracyPasses(48, 48, 7), false);
  assert.equal(accuracyPasses(0, 0, 10), false);
});

test('recognizes gateway rate limits so the eval can wait instead of scoring a miss', () => {
  const gateway = Object.assign(
    new Error('Rate limit exceeded for openai/gpt-5-mini'),
    {
      name: 'GatewayRateLimitError',
    },
  );
  assert.equal(isRateLimitError(gateway), true);
  assert.equal(isRateLimitError({ statusCode: 429 }), true);
  assert.equal(
    isRateLimitError(
      new Error(
        'Failed after 3 attempts. Last error: GatewayRateLimitError: Rate limit exceeded',
      ),
    ),
    true,
  );
  assert.equal(isRateLimitError(new Error('socket hang up')), false);
  assert.equal(isRateLimitError(undefined), false);
});
