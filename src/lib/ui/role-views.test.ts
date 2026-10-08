// Run: node --test src/lib/ui/role-views.test.ts
//
// Copy each role sees should describe the site as it is (role audit,
// 2026-10-07): no features that do not exist, no retired roles, no developer
// documentation on the instructor hub, and a real 403 for a denied archive.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return sources(p);
    return /\.(ts|tsx|astro)$/.test(e.name) && !e.name.endsWith('.test.ts')
      ? [p]
      : [];
  });
}

test('browse-mode banner lists what enrollment really unlocks', () => {
  const page = read('pages/dashboard/index.astro');
  const start = page.indexOf('Browse mode.');
  assert.notEqual(start, -1);
  const banner = page.slice(start, page.indexOf('</p>', start));
  for (const feature of ['archive', 'tutor', 'stamp']) {
    assert.match(banner, new RegExp(feature, 'i'), `banner omits ${feature}`);
  }
  assert.doesNotMatch(banner, /proctored|exam administration/i);
});

test('the instructor hub pluralizes and keeps developer docs off the page', () => {
  const hub = read('pages/instructor/index.astro');
  assert.doesNotMatch(hub, /CONTRIBUTING\.md/);
  assert.match(hub, /pluralize\(\s*workshops\.length,\s*'workshop'\s*\)/);
});

test('the course card names its list and shows the enrolled section', () => {
  const card = read('components/course/CourseHeaderCard.astro');
  assert.match(
    card,
    /Course \$\{pluralize\(instructors\.length, 'instructor'\)\}/,
  );
  assert.match(card, /Section \$\{enrolledSection\}/);
});

test('a denied course archive answers 403', () => {
  for (const course of ['eco-1002', 'fin-3610']) {
    assert.match(
      read(`pages/${course}/archive.astro`),
      /if \(!canView && !archiveUnavailable\) Astro\.response\.status = 403;/,
      `${course} archive denial is not a 403`,
    );
  }
});

test('nothing outside tests names the retired ta role', () => {
  const offenders = sources(SRC)
    .filter((f) => !f.endsWith('lib/roles.ts')) // its history comment
    .flatMap((f) =>
      readFileSync(f, 'utf8')
        .split('\n')
        .map((line, i) => ({ line, i }))
        .filter(({ line }) => /(^|[^\w'])ta([^\w']|$)/i.test(line))
        .map(({ line, i }) => `${relative(SRC, f)}:${i + 1}: ${line.trim()}`),
    );
  assert.deepEqual(offenders, []);
});
