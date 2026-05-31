// Run: node --test src/lib/instructor/roster-csv.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRosterCsv } from './roster-csv.ts';

test('parses header-based CSV with name + section', () => {
  const { rows, errors } = parseRosterCsv(
    'email,name,section\njane@x.edu,Jane Doe,CML\njohn@x.edu,John Roe,CTL',
  );
  assert.equal(errors.length, 0);
  assert.deepEqual(rows, [
    { email: 'jane@x.edu', name: 'Jane Doe', section: 'CML' },
    { email: 'john@x.edu', name: 'John Roe', section: 'CTL' },
  ]);
});

test('email is required as a header column', () => {
  const { rows, errors } = parseRosterCsv('name,section\nJane,CML');
  assert.equal(rows.length, 0);
  assert.match(errors[0], /must include an "email" column/);
});

test('email is normalized (trim + lowercase) and de-duplicated, last wins', () => {
  const { rows } = parseRosterCsv(
    'email,name\n  JANE@X.edu ,First\njane@x.edu,Second',
  );
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    email: 'jane@x.edu',
    name: 'Second',
    section: null,
  });
});

test('missing and invalid emails are skipped with reported errors', () => {
  const { rows, errors } = parseRosterCsv(
    'email,name\n,No Email\nnot-an-email,Bad\nok@x.edu,Good',
  );
  assert.deepEqual(
    rows.map((r) => r.email),
    ['ok@x.edu'],
  );
  assert.equal(errors.length, 2);
  assert.match(errors[0], /Line 2: missing email/);
  assert.match(errors[1], /not a valid email/);
});

test('optional columns absent -> name/section null', () => {
  const { rows } = parseRosterCsv('email\na@x.edu\nb@x.edu');
  assert.deepEqual(rows, [
    { email: 'a@x.edu', name: null, section: null },
    { email: 'b@x.edu', name: null, section: null },
  ]);
});

test('quoted fields handle embedded commas and CRLF endings', () => {
  const { rows } = parseRosterCsv('email,name\r\na@x.edu,"Doe, Jane"\r\n');
  assert.deepEqual(rows, [
    { email: 'a@x.edu', name: 'Doe, Jane', section: null },
  ]);
});

test('header column order does not matter', () => {
  const { rows } = parseRosterCsv('section,email,name\nCWL,a@x.edu,Al');
  assert.deepEqual(rows[0], { email: 'a@x.edu', name: 'Al', section: 'CWL' });
});

test('empty input yields a friendly error, no rows', () => {
  const { rows, errors } = parseRosterCsv('   \n  ');
  assert.equal(rows.length, 0);
  assert.equal(errors.length, 1);
});

test('blank lines between rows are ignored', () => {
  const { rows } = parseRosterCsv('email\na@x.edu\n\n\nb@x.edu\n');
  assert.deepEqual(
    rows.map((r) => r.email),
    ['a@x.edu', 'b@x.edu'],
  );
});
