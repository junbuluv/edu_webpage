# Instructor exam/assignment authoring + file uploads + lesson-connected videos

**Date:** 2026-06-02
**Status:** Approved (brainstorming → ready for implementation plans)
**Builds on:** read-only archive (PR #90), instructor video mgmt Phase 1 (PR #91),
the earlier Phase-2 file-upload design
(`docs/superpowers/specs/2026-06-01-instructor-archive-management-design.md`).

## Goal

Let **instructors and admins** (TAs read-only, intentional) add and manage
exams/assignments in the course archive two ways — **file upload** (PDF/docx)
and an **in-browser interactive quiz builder** (server-graded) — and make all
archive management **easy to find** for staff. Additionally, surface each
lesson's **lecture videos directly on the lesson page** for enrolled students +
staff, with a staff "add a video for this lesson" shortcut.

## Non-goals

- No change to TA workshop/roster access (intentional; out of scope).
- No new question types (reuse `multiple_choice` / `numeric` / `multi_select`).
- No public exposure of gated content: authored exams and lesson videos stay
  enrolled+staff; files stay private (signed URLs).
- No unit/chapter-level video attachment (videos attach to a single lesson via
  `lesson_slug`, as today). Lesson = the unit of connection.
- No migration of git content to DB; archive stays hybrid.

## Decisions (from interview)

| Dimension | Decision |
|---|---|
| Who manages | Instructor + admin (`isContentManager`); TA read-only |
| Exam/assignment as file | Upload PDF/docx → private Storage → gated signed-URL download |
| Exam/assignment as interactive | In-browser quiz builder (MC/numeric/multi_select + answer keys + explanations + passing score), DB-stored, **server-graded online** |
| Grading path | Extend the existing engine to **git-or-DB** via one resolver |
| Discoverability | Rework hub into sections + staff "Manage this archive" link on `/{course}/archive` + teaching empty states |
| Lesson-connected videos | Show a lesson's videos on `/lessons/<slug>` for **enrolled students + staff**; staff get a prefilled "add a video for this lesson" link |
| Build | One spec, two shippable plans: **2a** files+discoverability+lesson-videos, **2b** interactive authoring |

## Data model (`db:` change — `supabase/schema.sql`, idempotent)

### `public.archive_papers` (NEW — file uploads)

```
id              uuid primary key default gen_random_uuid()
course_slug     text not null
kind            text not null check (kind in ('exam','assignment'))
title           text not null
semester_term   text not null check (semester_term in ('spring','summer','fall'))
semester_year   int  not null check (semester_year between 2020 and 2100)
covers          text[] not null default '{}'
storage_path    text not null
original_filename text not null
content_type    text not null
size_bytes      int  not null
created_by      uuid not null references public.profiles(id) on delete restrict
published       boolean not null default true
deleted_at      timestamptz
created_at      timestamptz not null default now()
updated_at      timestamptz not null default now()  -- app-maintained
```

### `public.archive_quizzes` (NEW — interactive authored quizzes)

```
id              uuid primary key default gen_random_uuid()
course_slug     text not null
kind            text not null check (kind in ('exam','assignment'))
title           text not null
semester_term   text not null check (semester_term in ('spring','summer','fall'))
semester_year   int  not null check (semester_year between 2020 and 2100)
covers          text[] not null default '{}'
questions       jsonb not null   -- validated app-side by QuestionSchema; answer keys live here, server-only
passing_score   numeric not null default 0.7 check (passing_score >= 0 and passing_score <= 1)
created_by      uuid not null references public.profiles(id) on delete restrict
published       boolean not null default true
deleted_at      timestamptz
created_at      timestamptz not null default now()
updated_at      timestamptz not null default now()  -- app-maintained
```

Indexes on each: `(course_slug)` partial `where deleted_at is null and
published`. Both **RLS-locked** (no anon/authenticated policies); all access
via the service-role admin client behind app-side gates (convention #6). No
PII. Storage: private bucket `archive-papers`, object path
`<course>/<paper_id>/<sanitized_filename>`; access only via service-role
`createSignedUrl(path, 3600)`. Regenerate `database.types.ts` (include
`Relationships: []` per table; keep `CompositeTypes`).

## Grading path (git-or-DB resolver)

New `src/lib/quiz/resolve.ts` (server-only): `loadGradableQuiz(slug)` returns a
normalized `{ slug, title, course, kind, questions, passingScore,
furtherReading? }` by trying `getEntry('quizzes', slug)` (git) first, else
`archive_quizzes` by id (service-role). Used by **both**:
- `src/pages/practice/[slug].astro` — renders `toPublicQuestions(questions)`
  (answer-strip, convention #17); the existing non-practice kind-gate
  (`canViewCourse`) automatically gates authored exams.
- `src/pages/api/quiz/grade.ts` — grades server-side via the unchanged pure
  `gradeQuiz`; same kind-gate for non-practice.

Answer keys remain only in the DB row / git file, never serialized to the
client. `gradeQuiz` and `toPublicQuestions` stay single-sourced.

## Archive loader + `ArchiveItem`

`loadArchiveForCourse` merges three exam/assignment flavors into the existing
pure pipeline:
- git interactive quizzes → `href: /practice/<slug>` (today).
- DB file papers (`archive_papers`) → `fileUrl` (signed URL), rendered as a
  download link.
- DB authored quizzes (`archive_quizzes`) → `href: /practice/<id>`.

`ArchiveItem` gains optional `fileUrl?`/`fileName?` (2a). `build.ts` gains a
`papers` input (file-exam items, `href:''`, `fileUrl` set) and treats DB
authored quizzes as ordinary `QuizInput`s (kind exam/assignment, semester,
covers) producing `href: /practice/<id>` items. `deriveFacets`/`filterItems`
unchanged. Signed-URL generation lives in `load.ts` (async/service-role),
keeping `build.ts` pure.

## Discoverability (Phase 2a — prominent, ships first)

- **`/instructor/archive` reworked** into two clear sections — **Videos** and
  **Exams & assignments** — each with visible Add controls: "Add video",
  "Upload a file", "Build a quiz". Teaching empty states ("No exams yet —
  Upload a file or Build a quiz").
- **Staff link on the content page:** `/{course}/archive` renders a prominent
  staff-only "＋ Manage this archive →" banner → `/instructor/archive?course=<slug>`.
- The `/instructor` hub "Archive content" card copy updated to name videos +
  exams + assignments.

## Lesson-connected videos (Phase 2a)

- `src/lib/archive/db.ts` gains `fetchArchiveVideosForLesson(course,
  lessonSlug)` (published, non-deleted, `lesson_slug` match; service-role;
  degrades to `[]`).
- The lesson page (`src/pages/lessons/[...slug].astro` / its layout) renders a
  **"Lecture videos"** section ONLY when `canViewCourse(course)` is true
  (enrolled students + staff). Inline YouTube/Vimeo embeds (same embed helper
  as `ArchiveBrowser`). Guests / non-enrolled never see the section.
- For staff, a **"＋ Add a video for this lesson →"** link →
  `/instructor/archive?course=<c>&lesson=<slug>`.
- The hub's add-video form reads `?course=` and `?lesson=` query params and
  preselects them (single create path, deep-linked + prefilled — no duplicate
  inline upload form).

## Instructor hub + builder (Phase 2b for the builder)

- **File upload** (2a): multipart `<form>` → `POST
  /api/instructor/archive/paper/create` — validate `content_type ∈ {pdf,
  docx}` + `size ≤ 25 MB`, sanitize filename, upload to Storage, insert row;
  if the row insert fails, delete the just-uploaded object (no orphan).
  `paper/{update,delete}` mirror the video handlers (soft-delete; file
  retained).
- **Quiz builder** (2b): `src/components/archive/ArchiveQuizBuilder.tsx` React
  island — add/remove questions; per-question type (MC/numeric/multi_select)
  with prompt, choices, answer key, explanation, points; quiz-level title,
  lessons (`covers`), semester, passing score. Submits assembled quiz JSON to
  `POST /api/instructor/archive/quiz/create`, which **re-validates with the
  existing `QuestionSchema`** server-side before inserting. `quiz/{update,delete}`
  for own rows (soft-delete).

## Access / security / errors

- Writes: `isContentManager` (instructor+admin; TA excluded) →
  `instructorOwnsCourse` (own course) → own-row (`created_by`, admins bypass).
  Service-role; RLS-locked tables. Error-redirect to the page (#16), not the
  API.
- Files private; signed URLs (1h) only inside gated paths; `storage_path` never
  client-side.
- Supabase/admin env missing → hub shows setup notice; archive + lesson read
  paths degrade to git-only (no throw, #5).
- Upload bad type/size → error-redirect, no orphan. Authored quiz invalid
  (bad answer index / <1 question / unknown lesson in covers) → server Zod
  rejection / error-redirect.
- Convention #17 holds for DB quizzes: `toPublicQuestions` strips before SSR;
  grading server-side only.

## Testing / verification

1. `node --test 'src/lib/**/*.test.ts'` — extend `build.test.ts` for paper +
   authored-quiz `ArchiveItem`s; unit-test `loadGradableQuiz` selection logic
   if alias-free (else integration via manual). `gradeQuiz` engine unchanged.
2. `npm run typecheck`, `npm run format`.
3. `npm run build` (placeholder env).
4. Re-run `supabase/schema.sql` in a scratch project; confirm RLS blocks
   direct reads; `schema-roundtrip` CI green for both new tables.
5. Manual matrix:
   - Discoverability: staff `/{course}/archive` → "Manage this archive" → hub
     sections → each Add control reachable.
   - File: instructor uploads a PDF → appears in archive as a download for an
     enrolled student → signed URL opens then expires; non-owner blocked; TA
     read-only.
   - Authored quiz: instructor builds a quiz → enrolled student takes it at
     `/practice/<id>` and is graded → answers absent from page source
     (convention #17) → guest hitting that id redirected to signin.
   - Lesson videos: enrolled student sees "Lecture videos" on `/lessons/<slug>`;
     guest does not; staff "add a video for this lesson" deep-links the hub
     prefilled.

## Phasing (one spec, two implementation plans)

- **Phase 2a — Files + discoverability + lesson-connected videos:**
  `archive_papers` + Storage + paper CRUD; `ArchiveItem.fileUrl` + island
  download UI; hub rework into sections + staff archive-page link + empty
  states; lesson-page video section (enrolled+staff) +
  `fetchArchiveVideosForLesson` + staff add-from-lesson deep link + hub
  add-video query-param prefill. Ships the full visibility win + file uploads.
- **Phase 2b — Interactive authoring:** `archive_quizzes` + `loadGradableQuiz`
  git-or-DB resolver wired into the viewer + grade API + `ArchiveQuizBuilder`
  island + quiz CRUD.

Phase 2a's plan is written first.

## Surface-area summary

- **New:** `archive_papers` + `archive_quizzes` tables + RLS (schema.sql);
  `archive-papers` Storage bucket; `src/lib/quiz/resolve.ts`;
  `ArchiveQuizBuilder.tsx`; instructor APIs under
  `src/pages/api/instructor/archive/{paper,quiz}/*`; `fetchArchiveVideosForLesson`
  in `db.ts`; lesson-page video section.
- **Modified:** `src/lib/archive/{types,build,load}.ts`;
  `src/components/archive/ArchiveBrowser.tsx` (file download rendering);
  `src/pages/practice/[slug].astro` + `src/pages/api/quiz/grade.ts` (resolver);
  `src/pages/instructor/archive/index.astro` (sections, prefill);
  `src/pages/{eco-1002,fin-3610}/archive.astro` (staff manage link);
  lesson page/layout; `database.types.ts`.
- **Unchanged:** TA workshop/roster access; git content; `gradeQuiz` engine;
  the existing video CRUD + ownership fixes.

---

## Addendum (2026-06-02): Audit logging for archive management

All archive **management** actions (create / update / delete of videos, file
papers, and authored quizzes) are recorded in the existing `audit_log` so they
appear in the admin viewer (`/admin`).

- Extend `DisclosureAction` in `src/lib/audit.ts` with `'manage_archive'`.
- In every archive mutation handler (video/paper/quiz × create/update/delete),
  call `logDisclosureSafe` (fail-open, matching roster export/import — an audit
  write must not block a trusted instructor's action) right before the success
  redirect, with: `actorId = user.id`, `actorRole = role`, `action =
  'manage_archive'`, `request` (for HMAC'd IP/UA), `targetResource` = a
  human-readable summary (the admin viewer shows `target_resource`), e.g.
  `"video create: <title> (eco-1002)"`, and `metadata = { resource:
  'video'|'paper'|'quiz', op: 'create'|'update'|'delete', id, course }`.
- `actorRole` is `'instructor' | 'admin'` here (TAs can't manage), which fits
  the `DisclosureContext.actorRole` type.
