// Read/write AD-AS state from the URL query string.

import type { ADASSnapshot } from './presets';

const KEYS = ['G', 'M', 'Pe', 'Yn'] as const;

export function readADASFromURL(): Partial<ADASSnapshot> {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const out: Partial<ADASSnapshot> = {};
  for (const k of KEYS) {
    const raw = params.get(k);
    if (raw === null) continue;
    const n = Number(raw);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

export function writeADASToURL(state: ADASSnapshot): void {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  for (const k of KEYS) {
    params.set(k, String(roundTo(state[k], 2)));
  }
  const next = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
  window.history.replaceState(window.history.state, '', next);
}

export function shareableURL(state: ADASSnapshot): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams();
  for (const k of KEYS) {
    params.set(k, String(roundTo(state[k], 2)));
  }
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

function roundTo(n: number, decimals: number): number {
  const mult = Math.pow(10, decimals);
  return Math.round(n * mult) / mult;
}
