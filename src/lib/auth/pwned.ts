// Breached-password check against the Pwned Passwords range API (k-anonymity):
// only the first five hex characters of the password's SHA-1 leave the server,
// and Add-Padding hides the real response size. Supabase's own leaked-password
// protection needs the Pro plan, so the site checks the passwords set through
// its own forms (signup, password change, reset). Fails open: if the service
// is slow or down, the password is accepted rather than blocking signup.
// Pure and alias-free; fetch is injectable for tests.

export type PwnedResult =
  | { status: 'pwned'; count: number }
  | { status: 'clean' }
  | { status: 'unavailable' };

export const PWNED_PASSWORD_MESSAGE =
  'That password appears in known data breaches. Please choose a different one.';

const RANGE_URL = 'https://api.pwnedpasswords.com/range/';

export async function sha1Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-1',
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, '0'),
  )
    .join('')
    .toUpperCase();
}

/** Breach count for `suffix` in a range response ("SUFFIX:COUNT" lines). */
export function countInRange(body: string, suffix: string): number {
  const want = suffix.toUpperCase();
  for (const line of body.split('\n')) {
    const [s, c] = line.trim().split(':');
    if (s?.toUpperCase() === want) return Number.parseInt(c ?? '', 10) || 0;
  }
  return 0;
}

export async function checkPwned(
  password: string,
  fetchFn: typeof fetch = fetch,
  timeoutMs = 2500,
): Promise<PwnedResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const hash = await sha1Hex(password);
    const res = await fetchFn(RANGE_URL + hash.slice(0, 5), {
      headers: { 'Add-Padding': 'true' },
      signal: controller.signal,
    });
    if (!res.ok) return { status: 'unavailable' };
    const count = countInRange(await res.text(), hash.slice(5));
    return count > 0 ? { status: 'pwned', count } : { status: 'clean' };
  } catch {
    return { status: 'unavailable' };
  } finally {
    clearTimeout(timer);
  }
}
