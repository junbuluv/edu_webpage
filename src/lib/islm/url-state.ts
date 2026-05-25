// Read/write IS-LM state from the URL query string so settings are
// shareable and survive a refresh. Uses history.replaceState (no
// navigation) and ignores invalid values silently.

import type { ISLMSnapshot } from './presets';

const KEYS = ['G', 'M', 'A0'] as const;

export function readISLMFromURL(): Partial<ISLMSnapshot> {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const out: Partial<ISLMSnapshot> = {};
  for (const k of KEYS) {
    const raw = params.get(k);
    if (raw === null) continue;
    const n = Number(raw);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

export function writeISLMToURL(state: ISLMSnapshot): void {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  for (const k of KEYS) {
    params.set(k, String(roundTo(state[k], 1)));
  }
  const next = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
  window.history.replaceState(window.history.state, '', next);
}

export function shareableURL(state: ISLMSnapshot): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams();
  for (const k of KEYS) {
    params.set(k, String(roundTo(state[k], 1)));
  }
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

function roundTo(n: number, decimals: number): number {
  const mult = Math.pow(10, decimals);
  return Math.round(n * mult) / mult;
}
