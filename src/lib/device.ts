import type { AstroCookies } from 'astro';

// Browser-identifying cookie used to deduplicate workshop stamps. Middleware
// issues it only for an authenticated visit to the protected workshop area.
//
// Soft barrier: students who clear cookies between sessions or use
// private browsing can defeat it. Pair with in-room headcount for real
// proof of attendance.

const COOKIE_NAME = 'workshop_device_id';
const LEGACY_COOKIE_NAME = 'device_id';
const SIX_MONTHS_SECONDS = 60 * 60 * 24 * 180;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function ensureDeviceId(cookies: AstroCookies, isProd: boolean): string {
  const current = cookies.get(COOKIE_NAME)?.value;
  const legacy = cookies.get(LEGACY_COOKIE_NAME)?.value;
  if (legacy) cookies.delete(LEGACY_COOKIE_NAME, { path: '/' });
  if (current && UUID_PATTERN.test(current)) {
    return current;
  }
  const existing = legacy && UUID_PATTERN.test(legacy) ? legacy : null;
  if (existing) {
    setDeviceCookie(cookies, existing, isProd);
    return existing;
  }
  const id = generateUUIDv4();
  setDeviceCookie(cookies, id, isProd);
  return id;
}

function setDeviceCookie(
  cookies: AstroCookies,
  id: string,
  isProd: boolean,
): void {
  cookies.set(COOKIE_NAME, id, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: SIX_MONTHS_SECONDS,
  });
}

export function readDeviceId(cookies: AstroCookies): string | null {
  const v = cookies.get(COOKIE_NAME)?.value;
  return v && UUID_PATTERN.test(v) ? v : null;
}

export function clearWorkshopDeviceId(cookies: AstroCookies): void {
  cookies.delete(COOKIE_NAME, { path: '/' });
  cookies.delete(LEGACY_COOKIE_NAME, { path: '/' });
}

function generateUUIDv4(): string {
  // Prefer crypto.randomUUID when available (Node 19+, all modern
  // runtimes). Fallback hand-roll for safety.
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && 'getRandomValues' in c) {
    (c as unknown as Crypto).getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}
