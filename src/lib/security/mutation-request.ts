const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const MAX_APP_MUTATION_BYTES = 2 * 1024 * 1024;

export type MutationRequestVerdict = 'ok' | 'invalid_origin' | 'body_too_large';

function firstHeaderValue(value: string | null): string | null {
  return value?.split(',', 1)[0]?.trim() || null;
}

function normalizeOrigin(value: string): string | null {
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

export function mutationRequestVerdict(
  request: Request,
  configuredOrigins: Array<string | undefined> = [],
): MutationRequestVerdict {
  if (!UNSAFE_METHODS.has(request.method.toUpperCase())) return 'ok';

  const declaredLength = Number(request.headers.get('content-length'));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_APP_MUTATION_BYTES
  ) {
    return 'body_too_large';
  }

  if (request.headers.get('sec-fetch-site')?.toLowerCase() === 'cross-site') {
    return 'invalid_origin';
  }

  const origin = request.headers.get('origin');
  // Non-browser clients and some privacy tools omit Origin. Browser CSRF
  // requests carry Origin and/or Sec-Fetch-Site, so validate whenever present.
  if (!origin) return 'ok';

  const allowed = new Set<string>();
  const requestOrigin = normalizeOrigin(request.url);
  if (requestOrigin) allowed.add(requestOrigin);

  const forwardedHost = firstHeaderValue(
    request.headers.get('x-forwarded-host'),
  );
  const host = forwardedHost ?? firstHeaderValue(request.headers.get('host'));
  if (host) {
    const protocol =
      firstHeaderValue(request.headers.get('x-forwarded-proto')) ??
      new URL(request.url).protocol.replace(':', '');
    const forwardedOrigin = normalizeOrigin(`${protocol}://${host}`);
    if (forwardedOrigin) allowed.add(forwardedOrigin);
  }

  for (const configured of configuredOrigins) {
    if (!configured) continue;
    const normalized = normalizeOrigin(configured);
    if (normalized) allowed.add(normalized);
  }

  const normalizedOrigin = normalizeOrigin(origin);
  return normalizedOrigin && allowed.has(normalizedOrigin)
    ? 'ok'
    : 'invalid_origin';
}
