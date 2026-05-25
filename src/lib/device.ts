import type { AstroCookies } from 'astro';

// Browser-identifying cookie used to deduplicate workshop stamps. Issued
// by middleware on first visit so it's available across the whole site.
//
// Soft barrier: students who clear cookies between sessions or use
// private browsing can defeat it. Pair with in-room headcount for real
// proof of attendance.

const COOKIE_NAME = 'device_id';
const FIVE_YEARS_SECONDS = 60 * 60 * 24 * 365 * 5;

export function ensureDeviceId(cookies: AstroCookies, isProd: boolean): string {
  const existing = cookies.get(COOKIE_NAME)?.value;
  if (existing && /^[0-9a-f-]{8,}$/i.test(existing)) {
    return existing;
  }
  const id = generateUUIDv4();
  cookies.set(COOKIE_NAME, id, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: FIVE_YEARS_SECONDS,
  });
  return id;
}

export function readDeviceId(cookies: AstroCookies): string | null {
  const v = cookies.get(COOKIE_NAME)?.value;
  return v && /^[0-9a-f-]{8,}$/i.test(v) ? v : null;
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
