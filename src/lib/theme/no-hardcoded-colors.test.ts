// Run: node --test src/lib/theme/no-hardcoded-colors.test.ts
//
// Components take colors from theme tokens (--chart-* in
// src/styles/global.css, Tailwind classes elsewhere), not hex literals.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const COMPONENTS = fileURLToPath(new URL('../../components/', import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(tsx|astro)$/.test(entry.name) ? [path] : [];
  });
}

function offenders(pattern: RegExp): string[] {
  return sourceFiles(COMPONENTS).flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(pattern)].map(
      (m) => `${relative(COMPONENTS, file)}: ${m[0]}`,
    ),
  );
}

// The pre-theme chart palette; each color now has a --chart-* token.
const OLD_PALETTE =
  /#(?:2563eb|dc2626|059669|f97316|dbeafe|10b981|e2e8f0|94a3b8|0f172a)\b/gi;

test('chart components use --chart-* tokens, not the old palette hexes', () => {
  assert.deepEqual(offenders(OLD_PALETTE), []);
});
