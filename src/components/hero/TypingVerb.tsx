import { useEffect, useRef, useState } from 'react';
import { canSwapAgain } from '@lib/animation/typing-limit';

interface Props {
  /** Verbs to type in order. The run stops within 5 s (WCAG 2.2.2). */
  verbs: string[];
  /** Per-character type speed in ms. Default 70. */
  typeMs?: number;
  /** Per-character delete speed in ms. Default 35 (faster than typing). */
  deleteMs?: number;
  /** How long to hold a fully typed verb before deleting. Default 1000ms. */
  holdMs?: number;
}

type Phase = 'typing' | 'holding' | 'deleting' | 'done';

export default function TypingVerb({
  verbs,
  typeMs = 70,
  deleteMs = 35,
  holdMs = 1000,
}: Props) {
  const [index, setIndex] = useState(0);
  const [text, setText] = useState(verbs[0] ?? '');
  const [phase, setPhase] = useState<Phase>('holding');
  const startRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (phase === 'done' || verbs.length === 0) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setText(verbs[index] ?? '');
      setPhase('done');
      return;
    }
    startRef.current ??= performance.now();
    const target = verbs[index];
    const next = verbs[(index + 1) % verbs.length];
    const elapsed = performance.now() - startRef.current;
    const timing = { typeMs, deleteMs, holdMs };

    if (phase === 'typing') {
      if (text.length < target.length) {
        timerRef.current = window.setTimeout(() => {
          setText(target.slice(0, text.length + 1));
        }, typeMs);
      } else {
        setPhase('holding');
      }
    } else if (phase === 'holding') {
      // Stop here, cursor and all, unless one more swap ends in time.
      const last = index === verbs.length - 1;
      if (last || !canSwapAgain(elapsed, text.length, next.length, timing)) {
        setPhase('done');
      } else {
        timerRef.current = window.setTimeout(() => {
          setPhase('deleting');
        }, holdMs);
      }
    } else if (text.length > 0) {
      timerRef.current = window.setTimeout(() => {
        setText(text.slice(0, -1));
      }, deleteMs);
    } else {
      setIndex((i) => i + 1);
      setPhase('typing');
    }

    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, phase, index]);

  return (
    <>
      {/* Screen readers get one fixed sentence; the typing is visual only. */}
      <span className="sr-only">{verbs[0]}</span>
      <span className="inline-block text-brand-sky" aria-hidden="true">
        {text}
        {phase !== 'done' && (
          <span
            className="ml-0.5 inline-block w-[2px] -translate-y-[2px] animate-pulse bg-brand-sky align-middle"
            style={{ height: '0.9em' }}
          />
        )}
      </span>
    </>
  );
}
