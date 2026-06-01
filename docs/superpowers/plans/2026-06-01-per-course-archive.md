# Per-course Queryable Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-course archive pages (`/eco-1002/archive`, `/fin-3610/archive`), gated to enrolled students + staff, where users browse and keyword-search past exams/assignments (quiz JSON), lecture notes (lessons), and ECO-1002 lecture videos (YouTube/Vimeo embeds).

**Architecture:** Content-as-code. Extend the `quizzes` collection with `kind`/`semester`/`covers`; add a `videos` collection guarded to `eco-1002`. A pure, alias-free `src/lib/archive/` core (`buildArchiveItems` / `deriveFacets` / `filterItems`) is unit-tested with `node --test`. Two thin per-course pages enforce the enrollment+staff gate (reusing the `enrollments`-table query pattern from `workshops.astro`), then hand a metadata-only `ArchiveItem[]` to a React island that filters in-browser. No DB/RLS changes, no search index, no external calls.

**Tech Stack:** Astro 5 (SSR), React 19 islands, Zod content schemas, Tailwind, `node --test`.

**Spec:** `docs/superpowers/specs/2026-06-01-per-course-archive-design.md`

---

## File Structure

**Create:**
- `src/lib/archive/types.ts` — `ArchiveItem`, `ArchiveItemType`, facet/input interfaces (no imports; pure types).
- `src/lib/archive/build.ts` — `buildArchiveItems`, `deriveFacets`, `filterItems`, `semesterKey`, `semesterLabel` (alias-free; imports only `./types`).
- `src/lib/archive/build.test.ts` — `node --test` unit tests for the above.
- `src/lib/archive/load.ts` — `loadArchiveForCourse(course)`: reads collections, maps to plain inputs, calls `buildArchiveItems`/`deriveFacets`. Imports `astro:content` + `@lib`; NOT unit-tested (thin glue).
- `src/components/archive/ArchiveBrowser.tsx` — React island: facet chips + keyword box + inline video embed.
- `src/pages/eco-1002/archive.astro` — gated page (videos appear).
- `src/pages/fin-3610/archive.astro` — gated page (no videos, auto-omitted).
- `src/content/videos/eco-1002-sample-lecture.json` — one starter video (real template).
- `src/content/quizzes/eco-1002-sample-midterm.json` — one starter exam (real template).
- `src/content/quizzes/fin-3610-sample-assignment.json` — one starter assignment (tests FIN-without-videos).

**Modify:**
- `src/content/config.ts` — quizzes fields + `videos` collection + register.
- `src/pages/practice/index.astro` — list only `kind === 'practice'`.
- `src/pages/practice/[slug].astro` — gate `exam`/`assignment` to enrolled+staff.
- `src/pages/eco-1002/index.astro`, `src/pages/fin-3610/index.astro` — add an "Archive" link.

**Unchanged:** Supabase schema/RLS, `database.types.ts`, quiz grading engine, the 38 existing practice quizzes.

---

## Task 1: Extend content schemas

**Files:**
- Modify: `src/content/config.ts`

> Note: `config.ts` imports `astro:content`, so it is verified via `npx astro sync` + `npm run typecheck`, not `node --test`.

- [ ] **Step 1: Add `kind`/`semester`/`covers` to the quizzes schema**

In `src/content/config.ts`, inside the `quizzes` `z.object({...})` (currently ends after `passingScore` / `furtherReading`), add these fields and a cross-field refine. Define a reusable `semesterSchema` near the top (after `const courseEnum = ...`):

```ts
const semesterSchema = z.object({
  term: z.enum(['spring', 'summer', 'fall']),
  year: z.number().int(),
});
```

Then change the quizzes collection to:

```ts
const quizzes = defineCollection({
  type: 'data',
  schema: z
    .object({
      slug: z.string(),
      title: z.string(),
      course: courseEnum,
      lessonSlug: z.string().optional(),
      kind: z.enum(['practice', 'exam', 'assignment']).default('practice'),
      semester: semesterSchema.optional(),
      covers: z.array(z.string()).default([]),
      questions: z.array(QuestionSchema).min(1),
      passingScore: z.number().min(0).max(1).default(0.7),
      furtherReading: z
        .object({
          title: z.string(),
          url: z.string().url(),
          source: z.string(),
          date: z.string().optional(),
          why: z.string(),
        })
        .optional(),
    })
    .refine((d) => d.kind === 'practice' || d.semester !== undefined, {
      message: 'exam/assignment quizzes must declare a semester',
      path: ['semester'],
    }),
});
```

- [ ] **Step 2: Add the `videos` collection (ECO-only guard)**

After the `workshops` collection definition, add:

```ts
const videos = defineCollection({
  type: 'data',
  schema: z
    .object({
      slug: z.string(),
      title: z.string(),
      course: courseEnum,
      lessonSlug: z.string(),
      semester: semesterSchema,
      provider: z.enum(['youtube', 'vimeo']),
      videoId: z.string().min(1),
      description: z.string().optional(),
      durationMinutes: z.number().positive().optional(),
    })
    .refine((d) => d.course === 'eco-1002', {
      message: 'videos are only supported for eco-1002',
      path: ['course'],
    }),
});
```

- [ ] **Step 3: Register the `videos` collection**

Change the `collections` export:

```ts
export const collections = {
  lessons,
  quizzes,
  instructors,
  courses,
  workshops,
  videos,
};
```

- [ ] **Step 4: Verify schemas compile**

Run: `npx astro sync && npm run typecheck`
Expected: PASS, no errors. (`astro sync` regenerates content types including the new `videos` collection.)

- [ ] **Step 5: Commit**

