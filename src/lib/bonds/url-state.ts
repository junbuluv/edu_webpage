// Read/write bond state from the URL query string.

import type { BondSnapshot } from './presets';

const NUMERIC_KEYS = ['coupon', 'face', 'maturity', 'yieldRate'] as const;

export function readBondFromURL(): Partial<BondSnapshot> {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const out: Partial<BondSnapshot> = {};
  for (const k of NUMERIC_KEYS) {
    const raw = params.get(k);
    if (raw === null) continue;
    const n = Number(raw);
    if (Number.isFinite(n)) out[k] = n;
  }
  const z = params.get('zero');
  if (z !== null) out.zero = z === '1' || z === 'true';
  return out;
}

export function writeBondToURL(state: BondSnapshot): void {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  params.set('coupon', String(roundTo(state.coupon, 4)));
  params.set('face', String(roundTo(state.face, 0)));
  params.set('maturity', String(state.maturity));
  params.set('yieldRate', String(roundTo(state.yieldRate, 4)));
  params.set('zero', state.zero ? '1' : '0');
  const next = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
  window.history.replaceState(window.history.state, '', next);
}

export function shareableURL(state: BondSnapshot): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams();
  params.set('coupon', String(roundTo(state.coupon, 4)));
  params.set('face', String(roundTo(state.face, 0)));
  params.set('maturity', String(state.maturity));
  params.set('yieldRate', String(roundTo(state.yieldRate, 4)));
  params.set('zero', state.zero ? '1' : '0');
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

function roundTo(n: number, decimals: number): number {
  const mult = Math.pow(10, decimals);
  return Math.round(n * mult) / mult;
}
