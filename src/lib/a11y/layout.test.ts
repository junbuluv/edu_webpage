// Run: node --test src/lib/a11y/layout.test.ts
//
// Page-level accessibility the base layout owes every page: a skip link to the
// main content (WCAG 2.4.1) and a footer link to the accessibility statement.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const layout = readFileSync(
  fileURLToPath(new URL('../../layouts/BaseLayout.astro', import.meta.url)),
  'utf8',
);

test('a skip link precedes the header and targets <main id="main">', () => {
  const skip = layout.indexOf('href="#main"');
  assert.notEqual(skip, -1, 'BaseLayout has no skip link to #main');
  assert.ok(
    skip < layout.indexOf('<header'),
    'the skip link must come before the header',
  );
  assert.match(layout, /<main\b[^>]*\bid="main"/, '<main> needs id="main"');
});

test('the footer links to the accessibility statement, which exists', () => {
  const footer = layout.slice(layout.indexOf('<footer'));
  assert.match(footer, /href="\/accessibility"/);
  assert.ok(
    existsSync(
      fileURLToPath(
        new URL('../../pages/accessibility.astro', import.meta.url),
      ),
    ),
    'src/pages/accessibility.astro is missing',
  );
});