```bash
git add src/content/config.ts
git commit -m "feat(archive): extend quizzes schema + add videos collection"
```

---

## Task 2: Archive item types + `buildArchiveItems`

**Files:**
- Create: `src/lib/archive/types.ts`
- Create: `src/lib/archive/build.ts`
- Test: `src/lib/archive/build.test.ts`

- [ ] **Step 1: Write the types**

Create `src/lib/archive/types.ts`:

```ts
export type ArchiveItemType = 'notes' | 'exam' | 'assignment' | 'video';

export interface Semester {
  term: 'spring' | 'summer' | 'fall';
  year: number;
}

export interface ArchiveItem {
  id: string;
  type: ArchiveItemType;
  title: string;
  course: string;
  href: string; // notes/exam/assignment link; '' for inline-embed videos
  lessonSlugs: string[]; // normalized 'course/slug' refs
  units: string[]; // unique unit names resolved from lessonSlugs
  semester: Semester | null;
  searchText: string; // lowercased haystack for keyword match
  provider?: 'youtube' | 'vimeo';
  videoId?: string;
}

// Plain inputs (decoupled from Astro CollectionEntry so build.ts is alias-free).
export interface LessonInput {
  id: string; // e.g. 'eco-1002/solow' or 'eco-1002/solow.mdx'
  course: string;
  title: string;
  unit: string;
  summary: string;
  tags: string[];
  draft: boolean;
}

export interface QuizInput {
  slug: string;
  course: string;
  title: string;
  kind: 'practice' | 'exam' | 'assignment';
  lessonSlug?: string;
  covers: string[];
  semester?: Semester | null;
}

export interface VideoInput {
  slug: string;
  course: string;
  title: string;
  lessonSlug: string;
  description?: string;
  provider: 'youtube' | 'vimeo';
  videoId: string;
  semester: Semester;
}

export interface LessonRef {
  slug: string; // normalized 'course/slug'
  title: string;
  unit: string;
}

export interface Facets {
  types: ArchiveItemType[];
  semesters: { key: string; label: string }[];
  units: string[];
  lessons: { slug: string; title: string }[];
}

export interface ArchiveFilters {
  type?: string | null;
  semester?: string | null; // semesterKey
  unit?: string | null;
  lesson?: string | null; // normalized lesson slug
  query?: string;
}
```

- [ ] **Step 2: Write the failing test for `buildArchiveItems`**

Create `src/lib/archive/build.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildArchiveItems } from './build.ts';
import type { LessonInput, QuizInput, VideoInput } from './types.ts';

const lessons: LessonInput[] = [
  {
    id: 'eco-1002/solow.mdx',
    course: 'eco-1002',
    title: 'The Solow Model',
    unit: 'Growth',
    summary: 'Capital accumulation and steady state.',
    tags: ['growth'],
    draft: false,
  },
  {
    id: 'eco-1002/draft-topic',
    course: 'eco-1002',
    title: 'Draft',
    unit: 'Growth',
    summary: 'x',
    tags: [],
    draft: true,
  },
  {
    id: 'fin-3610/bond-pricing-and-yield',
    course: 'fin-3610',
    title: 'Bonds',
    unit: 'Rates',
    summary: 'y',
    tags: [],
    draft: false,
  },
];

const quizzes: QuizInput[] = [
  {
    slug: 'eco-1002-practice',
    course: 'eco-1002',
    title: 'Practice',
    kind: 'practice',
    lessonSlug: 'eco-1002/solow',
    covers: [],
    semester: null,
  },
  {
    slug: 'eco-1002-midterm-f24',
    course: 'eco-1002',
    title: 'Midterm',
    kind: 'exam',
    covers: ['eco-1002/solow'],
    semester: { term: 'fall', year: 2024 },
  },
];

const videos: VideoInput[] = [
  {
    slug: 'eco-vid',
    course: 'eco-1002',
    title: 'Solow lecture',
    lessonSlug: 'eco-1002/solow',
    provider: 'youtube',
    videoId: 'abc123',
    semester: { term: 'spring', year: 2025 },
  },
];

test('notes come from non-draft lessons of the course', () => {
  const items = buildArchiveItems({
    lessons,
    quizzes,
    videos,
    course: 'eco-1002',
  });
  const notes = items.filter((i) => i.type === 'notes');
  assert.equal(notes.length, 1);
  assert.equal(notes[0].title, 'The Solow Model');
  assert.equal(notes[0].href, '/lessons/eco-1002/solow');
  assert.deepEqual(notes[0].units, ['Growth']);
  assert.equal(notes[0].semester, null);
});

test('practice quizzes are excluded; exams included with semester + units', () => {
  const items = buildArchiveItems({
    lessons,
    quizzes,
    videos,
    course: 'eco-1002',
  });
  assert.equal(
    items.some((i) => i.title === 'Practice'),
    false,
  );
  const exam = items.find((i) => i.type === 'exam');
  assert.ok(exam);
  assert.equal(exam.href, '/practice/eco-1002-midterm-f24');
  assert.deepEqual(exam.units, ['Growth']);
  assert.deepEqual(exam.semester, { term: 'fall', year: 2024 });
});

test('videos map with provider/videoId and empty href', () => {
  const items = buildArchiveItems({
    lessons,
    quizzes,
    videos,
    course: 'eco-1002',
  });
  const v = items.find((i) => i.type === 'video');
  assert.ok(v);
  assert.equal(v.provider, 'youtube');
  assert.equal(v.videoId, 'abc123');
  assert.equal(v.href, '');
  assert.deepEqual(v.units, ['Growth']);
});

test('a different course yields no videos and only its own items', () => {
  const items = buildArchiveItems({
    lessons,
    quizzes,
    videos,
    course: 'fin-3610',
  });
  assert.equal(
    items.some((i) => i.type === 'video'),
    false,
  );
  assert.equal(
    items.every((i) => i.course === 'fin-3610'),
    true,
  );
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test src/lib/archive/build.test.ts`
Expected: FAIL — cannot find module `./build.ts` (not created yet).

