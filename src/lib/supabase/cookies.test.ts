import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCookieHeader } from './cookies.ts';

test('parses encoded values and preserves equals signs in values', () => {
  assert.deepEqual(parseCookieHeader('a=hello%20world; token=one=two'), [
    { name: 'a', value: 'hello world' },
    { name: 'token', value: 'one=two' },
  ]);
});

test('skips malformed pairs and malformed percent encoding', () => {
  assert.deepEqual(
    parseCookieHeader('good=value; missing; malformed=%E0%A4%A; also=ok'),
    [
      { name: 'good', value: 'value' },
      { name: 'also', value: 'ok' },
    ],
  );
});

test('accepts chunked Supabase cookie names', () => {
  assert.deepEqual(parseCookieHeader('sb-project-auth-token.0=abc'), [
    { name: 'sb-project-auth-token.0', value: 'abc' },
  ]);
});
