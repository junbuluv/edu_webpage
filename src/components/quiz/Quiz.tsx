import { useState } from 'react';
import { recordQuizAttempt } from '@lib/progress';
import type { PublicQuestion } from '@lib/quiz/public';
import type { GradeResult } from '@lib/quiz/grade';

interface Props {
  slug: string;
  title: string;
  // No answer keys: the client only receives the public question shape.
  // Grading happens server-side via POST /api/quiz/grade.
  questions: PublicQuestion[];
  passingScore?: number;
}

type AnswerMap = Record<string, number | number[] | string>;

// Block copy / cut / context-menu inside the quiz so the prompts and choices
// can't be trivially lifted into another tool. A soft deterrent only —
// screenshots and retyping still work; the real protection is that answers
// are graded server-side and never shipped to the page.
const noCopy = {
  onCopy: (e: React.ClipboardEvent) => e.preventDefault(),
  onCut: (e: React.ClipboardEvent) => e.preventDefault(),
  onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
};

export default function Quiz({ slug, title, questions }: Props) {
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [result, setResult] = useState<GradeResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitted = result !== null;

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const resp = await fetch('/api/quiz/grade', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, answers }),
      });
      if (!resp.ok) throw new Error(`grade failed (${resp.status})`);
      const graded = (await resp.json()) as GradeResult;
      setResult(graded);
      // Persist the server-computed score (signed-in -> Supabase, anon ->
      // localStorage). A persistence failure must NOT read as a grading
      // failure — the grade already succeeded and is shown.
      try {
        await recordQuizAttempt({
          quizSlug: slug,
          score: graded.score,
          maxScore: graded.maxScore,
          answers,
        });
      } catch {
        setError("Your score was graded, but we couldn't save this attempt to your progress.");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? `Couldn't submit your answers (${err.message}). Check your connection and try again.`
          : "Couldn't submit your answers. Try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="my-10 rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      <ol className="mt-6 space-y-8 select-none" {...noCopy}>
        {questions.map((q, i) => (
          <li key={q.id}>
            <p className="font-medium">
              {i + 1}. {q.prompt}
            </p>
            <div className="mt-3">
              {q.type === 'multiple_choice' && (
                <MCInput
                  questionId={q.id}
                  choices={q.choices ?? []}
                  value={answers[q.id] as number | undefined}
                  onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
                  disabled={submitted}
                />
              )}
              {q.type === 'multi_select' && (
                <MultiInput
                  questionId={q.id}
                  choices={q.choices ?? []}
                  value={(answers[q.id] as number[] | undefined) ?? []}
                  onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
                  disabled={submitted}
                />
              )}
              {q.type === 'numeric' && (
                <NumericInput
                  unit={q.unit}
                  value={(answers[q.id] as string | undefined) ?? ''}
                  onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
                  disabled={submitted}
                />
              )}
            </div>
            {submitted && result.perQuestion[q.id] && (
              <Feedback
                correct={result.perQuestion[q.id].correct}
                explanation={result.perQuestion[q.id].explanation}
              />
            )}
          </li>
        ))}
      </ol>

      <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-4">
        {!submitted ? (
          <button
            onClick={submit}
            disabled={pending}
            className="rounded bg-accent px-4 py-2 text-white font-medium disabled:opacity-60"
          >
            {pending ? 'Submitting…' : 'Submit answers'}
          </button>
        ) : (
          <ResultBadge
            score={result.score}
            maxScore={result.maxScore}
            passed={result.passed}
          />
        )}
      </div>
      {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}
    </section>
  );
}

function MCInput({
  questionId,
  choices,
  value,
  onChange,
  disabled,
}: {
  questionId: string;
  choices: string[];
  value: number | undefined;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      {choices.map((c, i) => (
        <label
          key={i}
          className={`flex cursor-pointer items-start gap-2 rounded border p-2 ${
            value === i ? 'border-accent bg-accent/5' : 'border-slate-200'
          }`}
        >
          <input
            type="radio"
            name={questionId}
            checked={value === i}
            disabled={disabled}
            onChange={() => onChange(i)}
            className="mt-1"
          />
          <span>{c}</span>
        </label>
      ))}
    </div>
  );
}

function MultiInput({
  questionId,
  choices,
  value,
  onChange,
  disabled,
}: {
  questionId: string;
  choices: string[];
  value: number[];
  onChange: (v: number[]) => void;
  disabled: boolean;
}) {
  function toggle(i: number) {
    onChange(value.includes(i) ? value.filter((v) => v !== i) : [...value, i]);
  }
  return (
    <div className="space-y-2">
      {choices.map((c, i) => (
        <label
          key={i}
          className={`flex cursor-pointer items-start gap-2 rounded border p-2 ${
            value.includes(i) ? 'border-accent bg-accent/5' : 'border-slate-200'
          }`}
        >
          <input
            type="checkbox"
            name={questionId}
            checked={value.includes(i)}
            disabled={disabled}
            onChange={() => toggle(i)}
            className="mt-1"
          />
          <span>{c}</span>
        </label>
      ))}
    </div>
  );
}

function NumericInput({
  unit,
  value,
  onChange,
  disabled,
}: {
  unit?: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        inputMode="decimal"
        step="any"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-40 rounded border border-slate-300 px-3 py-2"
      />
      {unit && <span className="text-ink-muted text-sm">{unit}</span>}
    </div>
  );
}

function Feedback({
  correct,
  explanation,
}: {
  correct: boolean;
  explanation: string;
}) {
  return (
    <div
      className={`mt-3 rounded-md p-3 text-sm ${
        correct ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
      }`}
    >
      <strong>{correct ? 'Correct.' : 'Not quite.'}</strong> {explanation}
    </div>
  );
}

function ResultBadge({
  score,
  maxScore,
  passed,
}: {
  score: number;
  maxScore: number;
  passed: boolean;
}) {
  return (
    <div className="text-sm">
      <span
        className={`font-semibold ${passed ? 'text-emerald-700' : 'text-rose-700'}`}
      >
        {score} / {maxScore}
      </span>{' '}
      <span className="text-ink-muted">
        — {passed ? 'passed' : 'review the lesson and retry'}
      </span>
    </div>
  );
}
