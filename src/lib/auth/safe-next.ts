// Validates a "next" redirect target against open-redirect tricks. Only
// same-origin, single-leading-slash paths are accepted; everything else
// falls back to "/".

const DEFAULT = '/';

export function safeNext(raw: string | null | undefined): string {
  if (!raw) return DEFAULT;
  // Must start with exactly one "/" and not be protocol-relative ("//foo")
  // or an attempt to escape ("/\\foo" parsed as "//foo" by some browsers).
  if (
    typeof raw === 'string' &&
    raw.length > 0 &&
    raw.length < 512 &&
    raw[0] === '/' &&
    raw[1] !== '/' &&
    raw[1] !== '\\'
  ) {
    return raw;
  }
  return DEFAULT;
}
