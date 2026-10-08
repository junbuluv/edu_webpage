// Run: node --test src/lib/a11y/focus-start.test.ts
//
// Code that runs as a page loads must not call scrollIntoView(): Chromium also
// moves the sequential-focus starting point to that element, so the first Tab
// skips the skip link and the header. The lesson sidebar did this on every
// lesson page until 2026-10-07. (TutorPanel scrolls the chat after a student
// sends a message, which is fine.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const LOAD_TIME = ['../../components/lesson/LessonSidebar.tsx'];

test('components that run on page load do not call scrollIntoView', () => {
  const offenders = LOAD_TIME.filter((rel) =>
    readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8').includes(
      'scrollIntoView(',
    ),
  );
  assert.deepEqual(offenders, []);
});
