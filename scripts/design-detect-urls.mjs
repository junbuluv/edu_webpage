// Prints the public page URLs the design-detect CI job scans with
// `npx impeccable detect`: fixed public routes, every published lesson,
// every practice quiz, and each instructor's course page.
// Usage: npx impeccable detect $(node scripts/design-detect-urls.mjs [origin])
import { readdirSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const origin = process.argv[2] ?? 'http://localhost:4321';
const content = new URL('../src/content/', import.meta.url);
const list = (dir) => readdirSync(new URL(dir, content));
const read = (path) => readFileSync(new URL(path, content), 'utf8');

const paths = [
  '/',
  '/accessibility',
  '/privacy',
  '/terms',
  '/practice',
  '/auth/signin',
  '/auth/signup',
  '/auth/forgot',
  '/auth/check-email',
];
for (const course of list('courses').map((f) => f.replace(/\.json$/, ''))) {
  paths.push(`/${course}`, `/${course}/instructors`, `/${course}/workshops`);
  for (const f of list(`lessons/${course}/`)) {
    if (!/^draft:\s*true\b/m.test(read(`lessons/${course}/${f}`))) {
      paths.push(`/lessons/${course}/${f.replace(/\.mdx$/, '')}`);
    }
  }
}
for (const f of list('quizzes')) {
  paths.push(`/practice/${f.replace(/\.json$/, '')}`);
}
for (const f of list('instructors')) {
  const courses = read(`instructors/${f}`).match(/^courses:\s*\[(.*)\]/m);
  for (const course of courses?.[1].match(/[a-z]+-\d+/g) ?? []) {
    paths.push(`/${course}/instructors/${f.replace(/\.mdx$/, '')}`);
  }
}

assert.ok(
  paths.some((p) => p.startsWith('/lessons/')),
  'no lessons found',
);
assert.equal(new Set(paths).size, paths.length, 'duplicate URL');
console.log(paths.map((p) => origin + p).join('\n'));
