import { useMemo, useState } from 'react';
import { recordQuizAttempt } from '@lib/progress';
import type { QuestionT } from '@/content/config';

interface Props {
  slug: string;
  title: string;
  questions: QuestionT[];
  passingScore?: number;
}

type AnswerMap = Record<string, number | number[] | string>;

export default function Quiz({
  slug,
  title,
  questions,
  passingScore = 0.7,
}: Props) {
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [submitted, setSubmitted] = useState(false);

  const maxScore = useMemo(
    () => questions.reduce((s, q) => s + q.points, 0),
    [questions],
  );

  const { score, perQuestion } = useMemo(() => {
    let total = 0;
    const detail: Record<string, { correct: boolean; awarded: number }> = {};
    for (const q of questions) {
      const ans = answers[q.id];
      let correct = false;
      if (q.type === 'multiple_choice' && typeof ans === 'number') {
        correct = ans === q.correctIndex;
      } else if (q.type === 'multi_select' && Array.isArray(ans)) {
        const a = [...ans].sort().join(',');
        const c = [...q.correctIndices].sort().join(',');
        correct = a === c;
      } else if (q.type === 'numeric' && typeof ans === 'string') {
        const parsed = Number(ans);
        if (Number.isFinite(parsed)) {
          correct = Math.abs(parsed - q.answer) <= q.tolerance;
        }
      }
      const awarded = correct ? q.points : 0;
      total += awarded;
      detail[q.id] = { correct, awarded };
    }
    return { score: total, perQuestion: detail };
  }, [answers, questions]);

  async function submit() {
    setSubmitted(true);
    await recordQuizAttempt({
      quizSlug: slug,
      score,
      maxScore,
      answers,
    });
  }

  const pct = maxScore === 0 ? 0 : score / maxScore;
  const passed = pct >= passingScore;

  return (
    <section className="my-10 rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      <ol className="mt-6 space-y-8">
        {questions.map((q, i) => (
          <li key={q.id}>
            <p className="font-medium">
              {i + 1}. {q.prompt}
            </p>
            <div className="mt-3">
              {q.type === 'multiple_choice' && (
                <MCInput
                  questionId={q.id}
                  choices={q.choices}
                  value={answers[q.id] as number | undefined}
                  onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
                  disabled={submitted}
                />
              )}
              {q.type === 'multi_select' && (
                <MultiInput
                  questionId={q.id}
                  choices={q.choices}
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
            {submitted && (
              <Feedback
                correct={perQuestion[q.id].correct}
                explanation={q.explanation}
              />
            )}
          </li>
        ))}
      </ol>

      <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-4">
        {!submitted ? (
          <button
            onClick={submit}
            className="rounded bg-accent px-4 py-2 text-white font-medium"
          >
            Submit answers
          </button>
        ) : (
          <ResultBadge score={score} maxScore={maxScore} passed={passed} />
        )}
      </div>
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
