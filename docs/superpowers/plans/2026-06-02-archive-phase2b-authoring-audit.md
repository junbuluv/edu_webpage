# Archive Phase 2b — interactive quiz authoring + audit logging

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Instructors/admins author interactive, server-graded quizzes (exam/assignment) in the browser, stored in the DB and taken by enrolled students at `/practice/<id>`; and every archive management action is recorded in `audit_log` for the admin viewer.

**Architecture:** New RLS-locked `archive_quizzes` table (`questions jsonb`). A `loadGradableQuiz(slug)` resolver (git content first, else DB by id) backs BOTH the quiz viewer and `/api/quiz/grade`, so answer-stripping (`toPublicQuestions`) and `gradeQuiz` stay single-sourced and the existing non-practice kind-gate covers authored exams. A builder React island maintains question rows and posts a JSON payload to a gated handler that re-validates with a standalone Zod schema. All 9 archive mutation handlers call `logDisclosureSafe`.

**Tech Stack:** Astro 5 SSR, Supabase service-role admin client, Zod, React island, `node --test`.

**Spec:** `docs/superpowers/specs/2026-06-02-archive-authoring-uploads-design.md` (Phase 2b section + the audit-logging addendum).

**Scope note:** Phase 2a (files/videos/discoverability) is already merged. Do NOT re-touch `archive_papers`/`archive_videos` except to add audit-logging in Task 8.

---

## File Structure

**Create:**
- `src/lib/quiz/question-schema.ts` — standalone Zod validator for authored quiz questions (mirror of `config.ts` `QuestionSchema`; avoids importing the content config into API routes). + test.
- `src/lib/quiz/resolve.ts` — `loadGradableQuiz(slug)` git-or-DB resolver.
- `src/pages/api/instructor/archive/quiz/{create,update,delete}.ts` — gated quiz CRUD.
- `src/pages/instructor/archive/quiz/new.astro` + `src/pages/instructor/archive/quiz/[id].astro` — builder pages.
- `src/components/archive/ArchiveQuizBuilder.tsx` — builder island.

**Modify:**
- `supabase/schema.sql` + `src/lib/supabase/database.types.ts` — `archive_quizzes` table.
- `src/pages/api/quiz/grade.ts` + `src/pages/practice/[slug].astro` — use `loadGradableQuiz`.
- `src/lib/archive/{db,load,build}.ts` + `types.ts` — merge authored quizzes as `/practice/<id>` items.
- `src/lib/instructor/archive-manage.ts` — load authored quizzes for the hub.
- `src/pages/instructor/archive/index.astro` — "Build a quiz" entry + authored-quiz list.
- `src/lib/audit.ts` — add `'manage_archive'`.
- `src/pages/api/instructor/archive/video/{create,update,delete}.ts` + `paper/{create,update,delete}.ts` + the new `quiz/*` — add `logDisclosureSafe`.

---

## Task 1: `archive_quizzes` table + RLS + types

**Files:** Modify `supabase/schema.sql`, `src/lib/supabase/database.types.ts`.

- [ ] **Step 1: schema.sql** (append after `archive_papers`):
```sql
-- =========================================================================
-- archive_quizzes --- instructor-authored interactive quizzes (exam/assignment)
-- surfaced in the archive and taken at /practice/<id>. RLS-locked; questions
-- (incl. answer keys) live in jsonb, server-only. Validated app-side by the
-- Zod schema in src/lib/quiz/question-schema.ts before insert.
-- =========================================================================
create table if not exists public.archive_quizzes (
  id uuid primary key default gen_random_uuid(),
  course_slug text not null,
  kind text not null,
  title text not null,
  semester_term text not null,
  semester_year integer not null,
  covers text[] not null default '{}',
  questions jsonb not null,
  passing_score numeric not null default 0.7,
  created_by uuid not null references public.profiles(id) on delete restrict,
  published boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  -- updated_at maintained by the mutation API.
  updated_at timestamptz not null default now(),
  check (kind in ('exam', 'assignment')),
  check (semester_term in ('spring', 'summer', 'fall')),
  check (semester_year between 2020 and 2100),
  check (passing_score >= 0 and passing_score <= 1)
);

create index if not exists archive_quizzes_live_idx
  on public.archive_quizzes (course_slug)
  where deleted_at is null and published;

alter table public.archive_quizzes enable row level security;
-- No policies: service-role only (instructor UI gates in app code).
```

