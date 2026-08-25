import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CURRENT_TERMS_VERSION,
  hasAcceptedCurrentTerms,
} from './terms.ts';

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
