import assert from 'node:assert/strict';
import test from 'node:test';
import { CURRENT_TERMS_VERSION, hasAcceptedCurrentTerms } from './terms.ts';

test('requires both a timestamp and the current policy version', () => {
  assert.equal(hasAcceptedCurrentTerms(null), false);
  assert.equal(
    hasAcceptedCurrentTerms({
      tos_accepted_at: new Date().toISOString(),
      tos_version: 'older',
    }),
    false,
  );
  assert.equal(
    hasAcceptedCurrentTerms({
      tos_accepted_at: null,
      tos_version: CURRENT_TERMS_VERSION,
    }),
    false,
  );
  assert.equal(
    hasAcceptedCurrentTerms({
      tos_accepted_at: new Date().toISOString(),
      tos_version: CURRENT_TERMS_VERSION,
    }),
    true,
  );
});

// Accepting the terms also acknowledges the Privacy Policy, so a newer
// "Last updated" on either page must bump CURRENT_TERMS_VERSION, which sends
// every signed-in account back through /account/terms once.
test('the acceptance version is not older than either policy page', async () => {
  const { readFileSync } = await import('node:fs');
  for (const page of ['privacy', 'terms']) {
    const src = readFileSync(
      new URL(`../../pages/${page}.astro`, import.meta.url),
      'utf8',
    );
    const m = src.match(/const lastUpdated = '(\d{4}-\d{2}-\d{2})'/);
    assert.ok(m, `${page}.astro has no lastUpdated date`);
    assert.ok(
      CURRENT_TERMS_VERSION >= m[1],
      `/${page} was updated ${m[1]} but CURRENT_TERMS_VERSION is ${CURRENT_TERMS_VERSION}`,
    );
  }
});
