import { safeNext } from './safe-next.ts';

export function buildAuthCallbackUrl(
  siteUrl: string | null | undefined,
  requestUrl: string,
  next: string | null | undefined,
): string {
  const configuredBase = siteUrl?.trim();
  const base = configuredBase
    ? /^https?:\/\//i.test(configuredBase)
      ? configuredBase
      : `https://${configuredBase}`
    : requestUrl;
  const parsedBase = new URL(base);
  if (parsedBase.protocol !== 'http:' && parsedBase.protocol !== 'https:') {
    throw new TypeError('Auth callback base must use HTTP or HTTPS.');
  }

  const callback = new URL('/auth/callback', parsedBase.origin);
  callback.searchParams.set('next', safeNext(next));
  return callback.toString();
}
