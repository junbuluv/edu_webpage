import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_APP_MUTATION_BYTES,
  mutationRequestVerdict,
} from './mutation-request.ts';

test('safe methods and same-origin mutations pass', () => {
  assert.equal(
    mutationRequestVerdict(new Request('https://example.edu/admin')),
    'ok',
  );
  assert.equal(
    mutationRequestVerdict(
      new Request('https://internal.vercel/admin', {
        method: 'POST',
        headers: {
          origin: 'https://course.example.edu',
          'x-forwarded-host': 'course.example.edu',
          'x-forwarded-proto': 'https',
        },
      }),
    ),
    'ok',
  );
});

test('configured Vercel hosts pass with or without a scheme', () => {
  const request = new Request('https://internal.vercel/api', {
    method: 'POST',
    headers: { origin: 'https://preview.vercel.app' },
  });
  assert.equal(mutationRequestVerdict(request, ['preview.vercel.app']), 'ok');
});

test('cross-site, null, and malformed origins fail', () => {
  const cases: HeadersInit[] = [
    [['origin', 'https://evil.example']],
    [['origin', 'null']],
    [['sec-fetch-site', 'cross-site']],
  ];
  for (const headers of cases) {
    assert.equal(
      mutationRequestVerdict(
        new Request('https://course.example.edu/api', {
          method: 'POST',
          headers,
        }),
      ),
      'invalid_origin',
    );
  }
});

test('oversized declared app bodies fail before parsing', () => {
  assert.equal(
    mutationRequestVerdict(
      new Request('https://course.example.edu/api', {
        method: 'POST',
        headers: { 'content-length': String(MAX_APP_MUTATION_BYTES + 1) },
      }),
    ),
    'body_too_large',
  );
});

test('origin-less non-browser clients remain supported', () => {
  assert.equal(
    mutationRequestVerdict(
      new Request('https://course.example.edu/api', { method: 'POST' }),
    ),
    'ok',
  );
});
