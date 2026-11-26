// Seeded random numbers for the case studies' random-draw simulations. A
// fixed seed makes the server render and the browser agree, and makes tests
// exact. Alias-free so `node --test` can import it.

/** Mulberry32: a small, fast generator of numbers in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A draw from a triangular distribution: most likely `mode`, never below
 * `low` or above `high`. `u` is a uniform number in [0, 1]; this is the
 * inverse of the distribution's cumulative probability.
 */
export function triangular(
  u: number,
  low: number,
  mode: number,
  high: number,
): number {
  if (high <= low) return low;
  const peak = (mode - low) / (high - low);
  return u < peak
    ? low + Math.sqrt(u * (high - low) * (mode - low))
    : high - Math.sqrt((1 - u) * (high - low) * (high - mode));
}
