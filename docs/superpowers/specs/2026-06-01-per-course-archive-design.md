# Per-course queryable archive (past exams, assignments, notes, videos)

**Date:** 2026-06-01
**Status:** Approved (brainstorming → ready for implementation plan)
**Course scope:** `eco-1002`, `fin-3610` (videos: `eco-1002` only)

## Goal

Give enrolled students (and staff) a per-course archive of prior-semester
materials they can query by facets and keyword:

- **Past exams & assignments** — interactive, server-graded quiz JSON.
- **Lecture notes** — the existing `lessons` collection, surfaced as-is.
- **Lecture videos** — YouTube/Vimeo embeds, **ECO 1002 only**.

"Query" means **faceted browse + keyword search** (course, semester, type,
unit, lesson, plus a keyword box). No AI/RAG, no search index, no external
calls.

## Non-goals

- No AI/natural-language query, no embeddings/vector store.
- No build-time full-text search index (Pagefind/FlexSearch) — a static index
  would expose enrolled-only content to guests, conflicting with the access
  tier. Ruled out.
- No DB-backed archive / query API — keeps content-as-code (convention #1). No
  new Supabase tables, RLS, or `database.types.ts` regen.
- No per-semester snapshots of lessons; notes are evergreen.
- No video hosting/storage; embeds only.

## Decisions (from interview)

| Dimension | Decision |
|---|---|
| Query mechanism | Faceted browse + keyword search (no AI) |
| Layout | Per-course pages: `/eco-1002/archive`, `/fin-3610/archive` |
| Access | Enrolled students + staff (`isStaff`, convention #12) |
| Exam/assignment format | Interactive quiz JSON (reuse server-graded engine) |
| Video hosting | YouTube/Vimeo embeds, ECO 1002 only |
| Semester | Structured `{ term: spring/summer/fall, year: number }` |
| Topic facet | By unit + by lesson |
| Video viewer | Inline embed within the gated archive page |
| Exam/assignment viewer | Reuse `/practice/[slug]`, made `kind`-aware/gated |

## Content model (data, no DB changes)

### Extend `quizzes` collection (`src/content/config.ts`)

Backward-compatible — every new field defaults, so the 38 existing quizzes are
untouched and remain `kind: 'practice'`:

```ts
kind: z.enum(['practice', 'exam', 'assignment']).default('practice'),
semester: z
  .object({
    term: z.enum(['spring', 'summer', 'fall']),
    year: z.number().int(),
  })
  .optional(),
covers: z.array(z.string()).default([]), // lesson slugs an exam/assignment spans
```

Add a schema `.refine`: when `kind !== 'practice'`, `semester` is **required**
(authoring an exam without a semester is a build-time Zod error).

### New `videos` collection (`type: 'data'`)

```ts
slug: z.string(),
title: z.string(),
course: courseEnum,            // only eco-1002 authored in practice
lessonSlug: z.string(),        // the topic/lesson it covers (drives unit+lesson facet)
semester: z.object({ term: ..., year: ... }),  // required
provider: z.enum(['youtube', 'vimeo']),
videoId: z.string().min(1),    // embed id, NOT a full URL
description: z.string().optional(),
durationMinutes: z.number().positive().optional(),
```

Register `videos` in the exported `collections` object.

**ECO-only enforcement:** the FIN archive page renders no video facet/section.
Display is controlled by a course capability flag (e.g. `hasVideos` derived for
`eco-1002`) rather than hard-coding, so it is not brittle. Open option to be
confirmed during implementation: add a stricter schema
`.refine(d => d.course === 'eco-1002')` to reject non-ECO videos at build time.

### Lecture notes

The existing `lessons` collection, surfaced unchanged. Evergreen, **no semester
tag**; the semester facet applies only to exams/assignments/videos.

## Pure, testable core (`src/lib/archive/`)

Alias-free (CLAUDE.md "Verifying" #3 — `node --test` strips TS types but does
not resolve `@lib/*`).

- **`types.ts`** — `ArchiveItem`:
  ```ts
  type ArchiveItemType = 'notes' | 'exam' | 'assignment' | 'video';
  interface ArchiveItem {
    id: string;
    type: ArchiveItemType;
    title: string;
    course: string;
    href: string;                 // notes -> lesson page; exam/assignment -> quiz viewer; video -> '' (inline)
    lessonSlugs: string[];        // notes/video: 1; exam/assignment: covers[]
    units: string[];              // unique units resolved from lessonSlugs
    semester: { term: string; year: number } | null;
    searchText: string;           // lowercased title + summary/description + tags + unit, for keyword match
    provider?: 'youtube' | 'vimeo';
    videoId?: string;
  }
  ```
  **Carries metadata only — never questions/answers.** Safe to pass to a client
  island; convention #17 (answers never reach the client) preserved.

- **`build.ts`** — pure functions:
  - `buildArchiveItems({ lessons, quizzes, videos, course })` → `ArchiveItem[]`
    - notes from non-draft lessons matching `course`
    - exam/assignment from quizzes where `kind ∈ {exam, assignment}` and `course`
    - video from videos matching `course`
    - resolves `units` by joining each `lessonSlug` to its lesson's `unit`
  - `deriveFacets(items)` → `{ types, semesters (newest-first), units, lessons }`
  - `filterItems(items, { type, semester, unit, lesson, query })` → filtered list
    (shared by the client island for instant interaction)

- **`build.test.ts`** — source mapping per type; draft exclusion;
  FIN-yields-no-videos; semester newest-first sort; each filter dimension and
  combinations; empty-result handling.

## Pages & routing

Mirrors the per-course `workshops.astro` convention (two thin files, not a
dynamic `[course]` route).

- **`src/pages/eco-1002/archive.astro`**, **`src/pages/fin-3610/archive.astro`**
  — thin pages delegating to a shared loader in `src/lib/archive/` + a shared
  `ArchiveBrowser` island. FIN omits videos.

- **Access gate** (frontmatter), reusing the `enrollments`-table query pattern
  from `src/pages/eco-1002/workshops.astro`, but with `isStaff` (convention
  #12):
  - guest (no user) → redirect `/auth/signin?next=<this path>`
  - signed-in but not enrolled and not staff → "not enrolled in this course"
    notice (mirrors `/workshops/[slug].astro` semantics)
  - enrolled **or** staff → full archive

- **`src/components/archive/ArchiveBrowser.tsx`** (React island, `client:load`)
  — receives full `ArchiveItem[]` + facets as props; renders facet chips (type,
  semester, unit, lesson) + keyword box; filters in-browser via the shared
  `filterItems`. Videos embed **inline** (iframe appears on click) since the
  page is already gated. Notes link to the existing lesson page;
  exams/assignments link to the quiz viewer.

- **Quiz viewer gating:** `/practice/[slug].astro` becomes `kind`-aware —
  `practice` stays public (today's behavior); `exam`/`assignment` require
  enrolled+staff (else redirect), so an exam cannot be reached by guessing its
  slug. The `/practice` index is filtered to `kind === 'practice'` so archive
  papers do not leak into the public practice list.

- **Navigation:** add an "Archive" link/card on each course landing page
  (`/eco-1002`, `/fin-3610`).

## Data flow

```
getCollection(lessons | quizzes | videos)
  -> buildArchiveItems()        [server, src/lib/archive]
  -> SSR page shell + <ArchiveBrowser items=... facets=... />
  -> client filters instantly via filterItems()
```

No API route, no search index, no Supabase schema change, no external calls.

## Error / edge handling

- Supabase null (no `.env`) → viewer treated as guest → signin redirect
  (convention #5; no hard throw).
- Empty corpus or empty filter result → friendly empty states
  ("No Fall 2024 exams yet").
- Bad/empty video id → caught by schema (`provider` enum + non-empty `videoId`);
  a stale id simply fails to embed.
- `kind: exam|assignment` authored without `semester` → build-time Zod error.

## Testing / verification

1. `node --test 'src/lib/archive/*.test.ts'` — pure logic.
2. `npm run typecheck`.
3. `npm run format`.
4. `npm run build` (with placeholder Supabase env per CLAUDE.md).
5. `npm run dev` — exercise both archives as: enrolled student (sees archive),
   guest (redirected to signin), signed-in-not-enrolled (notice), staff (sees
   archive); verify a `kind: exam` quiz 404s/redirects for a guest hitting
   `/practice/<exam-slug>` directly and that `/practice` index hides it.

## Surface-area changes summary

- **New:** `videos` collection; `src/lib/archive/{types,build,build.test}.ts`;
  `src/components/archive/ArchiveBrowser.tsx`; `src/pages/{eco-1002,fin-3610}/archive.astro`.
- **Modified:** `src/content/config.ts` (quizzes fields + `videos` collection);
  `src/pages/practice/index.astro` (filter to practice kind);
  `src/pages/practice/[slug].astro` (kind-aware gating); course landing pages
  (Archive link).
- **Unchanged:** Supabase schema/RLS, `database.types.ts`, quiz grading engine,
  the 38 existing practice quizzes.
