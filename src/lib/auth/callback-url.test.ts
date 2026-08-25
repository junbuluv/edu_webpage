import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAuthCallbackUrl } from './callback-url.ts';

test('buildAuthCallbackUrl routes recovery through the PKCE callback', () => {
  assert.equal(
    buildAuthCallbackUrl(
      'https://example.test',
      'http://localhost:4321/signup',
      '/auth/reset',
    ),
    'https://example.test/auth/callback?next=%2Fauth%2Freset',
  );
});

test('buildAuthCallbackUrl rejects an external next destination', () => {
  assert.equal(
    buildAuthCallbackUrl(
      'https://example.test/',
      'http://localhost:4321/signup',
      'https://evil.test',
    ),
    'https://example.test/auth/callback?next=%2F',
  );
});

test('buildAuthCallbackUrl falls back to the request origin for previews', () => {
  assert.equal(
    buildAuthCallbackUrl('', 'https://preview.example.test/auth/signup', '/'),
    'https://preview.example.test/auth/callback?next=%2F',
  );
});

test('buildAuthCallbackUrl accepts a host-only Vercel deployment value', () => {
  assert.equal(
    buildAuthCallbackUrl(
      'edu-web-git-feature.vercel.app',
      'http://localhost:4321/auth/signup',
      '/',
    ),
    'https://edu-web-git-feature.vercel.app/auth/callback?next=%2F',
  );
});
