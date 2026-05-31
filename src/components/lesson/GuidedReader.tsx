import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { markLessonStatus } from '@lib/progress';

// Built-in viz registry. To add a viz to GuidedReader, import it here
// and add a {name -> component} entry. Lazy-loading kept simple; if a
// lesson uses just two viz, the other components aren't bundled into
// the page because GuidedReader pulls only what it sees in `steps`.
import ISLMChart from '@components/viz/ISLMChart';
import ADASChart from '@components/viz/ADASChart';
import SolowGrowth from '@components/viz/SolowGrowth';
import PhillipsCurve from '@components/viz/PhillipsCurve';
import MoneyMultiplier from '@components/viz/MoneyMultiplier';
import LoanableFunds from '@components/viz/LoanableFunds';
import OpenEconomyFX from '@components/viz/OpenEconomyFX';
import OkunPhillips from '@components/viz/OkunPhillips';
import TVMNPV from '@components/viz/TVMNPV';
import BondPriceYield from '@components/viz/BondPriceYield';
import CAPMSecurityMarketLine from '@components/viz/CAPMSecurityMarketLine';
import WACCVisualizer from '@components/viz/WACCVisualizer';
import CashflowWaterfall from '@components/viz/CashflowWaterfall';

const VIZ_REGISTRY: Record<string, React.ComponentType> = {
  ISLMChart,
  ADASChart,
  SolowGrowth,
  PhillipsCurve,
  MoneyMultiplier,
  LoanableFunds,
  OpenEconomyFX,
  OkunPhillips,
  TVMNPV,
  BondPriceYield,
  CAPMSecurityMarketLine,
  WACCVisualizer,
  CashflowWaterfall,
};

export interface CheckQuestion {
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
}

export interface GuidedStep {
  heading: string;
  bodyHtml: string;
  viz?: keyof typeof VIZ_REGISTRY;
  check?: CheckQuestion;
}

interface Props {
  lessonSlug: string;
  steps: GuidedStep[];
}

export default function GuidedReader({ lessonSlug, steps }: Props) {
  const [idx, setIdx] = useState(0);
  const [checkAnswers, setCheckAnswers] = useState<Record<number, number>>({});
  const [checkRevealed, setCheckRevealed] = useState<Record<number, boolean>>(
    {},
  );
  const total = steps.length;
  const step = steps[idx];
  const progressKey = `edu_web:guided:${lessonSlug}`;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(progressKey);
      if (saved) {
        const parsed = Number(saved);
        if (Number.isFinite(parsed) && parsed >= 0 && parsed < total) {
          setIdx(parsed);
        }
      }
    } catch {
      /* ignore */
    }
    void markLessonStatus(lessonSlug, 'started');
  }, [lessonSlug, progressKey, total]);

  useEffect(() => {
    try {
      window.localStorage.setItem(progressKey, String(idx));
    } catch {
      /* ignore */
    }
    if (idx === total - 1) {
      void markLessonStatus(lessonSlug, 'completed');
    }
  }, [idx, lessonSlug, progressKey, total]);

  // Keyboard nav.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement) {
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      }
      if (e.key === 'ArrowRight') setIdx((i) => Math.min(total - 1, i + 1));
      if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [total]);

  const VizComponent = useMemo<React.ComponentType | null>(() => {
    if (!step?.viz) return null;
    return VIZ_REGISTRY[step.viz] ?? null;
  }, [step]);

  const pct = ((idx + 1) / total) * 100;

  function selectCheck(value: number) {
    setCheckAnswers((m) => ({ ...m, [idx]: value }));
    setCheckRevealed((m) => ({ ...m, [idx]: true }));
  }

  return (
    <section className="my-8 rounded-lg border border-slate-200 bg-white">
      <header className="border-b border-slate-200 px-5 py-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            Step <span className="text-accent">{idx + 1}</span> of {total}
          </span>
          <span className="text-ink-muted">Use ← → to navigate</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </header>

      <div className="px-5 py-6">
        <h2 className="text-xl font-semibold tracking-tight">{step.heading}</h2>

        <div
          className="prose prose-slate mt-4 max-w-none"
          dangerouslySetInnerHTML={{ __html: step.bodyHtml }}
        />

        {VizComponent && (
          <div className="mt-6">
            <VizComponent />
          </div>
        )}

        {step.check && (
          <CheckBlock
            key={idx}
            question={step.check}
            selected={checkAnswers[idx]}
            revealed={Boolean(checkRevealed[idx])}
            onSelect={selectCheck}
          />
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
        <button
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium disabled:opacity-40 hover:border-accent"
        >
          ← Previous
        </button>
        <div className="flex gap-1">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`Go to step ${i + 1}`}
              className={`h-2 w-2 rounded-full transition ${
                i === idx
                  ? 'bg-accent'
                  : i < idx
                    ? 'bg-slate-400'
                    : 'bg-slate-200'
              }`}
            />
          ))}
        </div>
        {idx < total - 1 ? (
          <button
            onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
            className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Next →
          </button>
        ) : (
          <span className="rounded bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
            ✓ Complete
          </span>
        )}
      </footer>
    </section>
  );
}

function CheckBlock({
  question,
  selected,
  revealed,
  onSelect,
}: {
  question: CheckQuestion;
  selected: number | undefined;
  revealed: boolean;
  onSelect: (v: number) => void;
}): ReactNode {
  return (
    <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
        Check yourself
      </p>
      <p className="mt-2 font-medium">{question.prompt}</p>
      <ul className="mt-3 space-y-2">
        {question.choices.map((c, i) => {
          const isSelected = selected === i;
          const isCorrect = i === question.correctIndex;
          const showCorrect = revealed && isCorrect;
          const showWrong = revealed && isSelected && !isCorrect;
          return (
            <li key={i}>
              <button
                type="button"
                disabled={revealed}
                onClick={() => onSelect(i)}
                className={`block w-full rounded border px-3 py-2 text-left text-sm transition ${
                  showCorrect
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                    : showWrong
                      ? 'border-rose-400 bg-rose-50 text-rose-900'
                      : isSelected
                        ? 'border-accent bg-white'
                        : 'border-slate-200 bg-white hover:border-accent'
                }`}
              >
                {c}
              </button>
            </li>
          );
        })}
      </ul>
      {revealed && (
        <p className="mt-3 text-sm text-ink-muted">
          <strong>
            {selected === question.correctIndex ? 'Correct.' : 'Not quite.'}
          </strong>{' '}
          {question.explanation}
        </p>
      )}
    </div>
  );
}