- [ ] **Step 2: database.types.ts** — add the `archive_quizzes` block (after `archive_quizzes` would sort before `archive_videos`; place it alphabetically first among archive_* — i.e. before `archive_papers`). Use `questions: Json` (Row/Insert/Update), `passing_score: number`, `kind`/`semester_term` literal unions, `Relationships: []`:
```ts
      archive_quizzes: {
        Row: {
          id: string;
          course_slug: string;
          kind: 'exam' | 'assignment';
          title: string;
          semester_term: 'spring' | 'summer' | 'fall';
          semester_year: number;
          covers: string[];
          questions: Json;
          passing_score: number;
          created_by: string;
          published: boolean;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          course_slug: string;
          kind: 'exam' | 'assignment';
          title: string;
          semester_term: 'spring' | 'summer' | 'fall';
          semester_year: number;
          covers?: string[];
          questions: Json;
          passing_score?: number;
          created_by: string;
          published?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          course_slug?: string;
          kind?: 'exam' | 'assignment';
          title?: string;
          semester_term?: 'spring' | 'summer' | 'fall';
          semester_year?: number;
          covers?: string[];
          questions?: Json;
          passing_score?: number;
          created_by?: string;
          published?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
```
(Confirm `Json` is already exported/used in the file; it is — `import type { Json }` is used by audit.ts. The Database type file defines `Json`.)

- [ ] **Step 3:** `npm run typecheck` → 0 errors.
- [ ] **Step 4: Commit** — `git add supabase/schema.sql src/lib/supabase/database.types.ts && git commit -m "db(archive): add archive_quizzes table (RLS-locked) + types"`

---

## Task 2: Standalone question Zod schema

**Files:** Create `src/lib/quiz/question-schema.ts`, `src/lib/quiz/question-schema.test.ts`.

> Standalone validator (imports only `zod`) so API routes can validate authored questions without importing `src/content/config.ts` (which would trigger `defineCollection` side effects). Mirrors `config.ts` `QuestionSchema`; keep them in sync.

- [ ] **Step 1: Failing test** — `src/lib/quiz/question-schema.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quizQuestionsSchema } from './question-schema.ts';

test('accepts a valid mixed question array', () => {
  const r = quizQuestionsSchema.safeParse([
    { type: 'multiple_choice', id: 'q1', prompt: 'p', choices: ['a', 'b'], correctIndex: 0, explanation: 'e' },
    { type: 'numeric', id: 'q2', prompt: 'p', answer: 1.5, explanation: 'e' },
    { type: 'multi_select', id: 'q3', prompt: 'p', choices: ['a', 'b', 'c'], correctIndices: [0, 2], explanation: 'e' },
  ]);
  assert.equal(r.success, true);
});

test('rejects empty array', () => {
  assert.equal(quizQuestionsSchema.safeParse([]).success, false);
});

test('rejects multiple_choice with no choices / bad index', () => {
  assert.equal(
    quizQuestionsSchema.safeParse([{ type: 'multiple_choice', id: 'q', prompt: 'p', choices: ['only-one'], correctIndex: 0, explanation: 'e' }]).success,
    false,
  );
});

test('rejects unknown type', () => {
  assert.equal(
    quizQuestionsSchema.safeParse([{ type: 'essay', id: 'q', prompt: 'p', explanation: 'e' }]).success,
    false,
  );
});
```

- [ ] **Step 2: Run → FAIL** — `node --test src/lib/quiz/question-schema.test.ts`.

- [ ] **Step 3: Implement** — `src/lib/quiz/question-schema.ts`:
```ts
import { z } from 'zod';

// Standalone mirror of the QuestionSchema discriminated union in
// src/content/config.ts. Kept separate so API routes can validate authored
// quiz questions without importing the Astro content config. Keep in sync
// with config.ts if question shapes change.
export const questionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('multiple_choice'),
    id: z.string(),
    prompt: z.string(),
    choices: z.array(z.string()).min(2),
    correctIndex: z.number().int().nonnegative(),
    explanation: z.string(),
    points: z.number().positive().default(1),
  }),
  z.object({
    type: z.literal('numeric'),
    id: z.string(),
    prompt: z.string(),
    answer: z.number(),
    tolerance: z.number().nonnegative().default(0.01),
    unit: z.string().optional(),
    explanation: z.string(),
    points: z.number().positive().default(1),
  }),
  z.object({
    type: z.literal('multi_select'),
    id: z.string(),
    prompt: z.string(),
    choices: z.array(z.string()).min(2),
    correctIndices: z.array(z.number().int().nonnegative()).min(1),
    explanation: z.string(),
    points: z.number().positive().default(1),
  }),
]);

export const quizQuestionsSchema = z.array(questionSchema).min(1);
export type AuthoredQuestion = z.infer<typeof questionSchema>;
```

- [ ] **Step 4: Run → PASS** — `node --test src/lib/quiz/question-schema.test.ts` (4 pass). `npm run format`.
- [ ] **Step 5: Commit** — `git add src/lib/quiz/question-schema.ts src/lib/quiz/question-schema.test.ts && git commit -m "feat(quiz): standalone Zod question schema for authored-quiz validation"`

---

## Task 3: `loadGradableQuiz` git-or-DB resolver

**Files:** Create `src/lib/quiz/resolve.ts`.

> Server-only. Returns a normalized quiz from git content (by slug) OR `archive_quizzes` (by id). Used by the viewer + grade API.