- [ ] **Step 4: Implement `buildArchiveItems`**

Create `src/lib/archive/build.ts`:

```ts
import type {
  ArchiveItem,
  LessonInput,
  QuizInput,
  VideoInput,
} from './types.ts';

/** Strip a trailing .md/.mdx so quiz `lessonSlug` and lesson `id` align. */
export function normalizeLessonSlug(slug: string): string {
  return slug.replace(/\.mdx?$/, '');
}

function unitsFor(
  slugs: string[],
  unitBySlug: Map<string, string>,
): string[] {
  const out: string[] = [];
  for (const s of slugs) {
    const u = unitBySlug.get(s);
    if (u && !out.includes(u)) out.push(u);
  }
  return out;
}

export function buildArchiveItems(input: {
  lessons: LessonInput[];
  quizzes: QuizInput[];
  videos: VideoInput[];
  course: string;
}): ArchiveItem[] {
  const { course } = input;
  const courseLessons = input.lessons.filter(
    (l) => l.course === course && !l.draft,
  );
  const unitBySlug = new Map<string, string>();
  for (const l of courseLessons) {
    unitBySlug.set(normalizeLessonSlug(l.id), l.unit);
  }

  const items: ArchiveItem[] = [];

  // Notes
  for (const l of courseLessons) {
    const slug = normalizeLessonSlug(l.id);
    items.push({
      id: `notes:${slug}`,
      type: 'notes',
      title: l.title,
      course,
      href: `/lessons/${slug}`,
      lessonSlugs: [slug],
      units: l.unit ? [l.unit] : [],
      semester: null,
      searchText: [l.title, l.summary, l.tags.join(' '), l.unit]
        .join(' ')
        .toLowerCase(),
    });
  }

  // Exams / assignments
  for (const q of input.quizzes) {
    if (q.course !== course) continue;
    if (q.kind === 'practice') continue;
    const lessonSlugs = (
      q.covers.length ? q.covers : q.lessonSlug ? [q.lessonSlug] : []
    ).map(normalizeLessonSlug);
    const units = unitsFor(lessonSlugs, unitBySlug);
    items.push({
      id: `${q.kind}:${q.slug}`,
      type: q.kind,
      title: q.title,
      course,
      href: `/practice/${q.slug}`,
      lessonSlugs,
      units,
      semester: q.semester ?? null,
      searchText: [q.title, units.join(' ')].join(' ').toLowerCase(),
    });
  }

  // Videos
  for (const v of input.videos) {
    if (v.course !== course) continue;
    const slug = normalizeLessonSlug(v.lessonSlug);
    const units = unitsFor([slug], unitBySlug);
    items.push({
      id: `video:${v.slug}`,
      type: 'video',
      title: v.title,
      course,
      href: '',
      lessonSlugs: [slug],
      units,
      semester: v.semester,
      provider: v.provider,
      videoId: v.videoId,
      searchText: [v.title, v.description ?? '', units.join(' ')]
        .join(' ')
        .toLowerCase(),
    });
  }

  return items;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test src/lib/archive/build.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/archive/types.ts src/lib/archive/build.ts src/lib/archive/build.test.ts
git commit -m "feat(archive): pure buildArchiveItems + types with unit tests"
```

---

## Task 3: `deriveFacets`

**Files:**
- Modify: `src/lib/archive/build.ts`
- Test: `src/lib/archive/build.test.ts`

- [ ] **Step 1: Append the failing test**

Add to `src/lib/archive/build.test.ts`:

```ts
import { deriveFacets, semesterKey, semesterLabel } from './build.ts';
import type { LessonRef } from './types.ts';

const lessonIndex: LessonRef[] = [
  { slug: 'eco-1002/solow', title: 'The Solow Model', unit: 'Growth' },
];

test('semesterKey / semesterLabel format correctly', () => {
  assert.equal(semesterKey({ term: 'fall', year: 2024 }), 'fall-2024');
  assert.equal(semesterKey(null), '');
  assert.equal(semesterLabel({ term: 'fall', year: 2024 }), 'Fall 2024');
});

test('deriveFacets sorts semesters newest-first and lists present types', () => {
  const items = buildArchiveItems({
    lessons,
    quizzes,
    videos,
    course: 'eco-1002',
  });
  const f = deriveFacets(items, lessonIndex);
  assert.deepEqual(f.types, ['notes', 'exam', 'video']);
  // spring 2025 is newer than fall 2024
  assert.deepEqual(
    f.semesters.map((s) => s.key),
    ['spring-2025', 'fall-2024'],
  );
  assert.deepEqual(f.units, ['Growth']);
  assert.deepEqual(f.lessons, [
    { slug: 'eco-1002/solow', title: 'The Solow Model' },
  ]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test src/lib/archive/build.test.ts`
Expected: FAIL — `deriveFacets`/`semesterKey`/`semesterLabel` not exported.

- [ ] **Step 3: Implement the facet helpers**

Append to `src/lib/archive/build.ts`:

```ts
import type { ArchiveItemType, Facets, LessonRef, Semester } from './types.ts';

const TYPE_ORDER: ArchiveItemType[] = ['notes', 'exam', 'assignment', 'video'];
const TERM_RANK: Record<Semester['term'], number> = {
  spring: 0,
  summer: 1,
  fall: 2,
};

export function semesterKey(s: Semester | null): string {
  return s ? `${s.term}-${s.year}` : '';
}

export function semesterLabel(s: Semester): string {
  const term = s.term.charAt(0).toUpperCase() + s.term.slice(1);
  return `${term} ${s.year}`;
}

export function deriveFacets(
  items: ArchiveItem[],
  lessonIndex: LessonRef[],
): Facets {
  const presentTypes = new Set(items.map((i) => i.type));
  const types = TYPE_ORDER.filter((t) => presentTypes.has(t));

  const semMap = new Map<string, Semester>();
  for (const i of items) {
    if (i.semester) semMap.set(semesterKey(i.semester), i.semester);
  }
  const semesters = [...semMap.values()]
    .sort((a, b) => b.year - a.year || TERM_RANK[b.term] - TERM_RANK[a.term])
    .map((s) => ({ key: semesterKey(s), label: semesterLabel(s) }));

  const units = [...new Set(items.flatMap((i) => i.units))].sort((a, b) =>
    a.localeCompare(b),
  );

  const referenced = new Set(items.flatMap((i) => i.lessonSlugs));
  const lessons = lessonIndex
    .filter((l) => referenced.has(l.slug))
    .map((l) => ({ slug: l.slug, title: l.title }))
    .sort((a, b) => a.title.localeCompare(b.title));

  return { types, semesters, units, lessons };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test src/lib/archive/build.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/archive/build.ts src/lib/archive/build.test.ts
git commit -m "feat(archive): deriveFacets + semester helpers"
```

---

## Task 4: `filterItems`

**Files:**
- Modify: `src/lib/archive/build.ts`
- Test: `src/lib/archive/build.test.ts`

- [ ] **Step 1: Append the failing test**

Add to `src/lib/archive/build.test.ts`:

```ts
import { filterItems } from './build.ts';

test('filterItems narrows by type, semester, unit, lesson, and query', () => {
  const items = buildArchiveItems({
    lessons,
    quizzes,
    videos,
    course: 'eco-1002',
  });

  assert.equal(filterItems(items, { type: 'video' }).length, 1);
  assert.equal(filterItems(items, { semester: 'fall-2024' }).length, 1);
  // notes have no semester -> excluded when a semester is selected
  assert.equal(
    filterItems(items, { semester: 'fall-2024' }).every(
      (i) => i.type !== 'notes',
    ),
    true,
  );
  assert.equal(filterItems(items, { unit: 'Growth' }).length, 3);
  assert.equal(
    filterItems(items, { lesson: 'eco-1002/solow' }).length,
    3,
  );
  // keyword: all tokens must appear in searchText
  assert.equal(filterItems(items, { query: 'solow lecture' }).length, 1);
  assert.equal(filterItems(items, { query: 'nonexistent' }).length, 0);
  // empty filters -> everything
  assert.equal(filterItems(items, {}).length, items.length);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test src/lib/archive/build.test.ts`
Expected: FAIL — `filterItems` not exported.

- [ ] **Step 3: Implement `filterItems`**

Append to `src/lib/archive/build.ts` (add `ArchiveFilters` to the type import from `./types`):

```ts
import type { ArchiveFilters } from './types.ts';

export function filterItems(
  items: ArchiveItem[],
  filters: ArchiveFilters,
): ArchiveItem[] {
  const tokens = (filters.query ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return items.filter((i) => {
    if (filters.type && i.type !== filters.type) return false;
    if (filters.semester && semesterKey(i.semester) !== filters.semester)
      return false;
    if (filters.unit && !i.units.includes(filters.unit)) return false;
    if (filters.lesson && !i.lessonSlugs.includes(filters.lesson))
      return false;
    if (tokens.length && !tokens.every((t) => i.searchText.includes(t)))
      return false;
    return true;
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test src/lib/archive/build.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Verify the whole pure suite still passes under the glob CLAUDE.md uses**

Run: `node --test 'src/lib/**/*.test.ts'`
Expected: PASS (all archive tests + any pre-existing tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/archive/build.ts src/lib/archive/build.test.ts
git commit -m "feat(archive): filterItems with facet + keyword logic"
```

---

## Task 5: Starter content fixtures

**Files:**
- Create: `src/content/videos/eco-1002-sample-lecture.json`
- Create: `src/content/quizzes/eco-1002-sample-midterm.json`
- Create: `src/content/quizzes/fin-3610-sample-assignment.json`

> These give the archive non-empty content so the render path is verifiable, and serve as copy-paste templates. `lessonSlug`/`covers` must reference real lessons. Replace/expand with real materials later.

- [ ] **Step 1: Create the sample video**

`src/content/videos/eco-1002-sample-lecture.json`:

```json
{
  "slug": "eco-1002-solow-fa24",
  "title": "Lecture: The Solow Growth Model (Fall 2024)",
  "course": "eco-1002",
  "lessonSlug": "eco-1002/solow",
  "semester": { "term": "fall", "year": 2024 },
  "provider": "youtube",
  "videoId": "dQw4w9WgXcQ",
  "description": "Walkthrough of capital accumulation and the steady state.",
  "durationMinutes": 48
}
```

- [ ] **Step 2: Create the sample exam (ECO)**

`src/content/quizzes/eco-1002-sample-midterm.json`:

```json
{
  "slug": "eco-1002-midterm-fa24",
  "title": "Midterm (Fall 2024)",
  "course": "eco-1002",
  "kind": "exam",
  "semester": { "term": "fall", "year": 2024 },
  "covers": ["eco-1002/solow", "eco-1002/phillips-curve"],
  "passingScore": 0.7,
  "questions": [
    {
      "type": "multiple_choice",
      "id": "q1",
      "prompt": "In the Solow model with no technological progress, the steady state is reached when:",
      "choices": [
        "Investment equals depreciation of the capital stock",
        "Saving falls to zero",
        "Output grows at the population growth rate plus a constant",
        "The marginal product of capital equals one"
      ],
      "correctIndex": 0,
      "explanation": "At steady state, gross investment just replaces depreciated capital, so capital per worker is constant.",
      "points": 1
    }
  ]
}
```

