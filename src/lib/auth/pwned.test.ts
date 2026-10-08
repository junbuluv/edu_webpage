// Run: node --test src/lib/auth/pwned.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPwned, countInRange, sha1Hex } from './pwned.ts';

// SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
const PREFIX = '5BAA6';
const SUFFIX = '1E4C9B93F3F0682250B6CF8331B7EE68FD8';

function fakeFetch(body: string, status = 200) {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  const fn = (async (url: string, init?: RequestInit) => {
    calls.push({
      url,
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    return new Response(body, { status });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

test('sha1Hex matches the known SHA-1 of "password"', async () => {
  assert.equal(await sha1Hex('password'), PREFIX + SUFFIX);
});

test('countInRange finds the suffix, ignores case, padding, and other rows', () => {
  const body = `0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n${SUFFIX.toLowerCase()}:9545824\r\nFFFF:0`;
  assert.equal(countInRange(body, SUFFIX), 9545824);
  assert.equal(countInRange(body, 'ABCDEF'), 0);
});

test('a breached password is reported, sending only the hash prefix', async () => {
  const { fn, calls } = fakeFetch(`${SUFFIX}:42\r\n`);
  assert.deepEqual(await checkPwned('password', fn), {
    status: 'pwned',
    count: 42,
  });
  assert.equal(calls[0].url, `https://api.pwnedpasswords.com/range/${PREFIX}`);
  assert.equal(calls[0].headers['Add-Padding'], 'true');
  assert.ok(!calls[0].url.includes(SUFFIX));
});

test('a padded zero count is clean', async () => {
  const { fn } = fakeFetch(`${SUFFIX}:0\r\n`);
  assert.deepEqual(await checkPwned('password', fn), { status: 'clean' });
});

test('errors, bad statuses, and timeouts fail open as unavailable', async () => {
  const failing = (async () => {
    throw new Error('network down');
  }) as unknown as typeof fetch;
  assert.deepEqual(await checkPwned('password', failing), {
    status: 'unavailable',
  });
  assert.deepEqual(await checkPwned('password', fakeFetch('', 503).fn), {
    status: 'unavailable',
  });
  const hanging = ((_url: string, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () =>
        reject(new Error('aborted')),
      );
    })) as unknown as typeof fetch;
  assert.deepEqual(await checkPwned('password', hanging, 20), {
    status: 'unavailable',
  });
});

// Every form that sets a password runs the check (after the length check).
test('signup, password change, and reset all check for breached passwords', async () => {
  const { readFileSync } = await import('node:fs');
  for (const route of ['auth/signup', 'account/password', 'auth/reset']) {
    const src = readFileSync(
      new URL(`../../pages/api/${route}.ts`, import.meta.url),
      'utf8',
    );
    assert.match(src, /checkPwned\(password\)/, `${route} does not check`);
    assert.match(src, /PWNED_PASSWORD_MESSAGE/, `${route} does not explain`);
  }
});
