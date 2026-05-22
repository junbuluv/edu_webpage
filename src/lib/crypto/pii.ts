import { createHmac, timingSafeEqual } from 'node:crypto';

let cachedSecret: string | null = null;

function getSecret(): string {
  if (cachedSecret !== null) return cachedSecret;
  const secret = import.meta.env.PII_HMAC_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'PII_HMAC_SECRET must be set and at least 32 chars. ' +
        'Generate one with: openssl rand -hex 32',
    );
  }
  cachedSecret = secret;
  return secret;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function hmacPII(value: string): Buffer {
  return createHmac('sha256', getSecret()).update(normalize(value)).digest();
}

export function hmacPIIHex(value: string): string {
  return hmacPII(value).toString('hex');
}

export function hmacEquals(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}