- [ ] **Step 3: Create the sample assignment (FIN — exercises FIN-without-videos)**

`src/content/quizzes/fin-3610-sample-assignment.json`:

```json
{
  "slug": "fin-3610-ps1-sp25",
  "title": "Problem Set 1 (Spring 2025)",
  "course": "fin-3610",
  "kind": "assignment",
  "semester": { "term": "spring", "year": 2025 },
  "covers": ["fin-3610/bond-pricing-and-yield"],
  "passingScore": 0.7,
  "questions": [
    {
      "type": "numeric",
      "id": "q1",
      "prompt": "A 1-year zero-coupon bond with face value 100 has a YTM of 5%. What is its price? (2 decimals)",
      "answer": 95.24,
      "tolerance": 0.05,
      "explanation": "Price = 100 / 1.05 = 95.24.",
      "points": 1
    }
  ]
}
```

- [ ] **Step 4: Verify content validates and builds**

Run: `npx astro sync && npm run typecheck`
Expected: PASS — the new JSON validates against the schemas from Task 1 (exam/assignment carry a semester; video is `eco-1002`).

- [ ] **Step 5: Commit**

```bash
git add src/content/videos/eco-1002-sample-lecture.json src/content/quizzes/eco-1002-sample-midterm.json src/content/quizzes/fin-3610-sample-assignment.json
git commit -m "feat(archive): starter video + exam + assignment fixtures"
```

---

## Task 6: Archive loader (`load.ts`)

**Files:**
- Create: `src/lib/archive/load.ts`

> Thin glue: imports `astro:content`; not unit-tested (its logic lives in the tested `build.ts`).

- [ ] **Step 1: Implement the loader**

Create `src/lib/archive/load.ts`:

```ts
import { getCollection } from 'astro:content';
import type { CourseSlug } from '@lib/courses';
import { buildArchiveItems, deriveFacets, normalizeLessonSlug } from './build';
import type {
  ArchiveItem,
  Facets,
  LessonInput,
  LessonRef,
  QuizInput,
  VideoInput,
} from './types';

export async function loadArchiveForCourse(
  course: CourseSlug,
): Promise<{ items: ArchiveItem[]; facets: Facets }> {
  const [lessonEntries, quizEntries, videoEntries] = await Promise.all([
    getCollection('lessons', (l) => l.data.course === course),
    getCollection('quizzes', (q) => q.data.course === course),
    getCollection('videos', (v) => v.data.course === course),
  ]);

  const lessons: LessonInput[] = lessonEntries.map((l) => ({
    id: l.id,
    course: l.data.course,
    title: l.data.title,
    unit: l.data.unit,
    summary: l.data.summary,
    tags: l.data.tags,
    draft: l.data.draft,
  }));

  const quizzes: QuizInput[] = quizEntries.map((q) => ({
    slug: q.data.slug,
    course: q.data.course,
    title: q.data.title,
    kind: q.data.kind,
    lessonSlug: q.data.lessonSlug,
    covers: q.data.covers,
    semester: q.data.semester ?? null,
  }));

  const videos: VideoInput[] = videoEntries.map((v) => ({
    slug: v.data.slug,
    course: v.data.course,
    title: v.data.title,
    lessonSlug: v.data.lessonSlug,
    description: v.data.description,
    provider: v.data.provider,
    videoId: v.data.videoId,
    semester: v.data.semester,
  }));

  const items = buildArchiveItems({ lessons, quizzes, videos, course });

  const lessonIndex: LessonRef[] = lessons
    .filter((l) => !l.draft)
    .map((l) => ({
      slug: normalizeLessonSlug(l.id),
      title: l.title,
      unit: l.unit,
    }));

  return { items, facets: deriveFacets(items, lessonIndex) };
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: PASS. (If `l.id` type mismatches, confirm the lessons collection `id` is a string in generated types; `astro sync` from Task 5 must have run.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/archive/load.ts
git commit -m "feat(archive): loadArchiveForCourse glue over collections"
```

---

## Task 7: `ArchiveBrowser` island

**Files:**
- Create: `src/components/archive/ArchiveBrowser.tsx`

> Verified via typecheck/build + manual dev (the repo has no React test harness; pure logic is already covered in `build.test.ts`).

- [ ] **Step 1: Implement the island**

Create `src/components/archive/ArchiveBrowser.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { filterItems } from '@lib/archive/build';
import type { ArchiveItem, ArchiveItemType, Facets } from '@lib/archive/types';

const TYPE_LABEL: Record<ArchiveItemType, string> = {
  notes: 'Lecture notes',
  exam: 'Exams',
  assignment: 'Assignments',
  video: 'Videos',
};

function embedSrc(item: ArchiveItem): string {
  if (item.provider === 'youtube')
    return `https://www.youtube-nocookie.com/embed/${item.videoId}`;
  return `https://player.vimeo.com/video/${item.videoId}`;
}

interface Props {
  items: ArchiveItem[];
  facets: Facets;
}

