// Run: node --test src/lib/privacy/disclosure.test.ts
//
// /privacy must describe what the Service actually does. When the AI study
// tutor is on for any course, the notice names who processes tutor messages;
// it names the service providers that handle records; its retention periods
// match the purge jobs in schema.sql; and it does not promise that the project
// owner is the only administrator.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const path = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const privacy = readFileSync(path('../../pages/privacy.astro'), 'utf8');
const schema = readFileSync(path('../../../supabase/schema.sql'), 'utf8');
const coursesDir = path('../../content/courses/');
const tutorOn = readdirSync(coursesDir)
  .filter((f) => f.endsWith('.json'))
  .some((f) => JSON.parse(readFileSync(coursesDir + f, 'utf8')).tutor === true);

function purgeDefault(fn: string, unit: string): string {
  const m = schema.match(
    new RegExp(`function public\\.${fn}\\(p_\\w+ integer default (\\d+)\\)`),
  );
  assert.ok(m, `${fn} not found in schema.sql`);
  return `${m[1]} ${unit}`;
}

test('the tutor and the processors of its messages are disclosed', () => {
  assert.ok(
    tutorOn,
    'no course has the tutor on; drop this test with the tutor',
  );
  for (const phrase of ['AI study tutor', 'OpenAI', 'AI Gateway']) {
    assert.ok(
      privacy.includes(phrase),
      `/privacy does not mention "${phrase}"`,
    );
  }
});

test('service providers that handle records are named', () => {
  for (const name of ['Supabase', 'Vercel', 'Resend', 'OpenAI']) {
    assert.ok(privacy.includes(name), `/privacy does not name ${name}`);
  }
});

test('retention periods match the purge jobs in schema.sql', () => {
  for (const period of [
    purgeDefault('purge_old_tutor_messages', 'days'),
    purgeDefault('purge_old_quiz_attempts', 'days'),
    purgeDefault('purge_inactive_accounts', 'months'),
  ]) {
    assert.ok(privacy.includes(period), `/privacy does not state "${period}"`);
  }
});

test('administrator wording does not promise a single admin', () => {
  assert.equal(privacy.includes('the project owner only'), false);
});
