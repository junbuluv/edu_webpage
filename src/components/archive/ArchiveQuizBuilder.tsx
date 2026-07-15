import { useRef, useState } from 'react';
import {
  removeChoiceAt,
  validCoversForLessons,
} from '@lib/archive/quiz-builder';

type QType = 'multiple_choice' | 'numeric' | 'multi_select';
interface Q {
  type: QType;
  id: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  correctIndices: number[];
  answer: string;
  explanation: string;
}
export type RawQuestion = {
  type: QType;
  id?: string;
  prompt?: string;
  choices?: string[];
  correctIndex?: number;
  correctIndices?: number[];
  answer?: number;
  explanation?: string;
};
interface LessonOpt {
  slug: string;
  title: string;
}
interface Props {
  action: string;
  courses: string[];
  lessons: LessonOpt[];
  lessonsByCourse?: Record<string, LessonOpt[]>;
  initialCourse?: string;
  initial?: {
    id?: string;
    course_slug: string;
    kind: 'exam' | 'assignment';
    title: string;
    semester_term: 'spring' | 'summer' | 'fall';
    semester_year: number;
    covers: string[];
    passing_score: number;
    published?: boolean;
    questions: RawQuestion[];
  };
}

const blankQ = (): Q => ({
  type: 'multiple_choice',
  id: `q-${crypto.randomUUID().slice(0, 8)}`,
  prompt: '',
  choices: ['', ''],
  correctIndex: 0,
  correctIndices: [],
  answer: '',
  explanation: '',
});

function normalizeQ(raw: RawQuestion): Q {
  const b = blankQ();
  const choices =
    raw.choices && raw.choices.length >= 2 ? raw.choices : ['', ''];
  const correctIndex =
    Number.isInteger(raw.correctIndex) &&
    Number(raw.correctIndex) >= 0 &&
    Number(raw.correctIndex) < choices.length
      ? Number(raw.correctIndex)
      : 0;
  const correctIndices = [
    ...new Set(
      (Array.isArray(raw.correctIndices) ? raw.correctIndices : []).filter(
        (index) =>
          Number.isInteger(index) && index >= 0 && index < choices.length,
      ),
    ),
  ];
  return {
    type: raw.type,
    id: raw.id ?? b.id,
    prompt: raw.prompt ?? '',
    choices,
    correctIndex,
    correctIndices,
    answer: typeof raw.answer === 'number' ? String(raw.answer) : '',
    explanation: raw.explanation ?? '',
  };
}

