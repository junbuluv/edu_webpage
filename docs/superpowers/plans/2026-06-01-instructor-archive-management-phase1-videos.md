# Instructor Archive Management — Phase 1 (Videos) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let ECO 1002 instructors add/edit/hide/delete lecture videos through the browser; published videos appear in the gated archive alongside git content.

**Architecture:** New DB table `archive_videos` (RLS-locked; all access via the service-role admin client, gated app-side). The archive loader merges published, non-deleted DB videos with the existing git videos by mapping them to the existing pure `VideoInput`, so the tested pure core (`build.ts`) is unchanged. A new instructor hub (`/instructor/archive`) follows the workshop form-handler pattern (plain `<form>`, service-role write, `isContentManager` + course-ownership + own-row gate, error-redirect to the page).

**Tech Stack:** Astro 5 SSR, Supabase (Postgres + service-role admin client), Zod content collections (read-only here), `node --test` for pure logic.

**Spec:** `docs/superpowers/specs/2026-06-01-instructor-archive-management-design.md` (Phase 1 = Videos).

**Scope note:** Phase 2 (file papers + Supabase Storage) is a separate plan. This plan must not add Storage, `archive_papers`, or `ArchiveItem.fileUrl`.

---

## File Structure

**Create:**
- `src/lib/archive/db.ts` — service-role reads of `archive_videos` (server-only). Degrades to `[]` on error/missing env.
- `src/lib/instructor/archive-ownership.ts` — pure, alias-free `partitionByOwnership` (editable vs read-only).
- `src/lib/instructor/archive-ownership.test.ts` — `node --test`.
- `src/lib/instructor/archive-manage.ts` — service-role hub data loader (instructor's courses + their video rows).
- `src/pages/instructor/archive/index.astro` — hub list + add-video form.
- `src/pages/instructor/archive/video/[id].astro` — pre-filled edit form.
- `src/pages/api/instructor/archive/video/create.ts`
- `src/pages/api/instructor/archive/video/update.ts`
- `src/pages/api/instructor/archive/video/delete.ts`

**Modify:**
- `supabase/schema.sql` — add `archive_videos` table + indexes + RLS.
- `src/lib/supabase/database.types.ts` — add the `archive_videos` table block.
- `src/lib/roles.ts` — add `isContentManager`.
- `src/lib/roles.test.ts` — (create) test `isContentManager`.
- `src/lib/archive/access.ts` — add `instructorOwnsCourse`.
- `src/lib/archive/load.ts` — merge DB videos into the videos list.
- `src/pages/instructor/index.astro` — add an "Archive content" card.

**Unchanged:** `src/lib/archive/{types,build}.ts`, the read-only archive pages, `/practice` gating, the grade API.

---

## Task 1: `archive_videos` table + RLS + generated types

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `src/lib/supabase/database.types.ts`

> No live DB in this environment, so we verify via `npm run typecheck` (the hand-edited types must compile) and rely on the `schema-roundtrip` CI for the SQL. PR title must carry the `db:` tag.

- [ ] **Step 1: Add the table to `supabase/schema.sql`**

Append this block near the other content tables (e.g. after the `workshop_attendance` section). It is idempotent:

```sql
-- =========================================================================
-- archive_videos --- instructor-managed ECO 1002 lecture videos surfaced in
-- the course archive. RLS-locked: no anon/authenticated policies; all access
-- goes through the service-role admin client, gated in app code (the
-- instructor-data pattern, CLAUDE.md convention #6). No PII here.
-- =========================================================================
create table if not exists public.archive_videos (
  id uuid primary key default gen_random_uuid(),
  course_slug text not null,
  lesson_slug text not null,
  semester_term text not null,
  semester_year integer not null,
  title text not null,
  provider text not null,
  video_id text not null,
  description text,
  duration_minutes integer,
  created_by uuid not null references public.profiles(id) on delete restrict,
  published boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (course_slug = 'eco-1002'),
  check (semester_term in ('spring', 'summer', 'fall')),
  check (semester_year between 2020 and 2100),
  check (provider in ('youtube', 'vimeo'))
);

create index if not exists archive_videos_course_idx
  on public.archive_videos (course_slug);
create index if not exists archive_videos_live_idx
  on public.archive_videos (course_slug)
  where deleted_at is null and published;

alter table public.archive_videos enable row level security;
-- Intentionally NO policies: PostgREST/anon/authenticated cannot read or
-- write. The service-role admin client (which bypasses RLS) is the only
-- accessor, used server-side behind isContentManager + ownership checks.
```

- [ ] **Step 2: Add the table block to `database.types.ts`**

In `src/lib/supabase/database.types.ts`, inside `Database.public.Tables`, add an `archive_videos` block (place it alphabetically before `enrollments`). Use the exact shape of the existing blocks (Row/Insert/Update/`Relationships: []`):

```ts
      archive_videos: {
        Row: {
          id: string;
          course_slug: string;
          lesson_slug: string;
          semester_term: string;
          semester_year: number;
          title: string;
          provider: string;
          video_id: string;
          description: string | null;
          duration_minutes: number | null;
          created_by: string;
          published: boolean;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          course_slug: string;
          lesson_slug: string;
          semester_term: string;
          semester_year: number;
          title: string;
          provider: string;
          video_id: string;
          description?: string | null;
          duration_minutes?: number | null;
          created_by: string;
          published?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          course_slug?: string;
          lesson_slug?: string;
          semester_term?: string;
          semester_year?: number;
          title?: string;
          provider?: string;
          video_id?: string;
          description?: string | null;
          duration_minutes?: number | null;
          created_by?: string;
          published?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
```

- [ ] **Step 3: Verify types compile**

Run: `npm run typecheck`
Expected: 0 errors (the new table block is well-formed; nothing references it yet).

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql src/lib/supabase/database.types.ts
git commit -m "db(archive): add archive_videos table (RLS-locked) + generated types"
```

---

## Task 2: `isContentManager` role helper

**Files:**
- Modify: `src/lib/roles.ts`
- Test: `src/lib/roles.test.ts` (create)

> Archive writes are allowed for instructors + admins but NOT TAs (spec: TA read-only). `isStaff` includes TA, so we need a distinct predicate. Keep role logic in `@lib/roles` (convention #12).

- [ ] **Step 1: Write the failing test**

Create `src/lib/roles.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isContentManager } from './roles.ts';

