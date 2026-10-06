// Run: node --test src/lib/tutor/prompt.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTutorInstructions, COACH_RULES } from './prompt.ts';

const input = {
  courseCode: 'ECO 1002',
  courseTitle: 'Introduction to Macroeconomics',
  lessonContext: 'Lesson: IS-LM\n\nLower $r$ raises $Y$.',
};

test('names the course and wraps the lesson', () => {
  const out = buildTutorInstructions(input);
  assert.ok(
    out.startsWith(
      'You are the study coach for ECO 1002 (Introduction to Macroeconomics) at Baruch College.',
    ),
  );
  assert.ok(
    out.endsWith('<lesson>\nLesson: IS-LM\n\nLower $r$ raises $Y$.\n</lesson>'),
  );
  assert.ok(!out.includes('{COURSE}'));
});

test('is deterministic so the provider prompt cache can reuse it', () => {
  assert.equal(buildTutorInstructions(input), buildTutorInstructions(input));
});

test('rules match the renderer and the interview decisions', () => {
  // math-delims.ts treats every bare $ as money and only \( \) / \[ \] as math
  assert.ok(COACH_RULES.includes('\\( ... \\)'));
  assert.ok(COACH_RULES.includes('Never use $ as a math delimiter'));
  // coach mode (interview answer A)
  assert.ok(
    COACH_RULES.includes(
      'Give the final number only after they have made a genuine attempt',
    ),
  );
  assert.ok(!COACH_RULES.includes('—'));
});
