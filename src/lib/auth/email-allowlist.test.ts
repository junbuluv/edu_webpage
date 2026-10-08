import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ALLOWED_EMAIL_DOMAINS, isAllowedEmail } from './email-allowlist.ts';

test('accepts listed domains regardless of case and surrounding space', () => {
  assert.equal(isAllowedEmail('Student@BaruchMail.CUNY.edu'), true);
  assert.equal(isAllowedEmail('  someone@gmail.com '), true);
});

test('rejects unlisted and lookalike domains', () => {
  assert.equal(isAllowedEmail('someone@yahoo.com'), false);
  assert.equal(isAllowedEmail('someone@baruch.cuny.edu.evil.example'), false);
  assert.equal(isAllowedEmail('someone@notbaruch.cuny.edu'), false);
  assert.equal(isAllowedEmail('no-at-sign'), false);
});

// The signup form checks ALLOWED_EMAIL_DOMAINS, but anyone with the public
// anon key can call Supabase Auth directly, so the same list is enforced by
// the Before User Created hook in schema.sql. The two must never drift.
test('the Auth hook in schema.sql allows exactly ALLOWED_EMAIL_DOMAINS', () => {
  const schema = readFileSync(
    new URL('../../../supabase/schema.sql', import.meta.url),
    'utf8',
  );
  const start = schema.indexOf(
    'create or replace function public.hook_before_user_created',
  );
  assert.notEqual(
    start,
    -1,
    'hook_before_user_created is missing from schema.sql',
  );
  const body = schema.slice(start, schema.indexOf('$$;', start));
  const array = body.match(/array\[([^\]]*)\]/);
  assert.ok(array, 'hook_before_user_created has no domain array');
  const hookDomains = [...array[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual([...hookDomains].sort(), [...ALLOWED_EMAIL_DOMAINS].sort());
});