test('isContentManager: instructor and admin can manage, ta and student cannot', () => {
  assert.equal(isContentManager('instructor'), true);
  assert.equal(isContentManager('admin'), true);
  assert.equal(isContentManager('ta'), false);
  assert.equal(isContentManager('student'), false);
  assert.equal(isContentManager(null), false);
  assert.equal(isContentManager(undefined), false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test src/lib/roles.test.ts`
Expected: FAIL — `isContentManager` not exported.

- [ ] **Step 3: Implement**

In `src/lib/roles.ts`, add after `isAdmin`:

```ts
const CONTENT_MANAGER_ROLES = new Set<UserRole>(['instructor', 'admin']);

/**
 * Who may create/edit/delete instructor-managed content (archive videos and
 * papers): instructors and admins, but NOT TAs (TAs are read-only here).
 * Distinct from isStaff, which includes 'ta'.
 */
export function isContentManager(role: UserRole | null | undefined): boolean {
  return role ? CONTENT_MANAGER_ROLES.has(role) : false;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test src/lib/roles.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/roles.ts src/lib/roles.test.ts
git commit -m "feat(roles): add isContentManager (instructor|admin, excludes ta)"
```

---

## Task 3: Pure ownership-partition helper

**Files:**
- Create: `src/lib/instructor/archive-ownership.ts`
- Test: `src/lib/instructor/archive-ownership.test.ts`

> Alias-free (`node --test`). Takes a precomputed `canEditAll` boolean so it never inlines role logic.

- [ ] **Step 1: Write the failing test**

Create `src/lib/instructor/archive-ownership.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partitionByOwnership } from './archive-ownership.ts';

const items = [
  { id: 'a', createdBy: 'u1' },
  { id: 'b', createdBy: 'u2' },
  { id: 'c', createdBy: 'u1' },
];

test('non-admin sees only own rows as editable', () => {
  const { editable, readOnly } = partitionByOwnership(items, {
    userId: 'u1',
    canEditAll: false,
  });
  assert.deepEqual(
    editable.map((i) => i.id),
    ['a', 'c'],
  );
  assert.deepEqual(
    readOnly.map((i) => i.id),
    ['b'],
  );
});

test('admin (canEditAll) sees everything editable', () => {
  const { editable, readOnly } = partitionByOwnership(items, {
    userId: 'whoever',
    canEditAll: true,
  });
  assert.equal(editable.length, 3);
  assert.equal(readOnly.length, 0);
});

test('empty input yields empty partitions', () => {
  const { editable, readOnly } = partitionByOwnership([], {
    userId: 'u1',
    canEditAll: false,
  });
  assert.deepEqual(editable, []);
  assert.deepEqual(readOnly, []);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test src/lib/instructor/archive-ownership.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/instructor/archive-ownership.ts`:

```ts
export interface OwnableItem {
  id: string;
  createdBy: string;
}

/**
 * Split items into those the viewer may edit/delete vs. read-only.
 * `canEditAll` (admins) is precomputed by the caller from the role so this
 * helper stays alias-free and unit-testable. A non-admin may edit only the
 * rows they created.
 */
export function partitionByOwnership<T extends OwnableItem>(
  items: T[],
  viewer: { userId: string; canEditAll: boolean },
): { editable: T[]; readOnly: T[] } {
  const editable: T[] = [];
  const readOnly: T[] = [];
  for (const item of items) {
    if (viewer.canEditAll || item.createdBy === viewer.userId) {
      editable.push(item);
    } else {
      readOnly.push(item);
    }
  }
  return { editable, readOnly };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test src/lib/instructor/archive-ownership.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/instructor/archive-ownership.ts src/lib/instructor/archive-ownership.test.ts
git commit -m "feat(archive): pure partitionByOwnership helper with tests"
```

---

## Task 4: `instructorOwnsCourse` access helper

**Files:**
- Modify: `src/lib/archive/access.ts`

> Server-only (uses the admin client). Not unit-tested (integration); verified by typecheck + manual. Mirrors the ownership check in `api/instructor/workshops/open.ts`.

- [ ] **Step 1: Add the helper**

Append to `src/lib/archive/access.ts` (add the two imports at the top of the file alongside the existing `isStaff` import):

```ts
import { getAdminClient } from '@lib/supabase/admin';
import { isAdmin } from '@lib/roles';

/**
 * True iff `userId` may manage content for `courseSlug`: an admin (any
 * course), or an instructor listed as instructor_id on some enrollment row
 * for that course. Uses the service-role admin client (enrollments are not
 * readable under a normal client for arbitrary users). Fails closed on
 * missing env / error.
 */
export async function instructorOwnsCourse(
  userId: string,
  courseSlug: string,
  role: string | null | undefined,
): Promise<boolean> {
  if (isAdmin(role as never)) return true;
  try {
    const admin = getAdminClient();
    const { data } = await admin
      .from('enrollments')
      .select('user_id')
      .eq('instructor_id', userId)
      .eq('course_slug', courseSlug)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}
```

The existing top import line is `import { isStaff } from '@lib/roles';` — change it to `import { isStaff, isAdmin } from '@lib/roles';` and add the `getAdminClient` import; do not duplicate.

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: 0 errors. (`access.ts` is only imported by server-side `.astro`/API files; importing the admin client here is safe.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/archive/access.ts
git commit -m "feat(archive): instructorOwnsCourse helper (admin client + ownership)"
```

---

## Task 5: `db.ts` — fetch published videos

**Files:**
- Create: `src/lib/archive/db.ts`

> Server-only (admin client). Degrades to `[]` on missing env / error (convention #5), so the archive read path never throws.

- [ ] **Step 1: Implement**

Create `src/lib/archive/db.ts`:

```ts
import { getAdminClient } from '@lib/supabase/admin';

export interface ArchiveVideoRow {
  id: string;
  course_slug: string;
  lesson_slug: string;
  semester_term: 'spring' | 'summer' | 'fall';
  semester_year: number;
  title: string;
  provider: 'youtube' | 'vimeo';
  video_id: string;
  description: string | null;
  created_by: string;
  published: boolean;
}

/**
 * Published, non-deleted instructor-managed videos for a course, read via the
 * service-role admin client. Returns [] if Supabase env is missing or the
 * query errors, so the archive read path degrades to git-only content.
 */
export async function fetchArchiveVideos(
  course: string,
): Promise<ArchiveVideoRow[]> {
  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('archive_videos')
      .select(
        'id, course_slug, lesson_slug, semester_term, semester_year, title, provider, video_id, description, created_by, published',
      )
      .eq('course_slug', course)
      .eq('published', true)
      .is('deleted_at', null);
    if (error) return [];
    return (data ?? []) as ArchiveVideoRow[];
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/archive/db.ts
git commit -m "feat(archive): db.ts fetchArchiveVideos (service-role, degrades safely)"
```

---

## Task 6: Merge DB videos into the loader

**Files:**
- Modify: `src/lib/archive/load.ts`

- [ ] **Step 1: Wire DB videos into `loadArchiveForCourse`**

In `src/lib/archive/load.ts`:

(a) Add the import near the other imports:
```ts
import { fetchArchiveVideos } from './db';
```

(b) Replace the `const videos: VideoInput[] = videoEntries.map(...)` block with a version that fetches DB videos and concatenates. The new block:

```ts
  const gitVideos: VideoInput[] = videoEntries.map((v) => ({
    slug: v.data.slug,
    course: v.data.course,
    title: v.data.title,
    lessonSlug: v.data.lessonSlug,
    description: v.data.description,
    provider: v.data.provider,
    videoId: v.data.videoId,
    semester: v.data.semester,
  }));

  const dbVideoRows = await fetchArchiveVideos(course);
  const dbVideos: VideoInput[] = dbVideoRows.map((r) => ({
    slug: r.id,
    course: r.course_slug,
    title: r.title,
    lessonSlug: r.lesson_slug,
    description: r.description ?? undefined,
    provider: r.provider,
    videoId: r.video_id,
    semester: { term: r.semester_term, year: r.semester_year },
  }));

  const videos: VideoInput[] = [...gitVideos, ...dbVideos];
```

Everything else (the `buildArchiveItems({ lessons, quizzes, videos, course })` call, `lessonIndex`, the return) is unchanged. DB videos flow through the existing pure pipeline; their `ArchiveItem` ids become `video:<uuid>` (unique vs git `video:<slug>`).

- [ ] **Step 2: Verify**

Run: `node --test 'src/lib/**/*.test.ts'` (still pass — build.ts untouched) and `npm run typecheck` (0 errors).

Then build:
```bash
PUBLIC_SUPABASE_URL=https://placeholder.supabase.co \
PUBLIC_SUPABASE_ANON_KEY=placeholder \
PUBLIC_SITE_URL=http://localhost:4321 \
npm run build
```
Expected: PASS. (With placeholder env, `getAdminClient` throws inside `fetchArchiveVideos` → caught → `[]`, so the archive renders git-only at build time.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/archive/load.ts
git commit -m "feat(archive): merge published DB videos into the archive loader"
```

---

## Task 7: Hub data loader `archive-manage.ts`

**Files:**
- Create: `src/lib/instructor/archive-manage.ts`

> Server-only (admin client + content collection). Returns the courses an instructor manages and the (non-deleted, published + hidden) video rows in those courses, shaped for the page.

- [ ] **Step 1: Implement**

Create `src/lib/instructor/archive-manage.ts`:

```ts
import { getCollection } from 'astro:content';
import { getAdminClient } from '@lib/supabase/admin';
import { isAdmin } from '@lib/roles';

export interface ManageVideo {
  id: string;
  courseSlug: string;
  title: string;
  lessonSlug: string;
  semesterTerm: string;
  semesterYear: number;
  provider: string;
  videoId: string;
  published: boolean;
  createdBy: string;
}

/**
 * Courses the viewer manages (admins: all; else enrollments where they are
 * instructor_id) plus the non-deleted video rows in those courses. Includes
 * hidden (unpublished) rows so instructors can re-publish them.
 */
export async function loadInstructorArchive(
  userId: string,
  role: string | null | undefined,
): Promise<{ courses: string[]; videos: ManageVideo[] }> {
  const admin = getAdminClient();

  let courses: string[];
  if (isAdmin(role as never)) {
    const all = await getCollection('courses');
    courses = all.map((c) => c.data.slug);
  } else {
    const { data: rows } = await admin
      .from('enrollments')
      .select('course_slug')
      .eq('instructor_id', userId);
    courses = [...new Set((rows ?? []).map((r) => r.course_slug))];
  }

  if (courses.length === 0) return { courses, videos: [] };

  const { data: vids } = await admin
    .from('archive_videos')
    .select(
      'id, course_slug, title, lesson_slug, semester_term, semester_year, provider, video_id, published, created_by',
    )
    .in('course_slug', courses)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const videos: ManageVideo[] = (vids ?? []).map((v) => ({
    id: v.id,
    courseSlug: v.course_slug,
    title: v.title,
    lessonSlug: v.lesson_slug,
    semesterTerm: v.semester_term,
    semesterYear: v.semester_year,
    provider: v.provider,
    videoId: v.video_id,
    published: v.published,
    createdBy: v.created_by,
  }));

  return { courses, videos };
}
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/instructor/archive-manage.ts
git commit -m "feat(archive): instructor hub data loader for videos"
```

---

## Task 8: Video CRUD APIs

**Files:**
- Create: `src/pages/api/instructor/archive/video/create.ts`
- Create: `src/pages/api/instructor/archive/video/update.ts`
- Create: `src/pages/api/instructor/archive/video/delete.ts`

> All three: parse formData, gate `isContentManager` (excludes TA) → `instructorOwnsCourse` → (for update/delete) own-row, write via service-role, error-redirect to `/instructor/archive` (convention #16). ECO-only and lesson-slug validation on create/update.

- [ ] **Step 1: create.ts**

Create `src/pages/api/instructor/archive/video/create.ts`:

```ts
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getAdminClient } from '@lib/supabase/admin';
import { isContentManager } from '@lib/roles';
import { instructorOwnsCourse } from '@lib/archive/access';
import { normalizeLessonSlug } from '@lib/archive/build';

const TERMS = new Set(['spring', 'summer', 'fall']);
const PROVIDERS = new Set(['youtube', 'vimeo']);

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
  const course = String(form.get('course_slug') ?? '');
  const lessonSlug = String(form.get('lesson_slug') ?? '');
  const term = String(form.get('semester_term') ?? '');
  const year = Number(form.get('semester_year') ?? NaN);
  const title = String(form.get('title') ?? '').trim();
  const provider = String(form.get('provider') ?? '');
  const videoId = String(form.get('video_id') ?? '').trim();
  const description = String(form.get('description') ?? '').trim() || null;
  const durationRaw = Number(form.get('duration_minutes') ?? NaN);
  const durationMinutes = Number.isFinite(durationRaw) && durationRaw > 0
    ? Math.floor(durationRaw)
    : null;

  if (!user) return err('unauthenticated');
  if (!isContentManager(role)) return err('forbidden');
  if (course !== 'eco-1002') return err('invalid_course');
  if (!(await instructorOwnsCourse(user.id, course, role)))
    return err('not_course_instructor');

  if (
    !title ||
    !videoId ||
    !TERMS.has(term) ||
    !PROVIDERS.has(provider) ||
    !Number.isInteger(year) ||
    year < 2020 ||
    year > 2100
  ) {
    return err('invalid_input');
  }

  // lesson_slug must be a real ECO 1002 lesson.
  const lessons = await getCollection('lessons', (l) => l.data.course === course);
  const validSlugs = new Set(lessons.map((l) => normalizeLessonSlug(l.id)));
  if (!validSlugs.has(lessonSlug)) return err('invalid_lesson');

  const admin = getAdminClient();
  const { error } = await admin.from('archive_videos').insert({
    course_slug: course,
    lesson_slug: lessonSlug,
    semester_term: term,
    semester_year: year,
    title,
    provider,
    video_id: videoId,
    description,
    duration_minutes: durationMinutes,
    created_by: user.id,
  });
  if (error) return err('insert_failed');

  return new Response(null, {
    status: 303,
    headers: { Location: `/instructor/archive?ok=created` },
  });
};
```

- [ ] **Step 2: update.ts**

Create `src/pages/api/instructor/archive/video/update.ts`:

```ts
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getAdminClient } from '@lib/supabase/admin';
import { isContentManager, isAdmin } from '@lib/roles';
import { instructorOwnsCourse } from '@lib/archive/access';
import { normalizeLessonSlug } from '@lib/archive/build';

const TERMS = new Set(['spring', 'summer', 'fall']);
const PROVIDERS = new Set(['youtube', 'vimeo']);

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
  const lessonSlug = String(form.get('lesson_slug') ?? '');
  const term = String(form.get('semester_term') ?? '');
  const year = Number(form.get('semester_year') ?? NaN);
  const title = String(form.get('title') ?? '').trim();
  const provider = String(form.get('provider') ?? '');
  const videoId = String(form.get('video_id') ?? '').trim();
  const description = String(form.get('description') ?? '').trim() || null;
  // Unchecked checkbox is absent from formData; presence => published.
  const published = form.get('published') != null;

  if (!user) return err('unauthenticated');
  if (!isContentManager(role)) return err('forbidden');
  if (!id) return err('invalid_input');

  const admin = getAdminClient();
  const { data: row } = await admin
    .from('archive_videos')
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
    !videoId ||
    !TERMS.has(term) ||
    !PROVIDERS.has(provider) ||
    !Number.isInteger(year) ||
    year < 2020 ||
    year > 2100
  ) {
    return err('invalid_input');
  }

  const lessons = await getCollection(
    'lessons',
    (l) => l.data.course === row.course_slug,
  );
  const validSlugs = new Set(lessons.map((l) => normalizeLessonSlug(l.id)));
  if (!validSlugs.has(lessonSlug)) return err('invalid_lesson');

  const { error } = await admin
    .from('archive_videos')
    .update({
      lesson_slug: lessonSlug,
      semester_term: term,
      semester_year: year,
      title,
      provider,
      video_id: videoId,
      description,
      published,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) return err('update_failed');

  return new Response(null, {
    status: 303,
    headers: { Location: `/instructor/archive?ok=updated` },
  });
};
```

- [ ] **Step 3: delete.ts**

Create `src/pages/api/instructor/archive/video/delete.ts`:

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
    .from('archive_videos')
    .select('course_slug, created_by')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!row) return err('not_found');

  if (!(await instructorOwnsCourse(user.id, row.course_slug, role)))
    return err('not_course_instructor');
  if (!isAdmin(role) && row.created_by !== user.id) return err('not_owner');

  const { error } = await admin
    .from('archive_videos')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return err('delete_failed');

  return new Response(null, {
    status: 303,
    headers: { Location: `/instructor/archive?ok=deleted` },
  });
};
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck` (0 errors) and `npm run format`.
Then build (placeholder env, as in Task 6, Step 2). Expected: PASS — the three API routes compile.

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/instructor/archive/video/create.ts src/pages/api/instructor/archive/video/update.ts src/pages/api/instructor/archive/video/delete.ts
git commit -m "feat(archive): instructor video create/update/delete APIs (gated)"
```

---

## Task 9: Instructor hub page + edit page

**Files:**
- Create: `src/pages/instructor/archive/index.astro`
- Create: `src/pages/instructor/archive/video/[id].astro`

> Viewable by staff (instructor/ta/admin); edit controls only for content managers (instructor/admin) on rows they own (admins: all). Lesson dropdown comes from the content collection.

- [ ] **Step 1: Create the hub page**

Create `src/pages/instructor/archive/index.astro`:

```astro
---
import BaseLayout from '@layouts/BaseLayout.astro';
import { getCollection } from 'astro:content';
import { isStaff, isAdmin, isContentManager } from '@lib/roles';
import { loadInstructorArchive } from '@lib/instructor/archive-manage';
import { partitionByOwnership } from '@lib/instructor/archive-ownership';
import { normalizeLessonSlug } from '@lib/archive/build';

const user = Astro.locals.user;
const role = Astro.locals.profile?.role ?? 'student';

if (!user) {
  return Astro.redirect(`/auth/signin?next=${encodeURIComponent(Astro.url.pathname)}`);
}
if (!isStaff(role)) {
  return Astro.redirect('/dashboard');
}

const { courses, videos } = await loadInstructorArchive(user.id, role);
const canManage = isContentManager(role);
const { editable, readOnly } = partitionByOwnership(
  videos.map((v) => ({ ...v, createdBy: v.createdBy })),
  { userId: user.id, canEditAll: isAdmin(role) },
);

// Only ECO 1002 supports videos; show the add form only if the viewer
// manages eco-1002.
const canAddVideo = canManage && courses.includes('eco-1002');
const ecoLessons = canAddVideo
  ? (await getCollection('lessons', (l) => l.data.course === 'eco-1002'))
      .map((l) => ({ slug: normalizeLessonSlug(l.id), title: l.data.title }))
      .sort((a, b) => a.title.localeCompare(b.title))
  : [];

const ok = Astro.url.searchParams.get('ok');
const error = Astro.url.searchParams.get('error');
---

<BaseLayout title="Archive content">
  <div class="mx-auto max-w-3xl px-4 py-12">
    <p class="text-xs uppercase tracking-wide text-accent font-medium">
      Instructor
    </p>
    <h1 class="mt-1 text-3xl font-semibold tracking-tight">Archive content</h1>
    <p class="mt-3 text-ink-muted">
      Add lecture videos (ECO 1002) to the course archive. Students enrolled in
      the course see published items. You can edit, hide, or remove the items
      you created.
    </p>

    {ok && (
      <p class="mt-6 rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">
        Saved ({ok}).
      </p>
    )}
    {error && (
      <p class="mt-6 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        Could not complete the action: {error}.
      </p>
    )}

    {!canManage && (
      <p class="mt-6 rounded border border-slate-200 bg-slate-50 p-3 text-sm text-ink-muted">
        You have read-only access. Only instructors and admins can add or edit
        archive content.
      </p>
    )}

    {canAddVideo && (
      <section class="mt-8 rounded-lg border border-slate-200 p-5">
        <h2 class="text-lg font-semibold">Add a video</h2>
        <form
          method="POST"
          action="/api/instructor/archive/video/create"
          class="mt-4 space-y-3 text-sm"
        >
          <input type="hidden" name="course_slug" value="eco-1002" />
          <label class="block">
            <span class="text-ink-muted">Title</span>
            <input name="title" required class="mt-1 w-full rounded border border-slate-300 px-2 py-1" />
          </label>
          <label class="block">
            <span class="text-ink-muted">Lesson</span>
            <select name="lesson_slug" required class="mt-1 w-full rounded border border-slate-300 px-2 py-1">
              {ecoLessons.map((l) => (
                <option value={l.slug}>{l.title}</option>
              ))}
            </select>
          </label>
          <div class="flex gap-3">
            <label class="block">
              <span class="text-ink-muted">Term</span>
              <select name="semester_term" required class="mt-1 rounded border border-slate-300 px-2 py-1">
                <option value="spring">Spring</option>
                <option value="summer">Summer</option>
                <option value="fall">Fall</option>
              </select>
            </label>
            <label class="block">
              <span class="text-ink-muted">Year</span>
              <input name="semester_year" type="number" min="2020" max="2100" required class="mt-1 w-28 rounded border border-slate-300 px-2 py-1" />
            </label>
          </div>
          <div class="flex gap-3">
            <label class="block">
              <span class="text-ink-muted">Provider</span>
              <select name="provider" required class="mt-1 rounded border border-slate-300 px-2 py-1">
                <option value="youtube">YouTube</option>
                <option value="vimeo">Vimeo</option>
              </select>
            </label>
            <label class="block flex-1">
              <span class="text-ink-muted">Video ID</span>
              <input name="video_id" required placeholder="e.g. dQw4w9WgXcQ" class="mt-1 w-full rounded border border-slate-300 px-2 py-1" />
            </label>
          </div>
          <label class="block">
            <span class="text-ink-muted">Description (optional)</span>
            <input name="description" class="mt-1 w-full rounded border border-slate-300 px-2 py-1" />
          </label>
          <label class="block">
            <span class="text-ink-muted">Duration minutes (optional)</span>
            <input name="duration_minutes" type="number" min="1" class="mt-1 w-28 rounded border border-slate-300 px-2 py-1" />
          </label>
          <button type="submit" class="rounded bg-accent px-3 py-1.5 font-medium text-white hover:bg-blue-700">
            Add video
          </button>
        </form>
      </section>
    )}

    <section class="mt-8">
      <h2 class="text-lg font-semibold">Videos</h2>
      {videos.length === 0 && (
        <p class="mt-2 text-sm text-ink-muted">No videos yet.</p>
      )}
      <ul class="mt-3 space-y-2">
        {editable.map((v) => (
          <li class="rounded border border-slate-200 p-3 text-sm">
            <div class="flex items-baseline justify-between gap-3">
              <span class="font-medium">{v.title}</span>
              <span class="text-xs text-ink-muted">
                {v.semesterTerm} {v.semesterYear} · {v.published ? 'published' : 'hidden'}
              </span>
            </div>
            <div class="mt-2 flex gap-3">
              {canManage && (
                <>
                  <a href={`/instructor/archive/video/${v.id}`} class="text-accent underline">
                    Edit
                  </a>
                  <form method="POST" action="/api/instructor/archive/video/delete">
                    <input type="hidden" name="id" value={v.id} />
                    <button type="submit" class="text-red-600 underline">Delete</button>
                  </form>
                </>
              )}
            </div>
          </li>
        ))}
        {readOnly.map((v) => (
          <li class="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
            <div class="flex items-baseline justify-between gap-3">
              <span class="font-medium">{v.title}</span>
              <span class="text-xs text-ink-muted">
                {v.semesterTerm} {v.semesterYear} · added by another instructor
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  </div>
</BaseLayout>
```

- [ ] **Step 2: Create the edit page**

Create `src/pages/instructor/archive/video/[id].astro`:

```astro
---
import BaseLayout from '@layouts/BaseLayout.astro';
import { getCollection } from 'astro:content';
import { getAdminClient } from '@lib/supabase/admin';
import { isContentManager, isAdmin } from '@lib/roles';
import { instructorOwnsCourse } from '@lib/archive/access';
import { normalizeLessonSlug } from '@lib/archive/build';

const user = Astro.locals.user;
const role = Astro.locals.profile?.role ?? 'student';
const { id } = Astro.params;

if (!user) {
  return Astro.redirect(`/auth/signin?next=${encodeURIComponent(Astro.url.pathname)}`);
}
if (!isContentManager(role)) return Astro.redirect('/instructor/archive');
if (!id) return new Response(null, { status: 404 });

const admin = getAdminClient();
const { data: v } = await admin
  .from('archive_videos')
  .select('id, course_slug, lesson_slug, semester_term, semester_year, title, provider, video_id, description, duration_minutes, published, created_by')
  .eq('id', id)
  .is('deleted_at', null)
  .maybeSingle();

if (!v) return new Response(null, { status: 404 });
if (!(await instructorOwnsCourse(user.id, v.course_slug, role))) {
  return Astro.redirect('/instructor/archive?error=not_course_instructor');
}
if (!isAdmin(role) && v.created_by !== user.id) {
  return Astro.redirect('/instructor/archive?error=not_owner');
}

const ecoLessons = (await getCollection('lessons', (l) => l.data.course === v.course_slug))
  .map((l) => ({ slug: normalizeLessonSlug(l.id), title: l.data.title }))
  .sort((a, b) => a.title.localeCompare(b.title));
---

<BaseLayout title="Edit video">
  <div class="mx-auto max-w-2xl px-4 py-12">
    <h1 class="text-2xl font-semibold tracking-tight">Edit video</h1>
    <form method="POST" action="/api/instructor/archive/video/update" class="mt-6 space-y-3 text-sm">
      <input type="hidden" name="id" value={v.id} />
      <label class="block">
        <span class="text-ink-muted">Title</span>
        <input name="title" required value={v.title} class="mt-1 w-full rounded border border-slate-300 px-2 py-1" />
      </label>
      <label class="block">
        <span class="text-ink-muted">Lesson</span>
        <select name="lesson_slug" required class="mt-1 w-full rounded border border-slate-300 px-2 py-1">
          {ecoLessons.map((l) => (
            <option value={l.slug} selected={l.slug === v.lesson_slug}>{l.title}</option>
          ))}
        </select>
      </label>
      <div class="flex gap-3">
        <label class="block">
          <span class="text-ink-muted">Term</span>
          <select name="semester_term" required class="mt-1 rounded border border-slate-300 px-2 py-1">
            {['spring', 'summer', 'fall'].map((t) => (
              <option value={t} selected={t === v.semester_term}>{t}</option>
            ))}
          </select>
        </label>
        <label class="block">
          <span class="text-ink-muted">Year</span>
          <input name="semester_year" type="number" min="2020" max="2100" required value={v.semester_year} class="mt-1 w-28 rounded border border-slate-300 px-2 py-1" />
        </label>
      </div>
      <div class="flex gap-3">
        <label class="block">
          <span class="text-ink-muted">Provider</span>
          <select name="provider" required class="mt-1 rounded border border-slate-300 px-2 py-1">
            {['youtube', 'vimeo'].map((p) => (
              <option value={p} selected={p === v.provider}>{p}</option>
            ))}
          </select>
        </label>
        <label class="block flex-1">
          <span class="text-ink-muted">Video ID</span>
          <input name="video_id" required value={v.video_id} class="mt-1 w-full rounded border border-slate-300 px-2 py-1" />
        </label>
      </div>
      <label class="block">
        <span class="text-ink-muted">Description</span>
        <input name="description" value={v.description ?? ''} class="mt-1 w-full rounded border border-slate-300 px-2 py-1" />
      </label>
      <label class="flex items-center gap-2">
        <input type="checkbox" name="published" checked={v.published} />
        <span>Published (visible to students)</span>
      </label>
      <div class="flex gap-3">
        <button type="submit" class="rounded bg-accent px-3 py-1.5 font-medium text-white hover:bg-blue-700">
          Save
        </button>
        <a href="/instructor/archive" class="px-3 py-1.5 text-ink-muted underline">Cancel</a>
      </div>
    </form>
  </div>
</BaseLayout>
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck` (0 errors), `npm run format`, then build (placeholder env per Task 6 Step 2). Expected: PASS — both pages compile.

> Note: with placeholder env the hub's `getAdminClient()` will throw at request time, but build only compiles pages (doesn't execute SSR), so the build passes. Runtime needs real env (manual matrix in Task 11).

- [ ] **Step 4: Commit**

```bash
git add src/pages/instructor/archive/index.astro src/pages/instructor/archive/video/[id].astro
git commit -m "feat(archive): instructor hub + video edit page"
```

---

## Task 10: Link the hub from the instructor index

**Files:**
- Modify: `src/pages/instructor/index.astro`

- [ ] **Step 1: Add an "Archive content" card**

In `src/pages/instructor/index.astro`, inside the `instructorCourses.size > 0` block's `<div class="mt-10 space-y-6">`, after the Workshops `</section>`, add:

```astro
          <section class="rounded-lg border border-slate-200 p-5">
            <h2 class="text-xl font-semibold">Archive content</h2>
            <p class="mt-1 text-sm text-ink-muted">
              Add lecture videos (ECO 1002) to the course archive. Manage the
              items you created; students enrolled in the course see published
              items.
            </p>
            <div class="mt-4">
              <a
                href="/instructor/archive"
                class="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Manage archive →
              </a>
            </div>
          </section>
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck` + build (placeholder env). Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/pages/instructor/index.astro
git commit -m "feat(archive): link archive management from the instructor hub"
```

---

## Task 11: Full verification + manual matrix

**Files:** none.

- [ ] **Step 1: Automated suite**

Run:
```bash
node --test 'src/lib/**/*.test.ts'
npm run typecheck
npm run format
PUBLIC_SUPABASE_URL=https://placeholder.supabase.co \
PUBLIC_SUPABASE_ANON_KEY=placeholder \
PUBLIC_SITE_URL=http://localhost:4321 \
npm run build
```
Expected: tests pass (roles + ownership added); typecheck 0 errors; build clean. If `npm run format` reformats files outside this branch's scope (pre-existing drift), `git restore` those so the branch stays focused.

- [ ] **Step 2: Apply schema + regen types against a real Supabase**

Paste `supabase/schema.sql` end-to-end into the Supabase SQL Editor (idempotent). Confirm `archive_videos` exists with RLS enabled and no policies. If you have the CLI configured, run `npm run supabase:types` and diff against the hand-edited block (should match); otherwise keep the hand-edit.

- [ ] **Step 3: Manual matrix (`npm run dev` against real Supabase)**

Seed: a `profiles.role = 'instructor'` user with an `enrollments` row where `instructor_id = them` and `course_slug = 'eco-1002'`; an enrolled student; a TA; an admin.

  - **Instructor** visits `/instructor/archive`: sees the add-video form; adds a video → redirected with `?ok=created`; it appears under editable; visits `/eco-1002/archive` as that instructor (staff) and sees it; edits it; hides it (uncheck published) → it disappears from `/eco-1002/archive` for an enrolled student; deletes it (soft) → gone from both.
  - **Enrolled student** visits `/eco-1002/archive`: sees published instructor videos embedded inline; never sees hidden/deleted ones.
  - **Second instructor** (different `created_by`, same course): sees the first instructor's video as read-only (no Edit/Delete); POSTing `update`/`delete` with that id → `?error=not_owner`.
  - **TA**: `/instructor/archive` loads read-only (no add form, no controls); direct POST to the create API → `?error=forbidden`.
  - **Admin**: sees and can edit/delete all.
  - **Guest** hitting `/instructor/archive` → redirected to signin.
  - **FIN-only instructor**: no add-video form (no eco-1002 in their courses); create API with `course_slug` other than eco-1002 → `?error=invalid_course`.

- [ ] **Step 4: Final review + PR**

Confirm `git status` clean, branch contains only intended files. Open a PR titled `db: instructor archive management — Phase 1 (videos)` (the `db:` tag flags the RLS/schema change for review).

---

## Self-Review (completed during authoring)

- **Spec coverage (Phase 1 rows):** `archive_videos` table + RLS (T1); types (T1); `isContentManager` for TA-read-only writes (T2); ownership partition (T3); `instructorOwnsCourse` (T4); `db.ts` degrade-safe fetch (T5); hybrid loader merge (T6); hub data loader (T7); video CRUD with ECO-only + lesson validation + own-row gate + error-redirect (T8); hub + edit pages with staff-view / manager-edit split (T9); instructor-hub link (T10); verification incl. the full permission matrix (T11). Phase 2 (papers/Storage/fileUrl) explicitly excluded.
- **Placeholder scan:** none; every code step is complete.
- **Type consistency:** `ArchiveVideoRow` (db.ts) → `VideoInput` map (load.ts) uses the existing `VideoInput` shape; `ManageVideo.createdBy` feeds `partitionByOwnership`'s `OwnableItem.createdBy`; `isContentManager`/`isAdmin`/`instructorOwnsCourse` signatures consistent across APIs and pages; error-redirect target `/instructor/archive` consistent across all three APIs.
- **Convention checks:** writes gate on `isContentManager` (not `isStaff`) so TAs are read-only; role logic stays in `@lib/roles`; service-role + app-side ownership (no RLS for instructor access, #6); error-redirect to the page not the API (#16); degrade-safe on missing env (#5); pure logic alias-free + `node --test` (#verifying). build.ts/types.ts untouched (DB videos reuse `VideoInput`).
