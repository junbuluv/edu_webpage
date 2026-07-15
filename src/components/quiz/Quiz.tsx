import { useRef, useState } from 'react';
import { recordQuizAttempt } from '@lib/progress';
import type { PublicQuestion } from '@lib/quiz/public';
import type { GradeResult } from '@lib/quiz/grade';
import { validateQuizAnswers } from '@lib/quiz/submission';

interface Props {
  slug: string;
  title: string;
  questions: PublicQuestion[];
  passingScore?: number;
}

type AnswerMap = Record<string, number | number[] | string>;
type AttemptState =
  | 'saved'
  | 'local'
  | 'rate_limited'
  | 'ambiguous'
  | 'unsynced';
type GradeResponse = GradeResult & {
  attempt: { state: AttemptState; attemptId: string };
};

const noCopy = {
  onCopy: (event: React.ClipboardEvent) => event.preventDefault(),
  onCut: (event: React.ClipboardEvent) => event.preventDefault(),
  onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
};

const ATTEMPT_MESSAGES: Record<AttemptState, string> = {
  saved: 'Attempt saved to your progress.',
  local: 'Attempt saved on this device.',
  rate_limited:
    'Your grade is shown, but this attempt was not added to progress because the hourly attempt limit was reached.',
  ambiguous:
    'Your grade is shown, but this attempt could not be assigned because more than one current enrollment matches this course. Ask your instructor to repair the roster.',
  unsynced:
    'Your grade is shown, but this attempt did not sync. Check your connection and retry saving.',
};

function newAttemptId(): string {
  return crypto.randomUUID();
}

