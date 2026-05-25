import { useEffect, useRef, useState } from 'react';
import { easeOutCubic, type EasingFn } from './easings';

interface Options {
  /** Total tween duration in ms. Default 250. */
  durationMs?: number;
  /** Easing function. Default easeOutCubic. */
  easing?: EasingFn;
  /** Respect prefers-reduced-motion: if true (default), skip tweening entirely. */
  honorReducedMotion?: boolean;
}

/**
 * Returns a number that smoothly transitions toward `target` over the given
 * duration whenever `target` changes. Cancels any in-flight tween when the
 * target changes mid-flight, so values stay responsive.
 *
 * Intended for chart-driven values (slider -> equilibrium price, for
 * example) so the chart doesn't snap when the student moves a control.
 */
export function useAnimatedValue(target: number, options: Options = {}): number {
  const {
    durationMs = 250,
    easing = easeOutCubic,
    honorReducedMotion = true,
  } = options;

  const [current, setCurrent] = useState(target);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const fromRef = useRef(target);
  const toRef = useRef(target);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (honorReducedMotion) {
      const prefersReduced = window.matchMedia?.(
        '(prefers-reduced-motion: reduce)',
      ).matches;
      if (prefersReduced) {
        setCurrent(target);
        return;
      }
    }

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
    }

    // Tween from wherever we are right now toward the new target.
    fromRef.current = current;
    toRef.current = target;
    startRef.current = performance.now();

    function step(now: number) {
      const elapsed = now - startRef.current;
      const t = Math.min(1, elapsed / durationMs);
      const eased = easing(t);
      const value = fromRef.current + (toRef.current - fromRef.current) * eased;
      setCurrent(value);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        frameRef.current = null;
      }
    }

    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
    // We deliberately do NOT depend on `current` to avoid re-tweening on
    // every frame; only when `target` (or config) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs, easing, honorReducedMotion]);

  return current;
}
