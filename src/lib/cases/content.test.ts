// Run: node --test src/lib/cases/content.test.ts
//
// A case study names the lessons to read first and its practice quiz by
// slug. A typo would silently drop the "Read first" link or 404 the quiz
// button, so check every reference against the files on disk.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const CONTENT = fileURLToPath(new URL('../../content/', import.meta.url));

const cases = readdirSync(join(CONTENT, 'cases'), { recursive: true })
  .map(String)
  .filter((f) => f.endsWith('.mdx'))
  .map((f) => {
    const text = readFileSync(join(CONTENT, 'cases', f), 'utf8');
    const front = text.split(/^---$/m)[1] ?? '';
    const value = (key: string) =>
      front.match(new RegExp(`^${key}:\\s*'?([^'\\n]+)'?\\s*$`, 'm'))?.[1];
    const list = front.match(/^relatedLessons:\n((?:\s+-\s.*\n)+)/m)?.[1] ?? '';
    return {
      slug: f.replace(/\.mdx$/, '').replaceAll('\\', '/'),
      course: value('course'),
      quizSlug: value('quizSlug'),
      relatedLessons: [...list.matchAll(/-\s*'?([^'\n]+)'?/g)].map((m) => m[1]),
    };
  });

test('there is at least one case study, filed under its course', () => {
  assert.ok(cases.length > 0);
  for (const c of cases) assert.equal(c.slug.split('/')[0], c.course, c.slug);
});

test('every lesson a case says to read first exists', () => {
  for (const c of cases) {
    assert.ok(c.relatedLessons.length > 0, `${c.slug} names no lesson`);
    for (const lesson of c.relatedLessons) {
      assert.ok(
        existsSync(join(CONTENT, 'lessons', `${lesson}.mdx`)),
        `${c.slug}: no lesson ${lesson}`,
      );
    }
  }
});

test('every case has a practice quiz that links back to it', () => {
  for (const c of cases) {
    assert.ok(c.quizSlug, `${c.slug} has no quizSlug`);
    const path = join(CONTENT, 'quizzes', `${c.quizSlug}.json`);
    assert.ok(existsSync(path), `${c.slug}: no quiz ${c.quizSlug}`);
    const quiz = JSON.parse(readFileSync(path, 'utf8'));
    assert.equal(quiz.slug, c.quizSlug);
    assert.equal(quiz.caseSlug, c.slug);
    assert.equal(quiz.course, c.course);
  }
});