export default function Quiz({ slug, title, questions }: Props) {
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [result, setResult] = useState<GradeResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [termsRequired, setTermsRequired] = useState(false);
  const attemptIdRef = useRef<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const submitted = result !== null;

  async function submit() {
    const validated = validateQuizAnswers(answers, questions);
    if (!validated.ok) {
      setError('One or more answers are invalid. Review the quiz and retry.');
      queueMicrotask(() => errorRef.current?.focus());
      return;
    }

    setPending(true);
    setError(null);
    setTermsRequired(false);
    attemptIdRef.current ??= newAttemptId();
    try {
      const response = await fetch('/api/quiz/grade', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug,
          answers: validated.value,
          attemptId: attemptIdRef.current,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
          reason?: string;
        } | null;
        if (
          response.status === 428 &&
          (body?.reason === 'terms_acceptance_required' ||
            body?.error === 'terms_acceptance_required')
        ) {
          setTermsRequired(true);
          setError('Accept the current terms before submitting this quiz.');
          queueMicrotask(() => errorRef.current?.focus());
          return;
        }
        const reason =
          body?.error === 'body_too_large'
            ? 'The submission was too large.'
            : body?.error === 'quiz_unavailable'
              ? 'The quiz service is temporarily unavailable.'
              : body?.error === 'quiz_invalid'
                ? 'This quiz needs instructor review before it can be graded.'
                : `Grading returned status ${response.status}.`;
        throw new Error(reason);
      }

      const graded = (await response.json()) as GradeResponse;
      setResult(graded);
      try {
        await recordQuizAttempt({
          attemptId: graded.attempt.attemptId,
          quizSlug: slug,
          score: graded.score,
          maxScore: graded.maxScore,
          answers: validated.value,
          syncState: graded.attempt.state,
        });
      } catch {
        setError(
          'Your grade was returned, but this browser could not keep the local attempt history.',
        );
      }
      queueMicrotask(() => resultRef.current?.focus());
    } catch (caught) {
      setError(
        caught instanceof Error
          ? `Couldn't submit your answers. ${caught.message} Check your connection and try again.`
          : "Couldn't submit your answers. Check your connection and try again.",
      );
      queueMicrotask(() => errorRef.current?.focus());
    } finally {
      setPending(false);
    }
  }

  function retryQuiz() {
    setAnswers({});
    setResult(null);
    setError(null);
    setTermsRequired(false);
    attemptIdRef.current = null;
  }

  return (
    <section className="my-10 rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      <ol className="mt-6 space-y-8 select-none" {...noCopy}>
        {questions.map((question, index) => (
          <li key={question.id}>
            <fieldset>
              <legend className="font-medium">
                {index + 1}. {question.prompt}
              </legend>
              <div className="mt-3">
                {question.type === 'multiple_choice' && (
                  <MCInput
                    questionId={question.id}
                    choices={question.choices ?? []}
                    value={answers[question.id] as number | undefined}
                    onChange={(value) =>
                      setAnswers((current) => ({
                        ...current,
                        [question.id]: value,
                      }))
                    }
                    disabled={submitted}
                  />
                )}
                {question.type === 'multi_select' && (
                  <MultiInput
                    questionId={question.id}
                    choices={question.choices ?? []}
                    value={(answers[question.id] as number[] | undefined) ?? []}
                    onChange={(value) =>
                      setAnswers((current) => ({
                        ...current,
                        [question.id]: value,
                      }))
                    }
                    disabled={submitted}
                  />
                )}
                {question.type === 'numeric' && (
                  <NumericInput
                    questionId={question.id}
                    questionNumber={index + 1}
                    unit={question.unit}
                    value={(answers[question.id] as string | undefined) ?? ''}
                    onChange={(value) =>
                      setAnswers((current) => {
                        const next = { ...current };
                        if (value === '') delete next[question.id];
                        else next[question.id] = value;
                        return next;
                      })
                    }
                    disabled={submitted}
                  />
                )}
              </div>
            </fieldset>
            {submitted && result.perQuestion[question.id] && (
              <Feedback
                correct={result.perQuestion[question.id].correct}
                explanation={result.perQuestion[question.id].explanation}
              />
            )}
          </li>
        ))}
      </ol>

      <div className="mt-8 border-t border-slate-200 pt-4">
        {!submitted ? (
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="rounded bg-accent px-4 py-2 font-medium text-white disabled:opacity-60"
          >
            {pending ? 'Submitting…' : 'Submit answers'}
          </button>
        ) : (
          <div
            ref={resultRef}
            tabIndex={-1}
            aria-live="polite"
            className="space-y-3 rounded focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            <ResultBadge
              score={result.score}
              maxScore={result.maxScore}
              passed={result.passed}
            />
            <p
              className={`text-sm ${
                result.attempt.state === 'saved' ||
                result.attempt.state === 'local'
                  ? 'text-emerald-700'
                  : 'text-amber-800'
              }`}
            >
              {ATTEMPT_MESSAGES[result.attempt.state]}
            </p>
            <div className="flex flex-wrap gap-2">
              {result.attempt.state === 'unsynced' && (
                <button
                  type="button"
                  onClick={submit}
                  disabled={pending}
                  className="rounded border border-amber-400 px-3 py-1.5 text-sm font-medium text-amber-900 disabled:opacity-60"
                >
                  {pending ? 'Retrying…' : 'Retry saving'}
                </button>
              )}
              <button
                type="button"
                onClick={retryQuiz}
                disabled={pending}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-ink hover:border-accent disabled:opacity-60"
              >
                Retry quiz
              </button>
            </div>
          </div>
        )}
      </div>
      {error && (
        <p
          ref={errorRef}
          role="alert"
          tabIndex={-1}
          className="mt-3 rounded text-sm text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-300"
        >
          {error}
          {termsRequired && (
            <>
              {' '}
              <a className="font-medium underline" href="/account/terms">
                Review terms
              </a>
            </>
          )}
        </p>
      )}
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
  onChange: (value: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      {choices.map((choice, index) => (
        <label
          key={`${index}-${choice}`}
          className={`flex cursor-pointer items-start gap-2 rounded border p-2 ${
            value === index ? 'border-accent bg-accent/5' : 'border-slate-200'
          }`}
        >
          <input
            type="radio"
            name={questionId}
            checked={value === index}
            disabled={disabled}
            onChange={() => onChange(index)}
            className="mt-1"
          />
          <span>{choice}</span>
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
  onChange: (value: number[]) => void;
  disabled: boolean;
}) {
  function toggle(index: number) {
    onChange(
      value.includes(index)
        ? value.filter((choice) => choice !== index)
        : [...value, index],
    );
  }

  return (
    <div className="space-y-2">
      {choices.map((choice, index) => (
        <label
          key={`${index}-${choice}`}
          className={`flex cursor-pointer items-start gap-2 rounded border p-2 ${
            value.includes(index)
              ? 'border-accent bg-accent/5'
              : 'border-slate-200'
          }`}
        >
          <input
            type="checkbox"
            name={questionId}
            checked={value.includes(index)}
            disabled={disabled}
            onChange={() => toggle(index)}
            className="mt-1"
          />
          <span>{choice}</span>
        </label>
      ))}
    </div>
  );
}

function NumericInput({
  questionId,
  questionNumber,
  unit,
  value,
  onChange,
  disabled,
}: {
  questionId: string;
  questionNumber: number;
  unit?: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const inputId = `quiz-${questionId}-numeric`;
  const unitId = `${inputId}-unit`;
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={inputId} className="sr-only">
        Answer for question {questionNumber}
      </label>
      <input
        id={inputId}
        type="number"
        inputMode="decimal"
        step="any"
        value={value}
        disabled={disabled}
        aria-describedby={unit ? unitId : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="w-40 rounded border border-slate-300 px-3 py-2"
      />
      {unit && (
        <span id={unitId} className="text-sm text-ink-muted">
          {unit}
        </span>
      )}
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
        className={`font-semibold ${
          passed ? 'text-emerald-700' : 'text-rose-700'
        }`}
      >
        {score} / {maxScore}
      </span>{' '}
      <span className="text-ink-muted">
        · {passed ? 'passed' : 'review the lesson and retry'}
      </span>
    </div>
  );
}
