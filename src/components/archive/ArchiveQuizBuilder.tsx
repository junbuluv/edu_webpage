import { useState } from 'react';

type QType = 'multiple_choice' | 'numeric' | 'multi_select';
interface Q {
  type: QType;
  id: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  correctIndices: number[];
  answer: number;
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
  id: `q${Math.floor(performance.now() * 1000) % 1_000_000}`,
  prompt: '',
  choices: ['', ''],
  correctIndex: 0,
  correctIndices: [],
  answer: 0,
  explanation: '',
});

function normalizeQ(raw: RawQuestion): Q {
  const b = blankQ();
  return {
    type: raw.type,
    id: raw.id ?? b.id,
    prompt: raw.prompt ?? '',
    choices: raw.choices && raw.choices.length >= 2 ? raw.choices : ['', ''],
    correctIndex: typeof raw.correctIndex === 'number' ? raw.correctIndex : 0,
    correctIndices: Array.isArray(raw.correctIndices) ? raw.correctIndices : [],
    answer: typeof raw.answer === 'number' ? raw.answer : 0,
    explanation: raw.explanation ?? '',
  };
}

export default function ArchiveQuizBuilder({
  action,
  courses,
  lessons,
  initial,
}: Props) {
  const [course, setCourse] = useState(
    initial?.course_slug ?? courses[0] ?? '',
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
  const [published, setPublished] = useState(initial?.published ?? true);
  const [questions, setQuestions] = useState<Q[]>(
    initial?.questions?.length ? initial.questions.map(normalizeQ) : [blankQ()],
  );
  const [error, setError] = useState<string | null>(null);

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
        }
      }}
      className="mt-4 space-y-4 text-sm"
    >
      <input type="hidden" name="payload" value={buildPayload()} />
      {error && (
        <p className="rounded border border-amber-300 bg-amber-50 p-2 text-amber-900">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <label>
          Course
          <select
            className={pill}
            value={course}
            onChange={(e) => setCourse(e.target.value)}
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
          {lessons.map((l) => (
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
          <div key={i} className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between">
              <strong>Question {i + 1}</strong>
              <div className="flex items-center gap-2">
                <select
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
            <input
              className={`${pill} mt-2 w-full`}
              placeholder="Prompt"
              value={q.prompt}
              onChange={(e) => setQ(i, { prompt: e.target.value })}
            />
            {q.type === 'numeric' ? (
              <input
                type="number"
                className={`${pill} mt-2`}
                placeholder="Answer"
                value={q.answer}
                onChange={(e) => setQ(i, { answer: Number(e.target.value) })}
              />
            ) : (
              <div className="mt-2 space-y-1">
                {q.choices.map((c, ci) => (
                  <div key={ci} className="flex items-center gap-2">
                    <input
                      type={q.type === 'multiple_choice' ? 'radio' : 'checkbox'}
                      name={`correct-${i}`}
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
                      placeholder={`Choice ${ci + 1}`}
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
                      className="text-xs text-red-600"
                      onClick={() =>
                        setQ(i, {
                          choices: q.choices.filter((_, j) => j !== ci),
                        })
                      }
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
              </div>
            )}
            <input
              className={`${pill} mt-2 w-full`}
              placeholder="Explanation (shown after grading)"
              value={q.explanation}
              onChange={(e) => setQ(i, { explanation: e.target.value })}
            />
          </div>
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
        Save quiz
      </button>
    </form>
  );
}