export default function ArchiveQuizBuilder({
  action,
  courses,
  lessons,
  lessonsByCourse,
  initialCourse,
  initial,
}: Props) {
  const [course, setCourse] = useState(
    initial?.course_slug ?? initialCourse ?? courses[0] ?? '',
  );
  const [kind, setKind] = useState<'exam' | 'assignment'>(
    initial?.kind ?? 'exam',
  );
  const [title, setTitle] = useState(initial?.title ?? '');
  const [term, setTerm] = useState(initial?.semester_term ?? 'fall');
  const [year, setYear] = useState(
    initial?.semester_year ?? new Date().getFullYear(),
  );
  const [passing, setPassing] = useState(initial?.passing_score ?? 0.7);
  const [covers, setCovers] = useState<string[]>(initial?.covers ?? []);
  const [published, setPublished] = useState(initial?.published ?? false);
  const [questions, setQuestions] = useState<Q[]>(
    initial?.questions?.length ? initial.questions.map(normalizeQ) : [blankQ()],
  );
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const courseLessons = lessonsByCourse?.[course] ?? lessons;

  const setQ = (i: number, patch: Partial<Q>) =>
    setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));

  function buildPayload(): string {
    const qs = questions.map((q) => {
      const base = {
        type: q.type,
        id: q.id,
        prompt: q.prompt,
        explanation: q.explanation,
      };
      if (q.type === 'numeric') return { ...base, answer: Number(q.answer) };
      if (q.type === 'multi_select')
        return {
          ...base,
          choices: q.choices,
          correctIndices: q.correctIndices,
        };
      return { ...base, choices: q.choices, correctIndex: q.correctIndex };
    });
    return JSON.stringify({
      id: initial?.id,
      course_slug: course,
      kind,
      title,
      semester_term: term,
      semester_year: Number(year),
      covers,
      passing_score: Number(passing),
      published,
      questions: qs,
    });
  }

  function validate(): string | null {
    if (!title.trim()) return 'Title is required.';
    if (!questions.length) return 'Add at least one question.';
    for (const [i, q] of questions.entries()) {
      if (!q.prompt.trim()) return `Question ${i + 1}: prompt required.`;
      if (q.type !== 'numeric' && q.choices.some((c) => !c.trim()))
        return `Question ${i + 1}: all choices must be filled.`;
      if (
        q.type === 'numeric' &&
        (q.answer.trim() === '' || !Number.isFinite(Number(q.answer)))
      )
        return `Question ${i + 1}: enter a valid numeric answer.`;
      if (q.type === 'multi_select' && q.correctIndices.length === 0)
        return `Question ${i + 1}: select at least one correct choice.`;
    }
    return null;
  }

  const pill = 'rounded border border-slate-300 px-2 py-1 text-sm';

  return (
    <form
      method="POST"
      action={action}
      onSubmit={(e) => {
        const v = validate();
        if (v) {
          e.preventDefault();
          setError(v);
          queueMicrotask(() => errorRef.current?.focus());
        }
      }}
      className="mt-4 space-y-4 text-sm"
    >
      <input type="hidden" name="payload" value={buildPayload()} />
      {error && (
        <p
          ref={errorRef}
          role="alert"
          tabIndex={-1}
          className="rounded border border-amber-300 bg-amber-50 p-2 text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <label>
          Course
          <select
            className={pill}
            value={course}
            onChange={(e) => {
              const nextCourse = e.target.value;
              const nextLessons = lessonsByCourse?.[nextCourse] ?? lessons;
              setCourse(nextCourse);
              setCovers((current) =>
                validCoversForLessons(
                  current,
                  nextLessons.map((lesson) => lesson.slug),
                ),
              );
            }}
          >
            {courses.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Kind
          <select
            className={pill}
            value={kind}
            onChange={(e) => setKind(e.target.value as 'exam' | 'assignment')}
          >
            <option value="exam">Exam</option>
            <option value="assignment">Assignment</option>
          </select>
        </label>
        <label>
          Term
          <select
            className={pill}
            value={term}
            onChange={(e) => setTerm(e.target.value as typeof term)}
          >
            <option value="spring">Spring</option>
            <option value="summer">Summer</option>
            <option value="fall">Fall</option>
          </select>
        </label>
        <label>
          Year
          <input
            type="number"
            min={2020}
            max={2100}
            className={`${pill} w-24`}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </label>
        <label>
          Passing score (0-1)
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            className={`${pill} w-24`}
            value={passing}
            onChange={(e) => setPassing(Number(e.target.value))}
          />
        </label>
      </div>
      <label className="block">
        Title
        <input
          className={`${pill} w-full`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <fieldset>
        <legend className="text-ink-muted">Lessons covered</legend>
        <div className="mt-1 flex flex-wrap gap-3">
          {courseLessons.map((l) => (
            <label key={l.slug} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={covers.includes(l.slug)}
                onChange={(e) =>
                  setCovers((cs) =>
                    e.target.checked
                      ? [...cs, l.slug]
                      : cs.filter((s) => s !== l.slug),
                  )
                }
              />
              {l.title}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-4">
        {questions.map((q, i) => (
          <fieldset
            key={q.id}
            className="rounded-lg border border-slate-200 p-3"
          >
            <legend className="px-1 font-semibold">Question {i + 1}</legend>
            <div className="flex items-center justify-end">
              <div className="flex items-center gap-2">
                <label className="sr-only" htmlFor={`${q.id}-type`}>
                  Question {i + 1} type
                </label>
                <select
                  id={`${q.id}-type`}
                  className={pill}
                  value={q.type}
                  onChange={(e) => setQ(i, { type: e.target.value as QType })}
                >
                  <option value="multiple_choice">Multiple choice</option>
                  <option value="numeric">Numeric</option>
                  <option value="multi_select">Multi-select</option>
                </select>
                <button
                  type="button"
                  className="text-red-600 underline"
                  onClick={() =>
                    setQuestions((qs) => qs.filter((_, j) => j !== i))
                  }
                >
                  Remove
                </button>
              </div>
            </div>
            <label className="mt-2 block">
              <span className="text-xs font-medium text-ink-muted">Prompt</span>
              <input
                className={`${pill} mt-1 w-full`}
                value={q.prompt}
                onChange={(e) => setQ(i, { prompt: e.target.value })}
              />
            </label>
            {q.type === 'numeric' ? (
              <label className="mt-2 block">
                <span className="text-xs font-medium text-ink-muted">
                  Correct numeric answer
                </span>
                <input
                  type="number"
                  step="any"
                  className={`${pill} mt-1`}
                  value={q.answer}
                  onChange={(e) => setQ(i, { answer: e.target.value })}
                />
              </label>
            ) : (
              <fieldset className="mt-2 space-y-1">
                <legend className="text-xs font-medium text-ink-muted">
                  Choices and correct answer
                </legend>
                {q.choices.map((c, ci) => (
                  <div key={ci} className="flex items-center gap-2">
                    <input
                      type={q.type === 'multiple_choice' ? 'radio' : 'checkbox'}
                      name={`correct-${i}`}
                      aria-label={`Mark choice ${ci + 1} as correct for question ${i + 1}`}
                      checked={
                        q.type === 'multiple_choice'
                          ? q.correctIndex === ci
                          : q.correctIndices.includes(ci)
                      }
                      onChange={() =>
                        q.type === 'multiple_choice'
                          ? setQ(i, { correctIndex: ci })
                          : setQ(i, {
                              correctIndices: q.correctIndices.includes(ci)
                                ? q.correctIndices.filter((x) => x !== ci)
                                : [...q.correctIndices, ci],
                            })
                      }
                    />
                    <input
                      className={`${pill} flex-1`}
                      aria-label={`Question ${i + 1} choice ${ci + 1}`}
                      value={c}
                      onChange={(e) =>
                        setQ(i, {
                          choices: q.choices.map((x, j) =>
                            j === ci ? e.target.value : x,
                          ),
                        })
                      }
                    />
                    <button
                      type="button"
                      className="text-xs text-red-600 disabled:cursor-not-allowed disabled:text-slate-400"
                      disabled={q.choices.length <= 2}
                      aria-label={`Remove choice ${ci + 1}`}
                      onClick={() => setQ(i, removeChoiceAt(q, ci))}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="text-xs text-accent underline"
                  onClick={() => setQ(i, { choices: [...q.choices, ''] })}
                >
                  + choice
                </button>
              </fieldset>
            )}
            <label className="mt-2 block">
              <span className="text-xs font-medium text-ink-muted">
                Explanation shown after grading
              </span>
              <input
                className={`${pill} mt-1 w-full`}
                value={q.explanation}
                onChange={(e) => setQ(i, { explanation: e.target.value })}
              />
            </label>
          </fieldset>
        ))}
        <button
          type="button"
          className="rounded border border-slate-300 px-3 py-1"
          onClick={() => setQuestions((qs) => [...qs, blankQ()])}
        >
          + Add question
        </button>
      </div>

      {initial?.id && (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
          />{' '}
          Published
        </label>
      )}
      <button
        type="submit"
        className="rounded bg-accent px-3 py-1.5 font-medium text-white hover:bg-blue-700"
      >
        {initial?.id ? 'Save quiz' : 'Save hidden quiz'}
      </button>
    </form>
  );
}
