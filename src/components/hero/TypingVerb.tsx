import { useEffect, useRef, useState } from 'react';

interface Props {
  /** Verbs to cycle through. Order matters; cycles forever. */
  verbs: string[];
  /** Per-character type speed in ms. Default 70. */
  typeMs?: number;
  /** Per-character delete speed in ms. Default 35 (faster than typing). */
  deleteMs?: number;
  /** How long to hold a fully typed verb before deleting. Default 1400ms. */
  holdMs?: number;
}

type Phase = 'typing' | 'holding' | 'deleting';

export default function TypingVerb({
  verbs,
  typeMs = 70,
  deleteMs = 35,
  holdMs = 1400,
}: Props) {
  const [index, setIndex] = useState(0);
  const [text, setText] = useState(verbs[0] ?? '');
  const [phase, setPhase] = useState<Phase>('holding');
  const [reducedMotion, setReducedMotion] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq?.matches ?? false);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq?.addEventListener?.('change', handler);
    return () => mq?.removeEventListener?.('change', handler);
  }, []);

  useEffect(() => {
    if (reducedMotion || verbs.length === 0) return;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);

    const target = verbs[index];

    if (phase === 'typing') {
      if (text.length < target.length) {
        timerRef.current = window.setTimeout(() => {
          setText(target.slice(0, text.length + 1));
        }, typeMs);
      } else {
        setPhase('holding');
      }
    } else if (phase === 'holding') {
      timerRef.current = window.setTimeout(() => {
        setPhase('deleting');
      }, holdMs);
    } else {
      // deleting
      if (text.length > 0) {
        timerRef.current = window.setTimeout(() => {
          setText(text.slice(0, -1));
        }, deleteMs);
      } else {
        setIndex((i) => (i + 1) % verbs.length);
        setPhase('typing');
      }
    }

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, phase, index, reducedMotion]);

  // When reduced-motion flips on after we've started animating, settle
  // on the current verb (no further changes).
  useEffect(() => {
    if (reducedMotion) {
      setText(verbs[index] ?? '');
      setPhase('holding');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  return (
    <span className="inline-block text-accent" aria-live="polite">
      {text}
      <span
        aria-hidden="true"
        className="ml-0.5 inline-block w-[2px] -translate-y-[2px] animate-pulse bg-accent align-middle"
        style={{ height: '0.9em' }}
      />
    </span>
  );
}