- [ ] **Step 1: Implement** — `src/lib/quiz/resolve.ts`:
```ts
import { getEntry } from 'astro:content';
import { getAdminClient } from '@lib/supabase/admin';
import type { QuestionT } from '@/content/config';

export interface GradableQuiz {
  slug: string;
  title: string;
  course: string;
  kind: 'practice' | 'exam' | 'assignment';
  questions: QuestionT[];
  passingScore: number;
  lessonSlug?: string;
  furtherReading?: QuestionT extends never ? never : unknown; // see note
}

/**
 * Resolve a quiz by slug: git content collection first, else an instructor-
 * authored DB quiz by id. Returns null if neither exists. Server-only (the
 * DB read uses the service-role admin client). The questions array carries
 * answer keys; callers must strip via toPublicQuestions before SSR.
 */
export async function loadGradableQuiz(slug: string): Promise<
  | (Omit<GradableQuiz, 'furtherReading'> & {
      furtherReading?: {
        title: string;
        url: string;
        source: string;
        date?: string;
        why: string;
      };
    })
  | null
> {
  const entry = await getEntry('quizzes', slug);
  if (entry) {
    const d = entry.data;
    return {
      slug: d.slug,
      title: d.title,
      course: d.course,
      kind: d.kind,
      questions: d.questions,
      passingScore: d.passingScore,
      lessonSlug: d.lessonSlug,
      furtherReading: d.furtherReading,
    };
  }
  try {
    const admin = getAdminClient();
    const { data } = await admin
      .from('archive_quizzes')
      .select('id, title, course_slug, kind, questions, passing_score')
      .eq('id', slug)
      .is('deleted_at', null)
      .eq('published', true)
      .maybeSingle();
    if (!data) return null;
    return {
      slug: data.id,
      title: data.title,
      course: data.course_slug,
      kind: data.kind,
      questions: data.questions as unknown as QuestionT[],
      passingScore: Number(data.passing_score),
    };
  } catch {
    return null;
  }
}
```
NOTE: simplify the return type — delete the confusing `furtherReading` field from the `GradableQuiz` interface and just inline the return type as written in the function signature (the function's explicit return type is the source of truth; the `GradableQuiz` interface is only a convenience and its `furtherReading` line should be removed). Final `GradableQuiz`:
```ts
export interface GradableQuiz {
  slug: string;
  title: string;
  course: string;
  kind: 'practice' | 'exam' | 'assignment';
  questions: QuestionT[];
  passingScore: number;
  lessonSlug?: string;
  furtherReading?: {
    title: string;
    url: string;
    source: string;
    date?: string;
    why: string;
  };
}
```
and the function returns `Promise<GradableQuiz | null>`.

- [ ] **Step 2:** `npm run typecheck` → 0 errors.
- [ ] **Step 3: Commit** — `git add src/lib/quiz/resolve.ts && git commit -m "feat(quiz): loadGradableQuiz git-or-DB resolver"`

---

## Task 4: Wire the resolver into the grade API + viewer

**Files:** Modify `src/pages/api/quiz/grade.ts`, `src/pages/practice/[slug].astro`.

- [ ] **Step 1: grade.ts** — replace the `getEntry`-based lookup with the resolver. Change the import `import { getEntry } from 'astro:content';` to `import { loadGradableQuiz } from '@lib/quiz/resolve';`. Replace:
```ts
  const entry = await getEntry('quizzes', slug);
  if (!entry) return json({ error: 'quiz_not_found' }, 404);

  if (entry.data.kind !== 'practice') {
    if (!locals.user) return json({ error: 'unauthorized' }, 401);
    if (!(await canViewCourse(locals, entry.data.course))) {
      return json({ error: 'forbidden' }, 403);
    }
  }

  const result = gradeQuiz(
    entry.data.questions as GradableQuestion[],
    answers,
    entry.data.passingScore,
  );
  return json(result);
```
with:
```ts
  const quiz = await loadGradableQuiz(slug);
  if (!quiz) return json({ error: 'quiz_not_found' }, 404);

  if (quiz.kind !== 'practice') {
    if (!locals.user) return json({ error: 'unauthorized' }, 401);
    if (!(await canViewCourse(locals, quiz.course))) {
      return json({ error: 'forbidden' }, 403);
    }
  }

  const result = gradeQuiz(
    quiz.questions as GradableQuestion[],
    answers,
    quiz.passingScore,
  );
  return json(result);
```

- [ ] **Step 2: practice/[slug].astro** — replace `getEntry` with the resolver. Change import `import { getEntry } from 'astro:content';` to `import { loadGradableQuiz } from '@lib/quiz/resolve';`. Replace:
```ts
const entry = await getEntry('quizzes', slug);
if (!entry) {
  return new Response(null, { status: 404 });
}
const quiz = entry.data;
```
with:
```ts
const quiz = await loadGradableQuiz(slug);
if (!quiz) {
  return new Response(null, { status: 404 });
}
```
The rest of the file already references `quiz.kind`, `quiz.course`, `quiz.title`, `quiz.questions`, `quiz.passingScore`, `quiz.furtherReading`, `quiz.lessonSlug` — all present on the resolver's return shape, so no other changes. (The `kindLabel` const and the gate block stay.)

- [ ] **Step 3: Verify** — `node --test 'src/lib/**/*.test.ts'` (still pass), `npm run typecheck`, build (placeholder env). Expected PASS (placeholder env: git quizzes still resolve via getEntry; DB path returns null in catch).
- [ ] **Step 4: Commit** — `git add src/pages/api/quiz/grade.ts src/pages/practice/[slug].astro && git commit -m "feat(quiz): resolve quizzes via git-or-DB in viewer + grade API"`

---

## Task 5: Quiz CRUD APIs (gated, validated, audited later)

**Files:** Create `src/pages/api/instructor/archive/quiz/{create,update,delete}.ts`.

> The builder posts a hidden `payload` form field (JSON string). Handler parses it, validates `questions` via `quizQuestionsSchema`, gates `isContentManager → instructorOwnsCourse → own-row`, inserts/updates/soft-deletes. Audit-logging is ADDED in Task 8 (leave a `// TODO(task8): logDisclosureSafe` marker is NOT allowed — instead Task 8 will edit these files; for now write them WITHOUT the audit call).

- [ ] **Step 1: create.ts** — `src/pages/api/instructor/archive/quiz/create.ts`:
```ts
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getAdminClient } from '@lib/supabase/admin';
import { isContentManager } from '@lib/roles';
import { instructorOwnsCourse } from '@lib/archive/access';
import { normalizeLessonSlug } from '@lib/archive/build';
import { quizQuestionsSchema } from '@lib/quiz/question-schema';

const TERMS = new Set(['spring', 'summer', 'fall']);
const KINDS = new Set(['exam', 'assignment']);

function err(reason: string): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: `/instructor/archive?error=${encodeURIComponent(reason)}` },
  });
}

interface Payload {
  course_slug?: unknown;
  kind?: unknown;
  title?: unknown;
  semester_term?: unknown;
  semester_year?: unknown;
  covers?: unknown;
  passing_score?: unknown;
  questions?: unknown;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  const role = locals.profile?.role ?? 'student';

  const form = await request.formData();
  let p: Payload;
  try {
    p = JSON.parse(String(form.get('payload') ?? '')) as Payload;
  } catch {
    return err('invalid_payload');
  }

  const course = typeof p.course_slug === 'string' ? p.course_slug : '';
  const kind = typeof p.kind === 'string' ? p.kind : '';
  const title = (typeof p.title === 'string' ? p.title : '').trim();
  const term = typeof p.semester_term === 'string' ? p.semester_term : '';
  const year = Number(p.semester_year ?? NaN);
  const covers = Array.isArray(p.covers) ? p.covers.map(String) : [];
  const passing = Number(p.passing_score ?? 0.7);

  if (!user) return err('unauthenticated');
  if (!isContentManager(role)) return err('forbidden');
  if (!(await instructorOwnsCourse(user.id, course, role)))
    return err('not_course_instructor');
  if (
    !title ||
    !KINDS.has(kind) ||
    !TERMS.has(term) ||
    !Number.isInteger(year) ||
    year < 2020 ||
    year > 2100 ||
    !(passing >= 0 && passing <= 1)
  ) {
    return err('invalid_input');
  }

  const parsed = quizQuestionsSchema.safeParse(p.questions);
  if (!parsed.success) return err('invalid_questions');

  const lessons = await getCollection('lessons', (l) => l.data.course === course);
  const valid = new Set(lessons.map((l) => normalizeLessonSlug(l.id)));
  if (covers.some((c) => !valid.has(c))) return err('invalid_lesson');

  const admin = getAdminClient();
  const { error } = await admin.from('archive_quizzes').insert({
    course_slug: course,
    kind: kind as 'exam' | 'assignment',
    title,
    semester_term: term as 'spring' | 'summer' | 'fall',
    semester_year: year,
    covers,
    questions: parsed.data,
    passing_score: passing,
    created_by: user.id,
  });
  if (error) return err('insert_failed');

  return new Response(null, {
    status: 303,
    headers: { Location: `/instructor/archive?ok=quiz_created` },
  });
};
```

- [ ] **Step 2: update.ts** — same shape, but loads the row first for course+created_by, gates own-row (`!isAdmin && created_by !== user.id`), reads `id` from payload, sets `updated_at`, and `published` from `p.published === true`. `src/pages/api/instructor/archive/quiz/update.ts`:
```ts
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getAdminClient } from '@lib/supabase/admin';
import { isContentManager, isAdmin } from '@lib/roles';
import { instructorOwnsCourse } from '@lib/archive/access';
import { normalizeLessonSlug } from '@lib/archive/build';
import { quizQuestionsSchema } from '@lib/quiz/question-schema';

const TERMS = new Set(['spring', 'summer', 'fall']);
const KINDS = new Set(['exam', 'assignment']);

function err(reason: string): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: `/instructor/archive?error=${encodeURIComponent(reason)}` },
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  const role = locals.profile?.role ?? 'student';

  const form = await request.formData();
  let p: Record<string, unknown>;
  try {
    p = JSON.parse(String(form.get('payload') ?? '')) as Record<string, unknown>;
  } catch {
    return err('invalid_payload');
  }

  const id = typeof p.id === 'string' ? p.id : '';
  const kind = typeof p.kind === 'string' ? p.kind : '';
  const title = (typeof p.title === 'string' ? p.title : '').trim();
  const term = typeof p.semester_term === 'string' ? p.semester_term : '';
  const year = Number(p.semester_year ?? NaN);
  const covers = Array.isArray(p.covers) ? p.covers.map(String) : [];
  const passing = Number(p.passing_score ?? 0.7);
  const published = p.published === true;

  if (!user) return err('unauthenticated');
  if (!isContentManager(role)) return err('forbidden');
  if (!id) return err('invalid_input');

  const admin = getAdminClient();
  const { data: row } = await admin
    .from('archive_quizzes')
    .select('course_slug, created_by')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!row) return err('not_found');
  if (!(await instructorOwnsCourse(user.id, row.course_slug, role)))
    return err('not_course_instructor');
  if (!isAdmin(role) && row.created_by !== user.id) return err('not_owner');

  if (
    !title ||
    !KINDS.has(kind) ||
    !TERMS.has(term) ||
    !Number.isInteger(year) ||
    year < 2020 ||
    year > 2100 ||
    !(passing >= 0 && passing <= 1)
  ) {
    return err('invalid_input');
  }
  const parsed = quizQuestionsSchema.safeParse(p.questions);
  if (!parsed.success) return err('invalid_questions');

  const lessons = await getCollection(
    'lessons',
    (l) => l.data.course === row.course_slug,
  );
  const valid = new Set(lessons.map((l) => normalizeLessonSlug(l.id)));
  if (covers.some((c) => !valid.has(c))) return err('invalid_lesson');

  const { error } = await admin
    .from('archive_quizzes')
    .update({
      kind: kind as 'exam' | 'assignment',
      title,
      semester_term: term as 'spring' | 'summer' | 'fall',
      semester_year: year,
      covers,
      questions: parsed.data,
      passing_score: passing,
      published,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) return err('update_failed');

  return new Response(null, {
    status: 303,
    headers: { Location: `/instructor/archive?ok=quiz_updated` },
  });
};
```

- [ ] **Step 3: delete.ts** — `src/pages/api/instructor/archive/quiz/delete.ts` (form-data `id`, soft-delete, same gate as paper/delete):
```ts
import type { APIRoute } from 'astro';
import { getAdminClient } from '@lib/supabase/admin';
import { isContentManager, isAdmin } from '@lib/roles';
import { instructorOwnsCourse } from '@lib/archive/access';

function err(reason: string): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: `/instructor/archive?error=${encodeURIComponent(reason)}` },
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  const role = locals.profile?.role ?? 'student';
  const form = await request.formData();
  const id = String(form.get('id') ?? '');

  if (!user) return err('unauthenticated');
  if (!isContentManager(role)) return err('forbidden');
  if (!id) return err('invalid_input');

  const admin = getAdminClient();
  const { data: row } = await admin
    .from('archive_quizzes')
    .select('course_slug, created_by')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!row) return err('not_found');
  if (!(await instructorOwnsCourse(user.id, row.course_slug, role)))
    return err('not_course_instructor');
  if (!isAdmin(role) && row.created_by !== user.id) return err('not_owner');

  const { error } = await admin
    .from('archive_quizzes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null);
  if (error) return err('delete_failed');

  return new Response(null, {
    status: 303,
    headers: { Location: `/instructor/archive?ok=quiz_deleted` },
  });
};
```

- [ ] **Step 4: Verify** — `npm run typecheck`, `npm run format`, build (placeholder env). Expected PASS.
- [ ] **Step 5: Commit** — `git add src/pages/api/instructor/archive/quiz/create.ts src/pages/api/instructor/archive/quiz/update.ts src/pages/api/instructor/archive/quiz/delete.ts && git commit -m "feat(archive): instructor authored-quiz CRUD APIs (gated, Zod-validated)"`

---

## Task 6: `ArchiveQuizBuilder` island

**Files:** Create `src/components/archive/ArchiveQuizBuilder.tsx`.

> React island. Maintains quiz-level fields + a dynamic question list. On submit, serializes to a hidden `payload` input inside a plain `<form method="POST">` so the existing error-redirect handler pattern applies. Receives `action` (create or update URL), optional `initial` quiz, the course list, and the course's lessons for the covers picker.

- [ ] **Step 1: Implement** — `src/components/archive/ArchiveQuizBuilder.tsx`:
```tsx
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
interface LessonOpt { slug: string; title: string }
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
    questions: Q[];
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

export default function ArchiveQuizBuilder({ action, courses, lessons, initial }: Props) {
  const [course, setCourse] = useState(initial?.course_slug ?? courses[0] ?? '');
  const [kind, setKind] = useState<'exam' | 'assignment'>(initial?.kind ?? 'exam');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [term, setTerm] = useState(initial?.semester_term ?? 'fall');
  const [year, setYear] = useState(initial?.semester_year ?? new Date().getFullYear());
  const [passing, setPassing] = useState(initial?.passing_score ?? 0.7);
  const [covers, setCovers] = useState<string[]>(initial?.covers ?? []);
  const [published, setPublished] = useState(initial?.published ?? true);
  const [questions, setQuestions] = useState<Q[]>(initial?.questions?.length ? initial.questions : [blankQ()]);
  const [error, setError] = useState<string | null>(null);

  const setQ = (i: number, patch: Partial<Q>) =>
    setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));

  function buildPayload(): string {
    const qs = questions.map((q) => {
      const base = { type: q.type, id: q.id, prompt: q.prompt, explanation: q.explanation };
      if (q.type === 'numeric') return { ...base, answer: Number(q.answer) };
      if (q.type === 'multi_select')
        return { ...base, choices: q.choices, correctIndices: q.correctIndices };
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
        if (v) { e.preventDefault(); setError(v); }
      }}
      className="mt-4 space-y-4 text-sm"
    >
      <input type="hidden" name="payload" value={buildPayload()} />
      {error && (
        <p className="rounded border border-amber-300 bg-amber-50 p-2 text-amber-900">{error}</p>
      )}
      <div className="flex flex-wrap gap-3">
        <label>Course
          <select className={pill} value={course} onChange={(e) => setCourse(e.target.value)}>
            {courses.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>Kind
          <select className={pill} value={kind} onChange={(e) => setKind(e.target.value as 'exam' | 'assignment')}>
            <option value="exam">Exam</option>
            <option value="assignment">Assignment</option>
          </select>
        </label>
        <label>Term
          <select className={pill} value={term} onChange={(e) => setTerm(e.target.value as typeof term)}>
            <option value="spring">Spring</option><option value="summer">Summer</option><option value="fall">Fall</option>
          </select>
        </label>
        <label>Year
          <input type="number" min={2020} max={2100} className={`${pill} w-24`} value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </label>
        <label>Passing score (0-1)
          <input type="number" min={0} max={1} step={0.05} className={`${pill} w-24`} value={passing} onChange={(e) => setPassing(Number(e.target.value))} />
        </label>
      </div>
      <label className="block">Title
        <input className={`${pill} w-full`} value={title} onChange={(e) => setTitle(e.target.value)} />
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
                  setCovers((cs) => e.target.checked ? [...cs, l.slug] : cs.filter((s) => s !== l.slug))
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
                <select className={pill} value={q.type} onChange={(e) => setQ(i, { type: e.target.value as QType })}>
                  <option value="multiple_choice">Multiple choice</option>
                  <option value="numeric">Numeric</option>
                  <option value="multi_select">Multi-select</option>
                </select>
                <button type="button" className="text-red-600 underline" onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))}>Remove</button>
              </div>
            </div>
            <input className={`${pill} mt-2 w-full`} placeholder="Prompt" value={q.prompt} onChange={(e) => setQ(i, { prompt: e.target.value })} />
            {q.type === 'numeric' ? (
              <input type="number" className={`${pill} mt-2`} placeholder="Answer" value={q.answer} onChange={(e) => setQ(i, { answer: Number(e.target.value) })} />
            ) : (
              <div className="mt-2 space-y-1">
                {q.choices.map((c, ci) => (
                  <div key={ci} className="flex items-center gap-2">
                    <input
                      type={q.type === 'multiple_choice' ? 'radio' : 'checkbox'}
                      name={`correct-${i}`}
                      checked={q.type === 'multiple_choice' ? q.correctIndex === ci : q.correctIndices.includes(ci)}
                      onChange={() =>
                        q.type === 'multiple_choice'
                          ? setQ(i, { correctIndex: ci })
                          : setQ(i, { correctIndices: q.correctIndices.includes(ci) ? q.correctIndices.filter((x) => x !== ci) : [...q.correctIndices, ci] })
                      }
                    />
                    <input className={`${pill} flex-1`} placeholder={`Choice ${ci + 1}`} value={c} onChange={(e) => setQ(i, { choices: q.choices.map((x, j) => (j === ci ? e.target.value : x)) })} />
                    <button type="button" className="text-xs text-red-600" onClick={() => setQ(i, { choices: q.choices.filter((_, j) => j !== ci) })}>×</button>
                  </div>
                ))}
                <button type="button" className="text-xs text-accent underline" onClick={() => setQ(i, { choices: [...q.choices, ''] })}>+ choice</button>
              </div>
            )}
            <input className={`${pill} mt-2 w-full`} placeholder="Explanation (shown after grading)" value={q.explanation} onChange={(e) => setQ(i, { explanation: e.target.value })} />
          </div>
        ))}
        <button type="button" className="rounded border border-slate-300 px-3 py-1" onClick={() => setQuestions((qs) => [...qs, blankQ()])}>+ Add question</button>
      </div>

      {initial?.id && (
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> Published
        </label>
      )}
      <button type="submit" className="rounded bg-accent px-3 py-1.5 font-medium text-white hover:bg-blue-700">Save quiz</button>
    </form>
  );
}
```
NOTE: `performance.now()` is available in the browser; using it for a default question id is fine (server re-checks ids only for shape, not uniqueness — duplicate ids would still validate but should be avoided; the builder's incremental ids suffice). If `Math.random`-style stable ids are preferred, the author may keep `performance.now()`-derived ids as written.

- [ ] **Step 2: Verify** — `npm run typecheck` (confirm React island JSX/`className` ok against `src/components/quiz/Quiz.tsx`), `npm run format`, build. Expected PASS.
- [ ] **Step 3: Commit** — `git add src/components/archive/ArchiveQuizBuilder.tsx && git commit -m "feat(archive): ArchiveQuizBuilder island (dynamic question authoring)"`

---

## Task 7: Builder pages + hub wiring + loader merge

**Files:** Create `src/pages/instructor/archive/quiz/new.astro`, `src/pages/instructor/archive/quiz/[id].astro`; modify `src/lib/instructor/archive-manage.ts`, `src/lib/archive/{db,load}.ts`, `src/pages/instructor/archive/index.astro`.

- [ ] **Step 1: db.ts** — add `fetchArchiveQuizzes(course)` (published+not-deleted; select id,course_slug,kind,title,semester_term,semester_year,covers; NOT questions — the archive list needs only metadata). Append:
```ts
export interface ArchiveQuizRow {
  id: string;
  course_slug: string;
  kind: 'exam' | 'assignment';
  title: string;
  semester_term: 'spring' | 'summer' | 'fall';
  semester_year: number;
  covers: string[];
}

export async function fetchArchiveQuizzes(course: string): Promise<ArchiveQuizRow[]> {
  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('archive_quizzes')
      .select('id, course_slug, kind, title, semester_term, semester_year, covers')
      .eq('course_slug', course)
      .eq('published', true)
      .is('deleted_at', null);
    if (error) return [];
    return (data ?? []) as ArchiveQuizRow[];
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: load.ts** — fetch authored quizzes and feed them as `QuizInput`s (kind exam/assignment, slug=id, covers, semester) so `buildArchiveItems` makes `/practice/<id>` items. Add `fetchArchiveQuizzes` to the `./db` import; after the `quizzes` (git) mapping, add:
```ts
  const dbQuizRows = await fetchArchiveQuizzes(course);
  const dbQuizzes: QuizInput[] = dbQuizRows.map((r) => ({
    slug: r.id,
    course: r.course_slug,
    title: r.title,
    kind: r.kind,
    covers: r.covers,
    semester: { term: r.semester_term, year: r.semester_year },
  }));
  const quizzes: QuizInput[] = [...gitQuizzes, ...dbQuizzes];
```
where the existing git `quizzes` mapping is renamed to `gitQuizzes`. (`buildArchiveItems` already turns non-practice `QuizInput`s into `/practice/<slug>` items — for DB quizzes that's `/practice/<id>`, which the resolver handles.)

- [ ] **Step 3: archive-manage.ts** — load authored quizzes for the hub. Add a `ManageQuiz` interface (id, courseSlug, kind, title, semesterTerm, semesterYear, published, createdBy) and a query mirroring `ManagePaper` (select incl. published + created_by, `.in('course_slug', courses).is('deleted_at', null)`), return `{ courses, videos, papers, quizzes }` (update the type + early return).

- [ ] **Step 4: hub index.astro** — add a "Build a quiz" link (`/instructor/archive/quiz/new`) in the Exams & assignments section, and an authored-quiz list (partitioned by ownership; Edit → `/instructor/archive/quiz/<id>`, Delete form → quiz/delete). Destructure `quizzes` + `editableQuizzes = partitionByOwnership(quizzes, {userId, canEditAll:isAdmin(role)})`.

- [ ] **Step 5: new.astro** — `src/pages/instructor/archive/quiz/new.astro`: gate isContentManager; compute the viewer's manageable courses (reuse `loadInstructorArchive(...).courses` or the instructor-courses query) and the lessons for the chosen/first course; render `<ArchiveQuizBuilder client:load action="/api/instructor/archive/quiz/create" courses={courses} lessons={lessons} />`. Prefill course from `?course=`.

- [ ] **Step 6: [id].astro** — `src/pages/instructor/archive/quiz/[id].astro`: gate isContentManager; load the row via admin (incl. questions); instructorOwnsCourse + own-row gate; render `<ArchiveQuizBuilder client:load action="/api/instructor/archive/quiz/update" courses={[row.course_slug]} lessons={lessons} initial={{...row mapped to the Props.initial shape, questions cast}} />`.

- [ ] **Step 7: Verify** — `npm run typecheck`, `npm run format`, build (placeholder env → archive renders git-only; routes emit). `node --test 'src/lib/**/*.test.ts'`. Expected PASS.
- [ ] **Step 8: Commit** — `git add -A && git commit -m "feat(archive): authored-quiz hub section, builder pages, loader merge"`

> This task is larger; if a sub-step blocks, split per file. The builder pages mirror the established gating in `paper/[id].astro`. For the `lessons` list use `getCollection('lessons', l => l.data.course === course).map(l => ({slug: normalizeLessonSlug(l.id), title: l.data.title}))`.

---

## Task 8: Audit-logging across all archive mutations

**Files:** Modify `src/lib/audit.ts`; all 9 handlers under `src/pages/api/instructor/archive/{video,paper,quiz}/{create,update,delete}.ts`.

- [ ] **Step 1: audit.ts** — add `'manage_archive'` to the `DisclosureAction` union.

- [ ] **Step 2: each handler** — import `logDisclosureSafe` from `@lib/audit`, and immediately before the success redirect add (adapting `resource`/`op`/`title`/`id`/`course` per handler):
```ts
  await logDisclosureSafe({
    actorId: user.id,
    actorRole: role as 'instructor' | 'admin',
    action: 'manage_archive',
    request,
    targetResource: `<resource> <op>: ${title} (${course})`,
    metadata: { resource: '<resource>', op: '<op>', id: <id>, course },
  });
```
For create handlers, `<id>` is the inserted id — capture it: change the video/paper/quiz inserts to `.insert({...}).select('id').single()` and use `data.id` (or for video/paper which currently don't return id, add `.select('id').single()` and read it; if the insert error path already returns, place the log after success). For update/delete, `id` is known from the form/payload, `course` from the loaded row, `title` from the form (update) or the loaded row (delete — add `title` to the row select). Keep it `logDisclosureSafe` (never throws).

  Concretely per resource:
  - video create: resource `'video'`, op `'create'`, title from form `title`, course `'eco-1002'`, id from insert.
  - video update/delete: op accordingly; for delete, add `title` to the row `.select(...)`.
  - paper create/update/delete: resource `'paper'`.
  - quiz create/update/delete: resource `'quiz'`.

- [ ] **Step 3: Verify** — `npm run typecheck`, `npm run format`, build. Expected PASS. (Audit failure can't be unit-tested without a DB; the fail-open wrapper guarantees no behavior change.)
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat(archive): audit-log all archive management actions (manage_archive)"`

---

## Task 9: Full verification + manual matrix

- [ ] **Step 1:** `node --test 'src/lib/**/*.test.ts'`, `npm run typecheck`, `npm run format` (restore unrelated reformats), build (placeholder env).
- [ ] **Step 2:** Apply `supabase/schema.sql` (archive_quizzes); confirm the table exists.
- [ ] **Step 3: Manual matrix** (`npm run dev`, instructor owning a course + enrolled student + admin):
  - Instructor builds a quiz (add MC + numeric + multi_select questions, set answers) → `?ok=quiz_created` → appears in the hub authored-quiz list and on `/{course}/archive` linking `/practice/<id>`.
  - Enrolled student opens `/practice/<id>` → takes it → graded; **answers absent from page source** (convention #17); guest hitting that id → redirected to signin.
  - Edit the quiz (change a question, toggle published) → reflected. Non-owner instructor → read-only / `not_owner`. TA → `forbidden` on create. Soft-delete hides it.
  - Admin `/admin` audit viewer shows `manage_archive` rows for the create/edit/delete (and for a video/paper action too).
- [ ] **Step 4:** Final review + PR titled `db: archive Phase 2b — interactive quiz authoring + audit logging`.

---

## Self-Review (completed during authoring)

- **Spec coverage:** archive_quizzes table+RLS+types (T1); standalone Zod validator (T2); git-or-DB resolver (T3) wired into viewer+grade (T4); gated+validated quiz CRUD (T5); builder island (T6); builder pages + hub + loader merge (T7); audit-logging across all 9 handlers + `manage_archive` (T8); verification incl. convention-#17 check + audit-viewer check (T9).
- **Placeholder scan:** none; complete code for the novel/risky parts. T7 step bodies describe pages that mirror the fully-specified `paper/[id].astro`/hub patterns from Phase 2a (acceptable — same code shapes, exact gating spelled out).
- **Type consistency:** `loadGradableQuiz` returns the fields `/practice/[slug]` already consumes (kind/course/title/questions/passingScore/furtherReading/lessonSlug); `quizQuestionsSchema` used in T5 + T2; `QuizInput` reused for DB quizzes in T7 (→ `/practice/<id>` items); `ManageQuiz.createdBy` feeds `partitionByOwnership`.
- **Conventions:** writes gate `isContentManager` (TA excluded) + ownership + own-row; service-role + RLS-locked (#6); error-redirect to the page (#16); #17 preserved (questions validated/stored server-side, `toPublicQuestions` strips before SSR, grading server-side via resolver); audit fail-open (`logDisclosureSafe`) matching roster export/import; pure logic alias-free + `node --test`.
