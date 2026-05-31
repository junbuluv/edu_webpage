// Run: node --test src/lib/quiz/grade.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradeQuiz, type GradableQuestion } from './grade.ts';

const questions: GradableQuestion[] = [
  { type: 'multiple_choice', id: 'q1', correctIndex: 2, explanation: 'mc', points: 1 },
  { type: 'multi_select', id: 'q2', correctIndices: [0, 3], explanation: 'ms', points: 2 },
  { type: 'numeric', id: 'q3', answer: 10, tolerance: 0.5, explanation: 'num', points: 1 },
];

test('all correct → full score, passed', () => {
  const r = gradeQuiz(questions, { q1: 2, q2: [3, 0], q3: '10.2' });
  assert.equal(r.score, 4);
  assert.equal(r.maxScore, 4);
  assert.equal(r.passed, true);
  assert.equal(r.perQuestion.q2.awarded, 2);
});

test('multi_select is order-independent but exact-set', () => {
  assert.equal(gradeQuiz(questions, { q2: [0, 3] }).perQuestion.q2.correct, true);
  assert.equal(gradeQuiz(questions, { q2: [3, 0] }).perQuestion.q2.correct, true);
  assert.equal(gradeQuiz(questions, { q2: [0] }).perQuestion.q2.correct, false); // subset
  assert.equal(gradeQuiz(questions, { q2: [0, 1, 3] }).perQuestion.q2.correct, false); // superset
});

test('numeric respects tolerance band', () => {
  assert.equal(gradeQuiz(questions, { q3: '10.5' }).perQuestion.q3.correct, true); // edge
  assert.equal(gradeQuiz(questions, { q3: '9.5' }).perQuestion.q3.correct, true);
  assert.equal(gradeQuiz(questions, { q3: '10.6' }).perQuestion.q3.correct, false);
  assert.equal(gradeQuiz(questions, { q3: 'abc' }).perQuestion.q3.correct, false);
});

test('missing / wrong-type answers score 0, never throw', () => {
  const r = gradeQuiz(questions, {}); // nothing answered
  assert.equal(r.score, 0);
  assert.equal(r.passed, false);
  assert.equal(gradeQuiz(questions, { q1: [1, 2] }).perQuestion.q1.correct, false); // array for MC
});

test('passing threshold uses fraction', () => {
  // 3/4 = 0.75
  assert.equal(gradeQuiz(questions, { q1: 2, q2: [0, 3] }).passed, true); // 0.75 >= 0.7
  assert.equal(gradeQuiz(questions, { q2: [0, 3] }).passed, false); // 2/4 = 0.5
});

test('explanation is returned per question (post-submit feedback)', () => {
  const r = gradeQuiz(questions, { q1: 0 });
  assert.equal(r.perQuestion.q1.explanation, 'mc');
  assert.equal(r.perQuestion.q1.correct, false);
});
