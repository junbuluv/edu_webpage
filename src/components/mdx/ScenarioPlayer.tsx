import { useEffect, useRef, useState, type ReactNode } from 'react';
import { easeOutCubic } from '@lib/animation/easings';

export type StageState = Record<string, number>;

export interface Stage<S extends StageState = StageState> {
  id: string;
  label: string;
  state: S;
  caption?: string;
}

interface Props<S extends StageState = StageState> {
  stages: Stage<S>[];
  /** Renders the chart for the currently-interpolated state. */
  render: (
    state: S,
    info: { stageIndex: number; isPlaying: boolean },
  ) => ReactNode;
  /** Transition duration between stages (ms). Default 600. */
  transitionMs?: number;
  /** When playing, how long to dwell on each stage after the transition (ms). Default 1200. */
  dwellMs?: number;
  /** Auto-play on first mount. Default false. */
  autoplay?: boolean;
  /** Loop back to the first stage when reaching the end. Default false. */
  loop?: boolean;
  /** Optional title displayed above the player. */
  title?: string;
}

export default function ScenarioPlayer<S extends StageState>({
  stages,
  render,
  transitionMs = 600,
  dwellMs = 1200,
  autoplay = false,
  loop = false,
  title,
}: Props<S>) {
  if (stages.length === 0) {
    throw new Error('ScenarioPlayer requires at least one stage.');
  }

  const [stageIndex, setStageIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoplay);
  const [displayState, setDisplayState] = useState<S>(stages[0].state);

  const tweenFrameRef = useRef<number | null>(null);
  const playTimerRef = useRef<number | null>(null);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    reducedMotionRef.current =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }, []);

  // Tween from displayState toward stages[stageIndex].state whenever
  // stageIndex changes.
  useEffect(() => {
    const target = stages[stageIndex].state;
    const from = displayState;

    if (reducedMotionRef.current) {
      setDisplayState(target);
      return;
    }

    const start = performance.now();
    const keys = Object.keys(target) as Array<keyof S>;

    function step(now: number) {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / transitionMs);
      const eased = easeOutCubic(t);
      const next = { ...target };
      for (const k of keys) {
        const fromV = (from[k] ?? target[k]) as number;
        const toV = target[k] as number;
        (next[k] as number) = fromV + (toV - fromV) * eased;
      }
      setDisplayState(next);
      if (t < 1) {
        tweenFrameRef.current = requestAnimationFrame(step);
      } else {
        tweenFrameRef.current = null;
      }
    }

    if (tweenFrameRef.current !== null) {
      cancelAnimationFrame(tweenFrameRef.current);
    }
    tweenFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (tweenFrameRef.current !== null) {
        cancelAnimationFrame(tweenFrameRef.current);
        tweenFrameRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageIndex, transitionMs]);

  // Playback loop: advance stage after transition + dwell.
  useEffect(() => {
    if (!isPlaying) {
      if (playTimerRef.current !== null) {
        window.clearTimeout(playTimerRef.current);
        playTimerRef.current = null;
      }
      return;
    }
    playTimerRef.current = window.setTimeout(() => {
      const atEnd = stageIndex === stages.length - 1;
      if (atEnd) {
        if (loop) {
          setStageIndex(0);
        } else {
          setIsPlaying(false);
        }
      } else {
        setStageIndex((i) => i + 1);
      }
    }, transitionMs + dwellMs);
    return () => {
      if (playTimerRef.current !== null) {
        window.clearTimeout(playTimerRef.current);
        playTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, stageIndex, transitionMs, dwellMs, loop, stages.length]);

  function goTo(i: number) {
    setStageIndex(Math.max(0, Math.min(stages.length - 1, i)));
  }
  function reset() {
    setIsPlaying(false);
    setStageIndex(0);
  }

  const current = stages[stageIndex];

  return (
    <section className="my-6 rounded-lg border border-slate-200 bg-white p-4">
      {title && (
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          {title}
        </h3>
      )}

      <div className="mt-2">
        {render(displayState, { stageIndex, isPlaying })}
      </div>

      {current.caption && (
        <p className="mt-3 rounded bg-slate-50 px-3 py-2 text-sm">
          <span className="font-medium">{current.label}:</span>{' '}
          <span className="text-ink-muted">{current.caption}</span>
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goTo(stageIndex - 1)}
            disabled={stageIndex === 0}
            className="rounded border border-slate-300 px-2 py-1 text-sm hover:border-accent disabled:opacity-40"
          >
            ← Prev
          </button>
          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            className="rounded bg-accent px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            onClick={() => goTo(stageIndex + 1)}
            disabled={stageIndex === stages.length - 1}
            className="rounded border border-slate-300 px-2 py-1 text-sm hover:border-accent disabled:opacity-40"
          >
            Next →
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded border border-slate-300 px-2 py-1 text-sm hover:border-accent"
          >
            Reset
          </button>
        </div>

        <ol className="flex gap-1.5" aria-label="Scenario stages">
          {stages.map((s, i) => {
            const isActive = i === stageIndex;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  aria-current={isActive ? 'step' : undefined}
                  aria-label={`Stage ${i + 1}: ${s.label}`}
                  className={`h-2.5 w-2.5 rounded-full transition-colors ${
                    isActive ? 'bg-accent' : 'bg-slate-300 hover:bg-slate-400'
                  }`}
                />
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