export default function ArchiveBrowser({ items, facets }: Props) {
  const [type, setType] = useState<string | null>(null);
  const [semester, setSemester] = useState<string | null>(null);
  const [unit, setUnit] = useState<string | null>(null);
  const [lesson, setLesson] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [openVideo, setOpenVideo] = useState<string | null>(null);

  const filtered = useMemo(
    () => filterItems(items, { type, semester, unit, lesson, query }),
    [items, type, semester, unit, lesson, query],
  );

  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${
      active
        ? 'border-accent bg-accent/10 font-medium text-accent'
        : 'border-slate-300 text-ink-muted hover:bg-slate-50'
    }`;

  return (
    <div className="mt-6">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery((e.target as HTMLInputElement).value)}
        placeholder="Search the archive…"
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        aria-label="Search the archive"
      />

      {/* Type facet */}
      <div
        className="mt-4 flex flex-wrap gap-2"
        role="group"
        aria-label="Filter by type"
      >
        <button
          type="button"
          className={pill(type === null)}
          onClick={() => setType(null)}
        >
          All types
        </button>
        {facets.types.map((t) => (
          <button
            key={t}
            type="button"
            className={pill(type === t)}
            onClick={() => setType(t)}
          >
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      {/* Dropdown facets */}
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        {facets.semesters.length > 0 && (
          <label className="flex items-center gap-2">
            <span className="text-ink-muted">Semester</span>
            <select
              className="rounded border border-slate-300 px-2 py-1"
              value={semester ?? ''}
              onChange={(e) =>
                setSemester((e.target as HTMLSelectElement).value || null)
              }
            >
              <option value="">All</option>
              {facets.semesters.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {facets.units.length > 0 && (
          <label className="flex items-center gap-2">
            <span className="text-ink-muted">Unit</span>
            <select
              className="rounded border border-slate-300 px-2 py-1"
              value={unit ?? ''}
              onChange={(e) =>
                setUnit((e.target as HTMLSelectElement).value || null)
              }
            >
              <option value="">All</option>
              {facets.units.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
        )}
        {facets.lessons.length > 0 && (
          <label className="flex items-center gap-2">
            <span className="text-ink-muted">Lesson</span>
            <select
              className="rounded border border-slate-300 px-2 py-1"
              value={lesson ?? ''}
              onChange={(e) =>
                setLesson((e.target as HTMLSelectElement).value || null)
              }
            >
              <option value="">All</option>
              {facets.lessons.map((l) => (
                <option key={l.slug} value={l.slug}>
                  {l.title}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <p className="mt-4 text-xs text-ink-muted">
        {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
      </p>

      <ul className="mt-2 space-y-3">
        {filtered.map((item) => (
          <li
            key={item.id}
            className="rounded border border-slate-200 p-4 hover:border-accent"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs uppercase tracking-wide text-ink-muted">
                {TYPE_LABEL[item.type]}
              </span>
              {item.semester && (
                <span className="text-xs text-ink-muted">
                  {item.semester.term.charAt(0).toUpperCase() +
                    item.semester.term.slice(1)}{' '}
                  {item.semester.year}
                </span>
              )}
            </div>

            {item.type === 'video' ? (
              <>
                <button
                  type="button"
                  className="mt-1 text-left font-medium text-accent underline"
                  onClick={() =>
                    setOpenVideo(openVideo === item.id ? null : item.id)
                  }
                >
                  {item.title}
                </button>
                {openVideo === item.id && (
                  <div className="mt-3 aspect-video w-full">
                    <iframe
                      className="h-full w-full rounded"
                      src={embedSrc(item)}
                      title={item.title}
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}
              </>
            ) : (
              <a
                href={item.href}
                className="mt-1 block font-medium hover:text-accent"
              >
                {item.title}
              </a>
            )}
          </li>
        ))}
      </ul>

      {filtered.length === 0 && (
        <p className="mt-6 text-ink-muted">No matching materials yet.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: PASS. (This repo's React islands use `className` — confirmed against `src/components/quiz/Quiz.tsx`.)

- [ ] **Step 3: Commit**

```bash
git add src/components/archive/ArchiveBrowser.tsx
git commit -m "feat(archive): ArchiveBrowser island with facets + inline video"
```

---

## Task 8: Per-course archive pages (gated)

**Files:**
- Create: `src/pages/eco-1002/archive.astro`
- Create: `src/pages/fin-3610/archive.astro`

- [ ] **Step 1: Create the ECO archive page**

Create `src/pages/eco-1002/archive.astro`:

```astro
---
import BaseLayout from '@layouts/BaseLayout.astro';
import ArchiveBrowser from '@components/archive/ArchiveBrowser';
import { loadArchiveForCourse } from '@lib/archive/load';
import { isStaff } from '@lib/roles';

const COURSE = 'eco-1002' as const;
const user = Astro.locals.user;
const supabase = Astro.locals.supabase;

// Gate: guests -> signin; signed-in-not-enrolled-not-staff -> notice;
// enrolled or staff -> archive. Mirrors workshops/[slug].astro but uses
// isStaff (instructor/ta/admin), per CLAUDE.md convention #12.
if (!user) {
  return Astro.redirect(`/auth/signin?next=${Astro.url.pathname}`);
}
const staff = isStaff(Astro.locals.profile?.role);
let enrolled = false;
if (supabase) {
  const { data } = await supabase
    .from('enrollments')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('course_slug', COURSE)
    .maybeSingle();
  enrolled = !!data;
}
const canView = enrolled || staff;

const { items, facets } = canView
  ? await loadArchiveForCourse(COURSE)
  : { items: [], facets: { types: [], semesters: [], units: [], lessons: [] } };
---

<BaseLayout title="ECO 1002 — Archive">
  <div class="mx-auto max-w-3xl px-4 py-12">
    <p class="text-xs uppercase tracking-wide text-accent font-medium">
      ECO 1002
    </p>
    <h1 class="mt-1 text-3xl font-semibold tracking-tight">Course archive</h1>
    <p class="mt-3 text-ink-muted">
      Past exams and assignments, lecture notes, and lecture videos from prior
      semesters. Filter by type, semester, unit, or lesson, or search by
      keyword.
    </p>

    {
      !canView ? (
        <div class="mt-8 rounded border border-amber-300 bg-amber-50 p-4 text-sm">
          <p class="font-medium">You're not enrolled in ECO 1002.</p>
          <p class="mt-1 text-ink-muted">
            The course archive is available to enrolled students. Ask your
            instructor to add you to the roster.
          </p>
        </div>
      ) : (
        <ArchiveBrowser client:load items={items} facets={facets} />
      )
    }
  </div>
</BaseLayout>
```

- [ ] **Step 2: Create the FIN archive page**

Create `src/pages/fin-3610/archive.astro` — identical except `COURSE`, title, and copy:

```astro
---
import BaseLayout from '@layouts/BaseLayout.astro';
import ArchiveBrowser from '@components/archive/ArchiveBrowser';
import { loadArchiveForCourse } from '@lib/archive/load';
import { isStaff } from '@lib/roles';

const COURSE = 'fin-3610' as const;
const user = Astro.locals.user;
const supabase = Astro.locals.supabase;

if (!user) {
  return Astro.redirect(`/auth/signin?next=${Astro.url.pathname}`);
}
const staff = isStaff(Astro.locals.profile?.role);
let enrolled = false;
if (supabase) {
  const { data } = await supabase
    .from('enrollments')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('course_slug', COURSE)
    .maybeSingle();
  enrolled = !!data;
}
const canView = enrolled || staff;

const { items, facets } = canView
  ? await loadArchiveForCourse(COURSE)
  : { items: [], facets: { types: [], semesters: [], units: [], lessons: [] } };
---

<BaseLayout title="FIN 3610 — Archive">
  <div class="mx-auto max-w-3xl px-4 py-12">
    <p class="text-xs uppercase tracking-wide text-accent font-medium">
      FIN 3610
    </p>
    <h1 class="mt-1 text-3xl font-semibold tracking-tight">Course archive</h1>
    <p class="mt-3 text-ink-muted">
      Past exams and assignments and lecture notes from prior semesters. Filter
      by type, semester, unit, or lesson, or search by keyword.
    </p>

    {
      !canView ? (
        <div class="mt-8 rounded border border-amber-300 bg-amber-50 p-4 text-sm">
          <p class="font-medium">You're not enrolled in FIN 3610.</p>
          <p class="mt-1 text-ink-muted">
            The course archive is available to enrolled students. Ask your
            instructor to add you to the roster.
          </p>
        </div>
      ) : (
        <ArchiveBrowser client:load items={items} facets={facets} />
      )
    }
  </div>
</BaseLayout>
```

- [ ] **Step 3: Verify build**

Run:
```bash
PUBLIC_SUPABASE_URL=https://placeholder.supabase.co \
PUBLIC_SUPABASE_ANON_KEY=placeholder \
PUBLIC_SITE_URL=http://localhost:4321 \
npm run build
```
Expected: PASS — both `/eco-1002/archive` and `/fin-3610/archive` compile.

- [ ] **Step 4: Commit**

```bash
git add src/pages/eco-1002/archive.astro src/pages/fin-3610/archive.astro
git commit -m "feat(archive): gated per-course archive pages"
```

---

## Task 9: Gate `/practice/[slug]` by kind + filter `/practice` index

**Files:**
- Modify: `src/pages/practice/[slug].astro`
- Modify: `src/pages/practice/index.astro:24-28`

- [ ] **Step 1: Gate non-practice kinds in the quiz viewer**

In `src/pages/practice/[slug].astro`, add imports and a gate after `const quiz = entry.data;`. Replace the frontmatter block:

```astro
---
import BaseLayout from '@layouts/BaseLayout.astro';
import Quiz from '@components/quiz/Quiz';
import FurtherReadingCard from '@components/lesson/FurtherReadingCard.astro';
import { getEntry } from 'astro:content';
import { toPublicQuestions } from '@lib/quiz/public';
import { isStaff } from '@lib/roles';

const { slug } = Astro.params;
if (!slug) {
  return new Response(null, { status: 404 });
}
const entry = await getEntry('quizzes', slug);
if (!entry) {
  return new Response(null, { status: 404 });
}
const quiz = entry.data;

// Practice quizzes stay public. Archive papers (exam/assignment) are
// gated to enrolled students + staff so they can't be reached by
// guessing a slug.
if (quiz.kind !== 'practice') {
  const user = Astro.locals.user;
  const supabase = Astro.locals.supabase;
  if (!user) {
    return Astro.redirect(`/auth/signin?next=${Astro.url.pathname}`);
  }
  const staff = isStaff(Astro.locals.profile?.role);
  let enrolled = false;
  if (supabase) {
    const { data } = await supabase
      .from('enrollments')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('course_slug', quiz.course)
      .maybeSingle();
    enrolled = !!data;
  }
  if (!enrolled && !staff) {
    return Astro.redirect(`/${quiz.course}/archive`);
  }
}
---
```

(Leave the `<BaseLayout>…</BaseLayout>` body unchanged. Optionally change the eyebrow label `Practice · {quiz.course}` to `{quiz.kind === 'practice' ? 'Practice' : quiz.kind === 'exam' ? 'Exam' : 'Assignment'} · {quiz.course}`.)

- [ ] **Step 2: Filter the practice index to practice kind**

In `src/pages/practice/index.astro`, the grouping loop (around lines 23-28) currently pushes every quiz. Restrict it:

```ts
// Group quizzes by course (practice kind only; exams/assignments live
// in each course's gated archive).
const byCourse = new Map<string, typeof quizzes>();
for (const q of quizzes) {
  if (q.data.kind !== 'practice') continue;
  const arr = byCourse.get(q.data.course) ?? [];
  arr.push(q);
  byCourse.set(q.data.course, arr);
}
```

Also change `const totalQuizzes = quizzes.length;` to count only practice:

```ts
const totalQuizzes = quizzes.filter((q) => q.data.kind === 'practice').length;
```

- [ ] **Step 3: Verify build**

Run:
```bash
PUBLIC_SUPABASE_URL=https://placeholder.supabase.co \
PUBLIC_SUPABASE_ANON_KEY=placeholder \
PUBLIC_SITE_URL=http://localhost:4321 \
npm run build
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/pages/practice/[slug].astro src/pages/practice/index.astro
git commit -m "feat(archive): gate exam/assignment quizzes, hide them from /practice"
```

---

## Task 10: Add Archive nav links on course landing pages

**Files:**
- Modify: `src/pages/eco-1002/index.astro:84-88` (the "Meet your instructors" link block)
- Modify: `src/pages/fin-3610/index.astro` (the analogous link block)

- [ ] **Step 1: Add the ECO link**

In `src/pages/eco-1002/index.astro`, next to the existing instructors link:

```astro
    <p class="mt-4 text-sm">
      <a href="/eco-1002/instructors" class="text-accent underline">
        Meet your instructors →
      </a>
      <span class="mx-2 text-ink-muted">·</span>
      <a href="/eco-1002/archive" class="text-accent underline">
        Course archive →
      </a>
    </p>
```

- [ ] **Step 2: Add the FIN link**

In `src/pages/fin-3610/index.astro`, find the analogous instructors link (grep: `grep -n "instructors" src/pages/fin-3610/index.astro`) and add the same `· Course archive →` link pointing at `/fin-3610/archive`. If the FIN page has no instructors link, add a standalone paragraph:

```astro
    <p class="mt-4 text-sm">
      <a href="/fin-3610/archive" class="text-accent underline">
        Course archive →
      </a>
    </p>
```

- [ ] **Step 3: Verify build**

Run:
```bash
PUBLIC_SUPABASE_URL=https://placeholder.supabase.co \
PUBLIC_SUPABASE_ANON_KEY=placeholder \
PUBLIC_SITE_URL=http://localhost:4321 \
npm run build
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/pages/eco-1002/index.astro src/pages/fin-3610/index.astro
git commit -m "feat(archive): link to course archive from landing pages"
```

---

## Task 11: Full verification + manual matrix

**Files:** none (verification only)

- [ ] **Step 1: Pure tests**

Run: `node --test 'src/lib/**/*.test.ts'`
Expected: PASS (all archive tests + any pre-existing).

- [ ] **Step 2: Typecheck + format**

Run: `npm run typecheck && npm run format`
Expected: typecheck PASS; format touches only files changed in this branch.

- [ ] **Step 3: Build**

Run:
```bash
PUBLIC_SUPABASE_URL=https://placeholder.supabase.co \
PUBLIC_SUPABASE_ANON_KEY=placeholder \
PUBLIC_SITE_URL=http://localhost:4321 \
npm run build
```
Expected: PASS.

- [ ] **Step 4: Manual dev matrix**

Run: `npm run dev`, then verify against a local Supabase per CLAUDE.md "Bootstrap a fresh Supabase project":
  - **Guest** hits `/eco-1002/archive` → redirected to `/auth/signin?next=/eco-1002/archive`.
  - **Signed-in, not enrolled, not staff** → sees the amber "not enrolled" notice, no items.
  - **Enrolled student** → sees items; type/semester/unit/lesson facets + keyword search filter live; a video tile expands to an inline iframe.
  - **Staff** (instructor/ta/admin) → sees the archive without enrollment.
  - `/fin-3610/archive` shows no "Videos" type chip (no FIN videos exist).
  - **Guest** hits `/practice/eco-1002-midterm-fa24` directly → redirected to signin; after signin without enrollment → redirected to `/eco-1002/archive`.
  - `/practice` index no longer lists `Midterm (Fall 2024)` / `Problem Set 1 (Spring 2025)`.

- [ ] **Step 5: Final review before PR**

Confirm `git status` is clean and the branch contains only intended files (no `.astro/`, `.vercel/`, `dist/` per CLAUDE.md #8). Then the branch is ready for a PR titled `feat(archive): per-course queryable archive of exams, assignments, notes, videos`.

---

## Self-Review (completed during authoring)

- **Spec coverage:** schemas (T1), pure core build/facets/filter (T2-4), ECO-only video guard (T1 schema refine + auto-facet omission for FIN), starter content (T5), loader (T6), island with inline video (T7), gated per-course pages with enrolled+staff via `isStaff` (T8), `/practice` kind-gating + index filter (T9), nav (T10), verification incl. the gate matrix and convention #17 (T11). All spec sections map to a task.
- **Placeholder scan:** no TBD/TODO; every code step shows complete code.
- **Type consistency:** `ArchiveItem`/`Facets`/`ArchiveFilters` defined in T2 and used identically in T3-T8; `semesterKey`/`semesterLabel`/`filterItems`/`deriveFacets`/`buildArchiveItems`/`normalizeLessonSlug` signatures stable across loader, island, and tests.
- **Convention checks:** answers never reach client (`ArchiveItem` is metadata-only; quizzes still go through `toPublicQuestions`); pure logic alias-free + `node --test` (build.ts); `isStaff` not inline (#12); content-as-code (#1); no DB/RLS change.
