# Archive Phase 2a — File uploads + discoverability + lesson-connected videos

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Instructors/admins upload exam/assignment files (PDF/docx) to a private bucket that enrolled students download via gated signed URLs; make archive management easy to find (hub sections + a staff "Manage this archive" link on `/{course}/archive`); and surface each lesson's videos on the lesson page for enrolled students + staff.

**Architecture:** New RLS-locked `archive_papers` table + private Storage bucket, accessed only via the service-role admin client behind `isContentManager` + ownership gates. The pure archive core gains a `papers` input (file-exam `ArchiveItem`s with a signed `fileUrl`); the loader generates signed URLs. New instructor file-upload CRUD mirrors the Phase 1 video handlers. Lesson pages render a gated "Lecture videos" section reusing the shipped `archive_videos` data.

**Tech Stack:** Astro 5 SSR, Supabase (Postgres + Storage + service-role admin client), `node --test`, React island for the archive list.

**Spec:** `docs/superpowers/specs/2026-06-02-archive-authoring-uploads-design.md` (Phase 2a). Phase 2b (interactive quiz builder) is a separate plan — do NOT add `archive_quizzes`, the quiz builder, or the git-or-DB grade resolver here.

---

## File Structure

**Create:**
- `src/pages/api/instructor/archive/paper/create.ts` — multipart upload + insert.
- `src/pages/api/instructor/archive/paper/update.ts` — metadata edit.
- `src/pages/api/instructor/archive/paper/delete.ts` — soft delete.
- `src/pages/instructor/archive/paper/[id].astro` — paper edit page.

**Modify:**
- `supabase/schema.sql` — `archive_papers` table + RLS + private bucket.
- `src/lib/supabase/database.types.ts` — `archive_papers` block.
- `src/lib/archive/types.ts` — `ArchiveItem.fileUrl/fileName`, `PaperInput`.
- `src/lib/archive/build.ts` — `papers` input → file-exam items (+ tests).
- `src/lib/archive/build.test.ts` — paper item tests.
- `src/lib/archive/db.ts` — `fetchArchivePapers`, `fetchArchiveVideosForLesson`.
- `src/lib/archive/load.ts` — merge papers (signed URLs).
- `src/components/archive/ArchiveBrowser.tsx` — render file download link.
- `src/lib/instructor/archive-manage.ts` — also load papers for the hub.
- `src/pages/instructor/archive/index.astro` — sections (Videos · Exams & assignments), upload form, paper list, add-video `?course=&lesson=` prefill.
- `src/pages/eco-1002/archive.astro`, `src/pages/fin-3610/archive.astro` — staff "Manage this archive" link.
- `src/layouts/LessonLayout.astro` — gated "Lecture videos" section + staff "add a video for this lesson" link.

**Unchanged:** `archive_videos` table + video CRUD; grade engine; git content; TA access.

---

## Task 1: `archive_papers` table + RLS + Storage bucket + types

**Files:** Modify `supabase/schema.sql`, `src/lib/supabase/database.types.ts`.

> `db:` change; verified via `npm run typecheck` + `schema-roundtrip` CI.

- [ ] **Step 1: Add the table + bucket to `supabase/schema.sql`** (append after the `archive_videos` section):

```sql
-- =========================================================================
-- archive_papers --- instructor-uploaded exam/assignment files (PDF/docx)
-- surfaced in the course archive as gated signed-URL downloads. RLS-locked;
-- service-role only (convention #6). Bytes live in Storage, not Postgres.
-- =========================================================================
create table if not exists public.archive_papers (
  id uuid primary key default gen_random_uuid(),
  course_slug text not null,
  kind text not null,
  title text not null,
  semester_term text not null,
  semester_year integer not null,
  covers text[] not null default '{}',
  storage_path text not null,
  original_filename text not null,
  content_type text not null,
  size_bytes integer not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  published boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  -- updated_at is maintained by the mutation API (set to now() on update).
  updated_at timestamptz not null default now(),
  check (kind in ('exam', 'assignment')),
  check (semester_term in ('spring', 'summer', 'fall')),
  check (semester_year between 2020 and 2100)
);

create index if not exists archive_papers_live_idx
  on public.archive_papers (course_slug)
  where deleted_at is null and published;

alter table public.archive_papers enable row level security;
-- No policies: service-role only (instructor UI gates in app code).

-- Private Storage bucket for paper files. Access only via service-role
-- createSignedUrl(); no public reads. Idempotent.
insert into storage.buckets (id, name, public)
values ('archive-papers', 'archive-papers', false)
on conflict (id) do nothing;
```

- [ ] **Step 2: Add the `archive_papers` block to `database.types.ts`** inside `Database.public.Tables` (alphabetically, after `archive_videos`):

```ts
      archive_papers: {
        Row: {
          id: string;
          course_slug: string;
          kind: 'exam' | 'assignment';
          title: string;
          semester_term: 'spring' | 'summer' | 'fall';
          semester_year: number;
          covers: string[];
          storage_path: string;
          original_filename: string;
          content_type: string;
          size_bytes: number;
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
          storage_path: string;
          original_filename: string;
          content_type: string;
          size_bytes: number;
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
          storage_path?: string;
          original_filename?: string;
          content_type?: string;
          size_bytes?: number;
          created_by?: string;
          published?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
```

- [ ] **Step 3: Verify** — `npm run typecheck` → 0 errors.
- [ ] **Step 4: Commit** —
```bash
git add supabase/schema.sql src/lib/supabase/database.types.ts
git commit -m "db(archive): add archive_papers table (RLS-locked) + private bucket + types"
```

---

## Task 2: Pure core — `PaperInput` + file-exam items

**Files:** Modify `src/lib/archive/types.ts`, `src/lib/archive/build.ts`; test `src/lib/archive/build.test.ts`.

- [ ] **Step 1: Extend types** — in `src/lib/archive/types.ts`:

(a) add `fileUrl?`/`fileName?` to `ArchiveItem` (after `videoId?`):
```ts
  provider?: 'youtube' | 'vimeo';
  videoId?: string;
  fileUrl?: string; // signed download URL for file-papers
  fileName?: string; // original filename for file-papers
```

(b) add `PaperInput` after `VideoInput`:
```ts
export interface PaperInput {
  id: string;
  course: string;
  kind: 'exam' | 'assignment';
  title: string;
  covers: string[];
  semester: Semester;
  fileUrl: string;
  fileName: string;
}
```

- [ ] **Step 2: Append the failing test** to `src/lib/archive/build.test.ts`:

```ts
import type { PaperInput } from './types.ts';

test('papers become file-exam/assignment items with fileUrl and no /practice href', () => {
  const papers: PaperInput[] = [
    {
      id: 'p1',
      course: 'eco-1002',
      kind: 'assignment',
      title: 'PS1 (Fall 2024)',
      covers: ['eco-1002/solow'],
      semester: { term: 'fall', year: 2024 },
      fileUrl: 'https://signed.example/p1.pdf',
      fileName: 'ps1.pdf',
    },
  ];
  const items = buildArchiveItems({
    lessons,
    quizzes: [],
    videos: [],
    papers,
    course: 'eco-1002',
  });
  const paper = items.find((i) => i.type === 'assignment');
  assert.ok(paper);
  assert.equal(paper.href, '');
  assert.equal(paper.fileUrl, 'https://signed.example/p1.pdf');
  assert.equal(paper.fileName, 'ps1.pdf');
  assert.deepEqual(paper.units, ['Growth']);
  assert.deepEqual(paper.semester, { term: 'fall', year: 2024 });
});

test('buildArchiveItems works when papers is omitted (back-compat)', () => {
  const items = buildArchiveItems({
    lessons,
    quizzes,
    videos,
    course: 'eco-1002',
  });
  assert.ok(items.length > 0);
});
```

- [ ] **Step 2b: Run → FAIL** — `node --test src/lib/archive/build.test.ts` (papers arg not accepted / no file items).

- [ ] **Step 3: Implement** — in `src/lib/archive/build.ts`:

(a) add `PaperInput` to the type import from `./types.ts`.

(b) change the `buildArchiveItems` signature to accept optional `papers`:
```ts
export function buildArchiveItems(input: {
  lessons: LessonInput[];
  quizzes: QuizInput[];
  videos: VideoInput[];
  papers?: PaperInput[];
  course: string;
}): ArchiveItem[] {
```

(c) after the Videos loop (before `return items;`), add:
```ts
  // File papers (uploaded exam/assignment files)
  for (const p of input.papers ?? []) {
    if (p.course !== course) continue;
    const lessonSlugs = p.covers.map(normalizeLessonSlug);
    const units = unitsFor(lessonSlugs, unitBySlug);
    items.push({
      id: `${p.kind}:paper:${p.id}`,
      type: p.kind,
      title: p.title,
      course,
      href: '',
      lessonSlugs,
      units,
      semester: p.semester,
      searchText: [p.title, units.join(' ')].join(' ').toLowerCase(),
      fileUrl: p.fileUrl,
      fileName: p.fileName,
    });
  }
```

- [ ] **Step 4: Run → PASS** — `node --test src/lib/archive/build.test.ts` (all pass). Then `npm run format`.
- [ ] **Step 5: Commit** —
```bash
git add src/lib/archive/types.ts src/lib/archive/build.ts src/lib/archive/build.test.ts
git commit -m "feat(archive): PaperInput + file-exam items in pure core"
```

---

## Task 3: `db.ts` — fetch papers + lesson videos

**Files:** Modify `src/lib/archive/db.ts`.

- [ ] **Step 1: Append** to `src/lib/archive/db.ts`:

```ts
export interface ArchivePaperRow {
  id: string;
  course_slug: string;
  kind: 'exam' | 'assignment';
  title: string;
  semester_term: 'spring' | 'summer' | 'fall';
  semester_year: number;
  covers: string[];
  storage_path: string;
  original_filename: string;
  created_by: string;
  published: boolean;
}

/** Published, non-deleted file papers for a course (service-role). [] on error. */
export async function fetchArchivePapers(
  course: string,
): Promise<ArchivePaperRow[]> {
  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('archive_papers')
      .select(
        'id, course_slug, kind, title, semester_term, semester_year, covers, storage_path, original_filename, created_by, published',
      )
      .eq('course_slug', course)
      .eq('published', true)
      .is('deleted_at', null);
    if (error) return [];
    return (data ?? []) as ArchivePaperRow[];
  } catch {
    return [];
  }
}

/** A short-lived signed URL for a paper's file, or null on error. */
export async function signPaperUrl(storagePath: string): Promise<string | null> {
  try {
    const admin = getAdminClient();
    const { data, error } = await admin.storage
      .from('archive-papers')
      .createSignedUrl(storagePath, 3600);
    if (error || !data) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

/** Published, non-deleted videos for one lesson (service-role). [] on error. */
export async function fetchArchiveVideosForLesson(
  course: string,
  lessonSlug: string,
): Promise<ArchiveVideoRow[]> {
  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('archive_videos')
      .select(
        'id, course_slug, lesson_slug, semester_term, semester_year, title, provider, video_id, description, created_by, published',
      )
      .eq('course_slug', course)
      .eq('lesson_slug', lessonSlug)
      .eq('published', true)
      .is('deleted_at', null);
    if (error) return [];
    return (data ?? []) as ArchiveVideoRow[];
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Verify** — `npm run typecheck` → 0 errors.
- [ ] **Step 3: Commit** —
```bash
git add src/lib/archive/db.ts
git commit -m "feat(archive): db.ts fetchArchivePapers, signPaperUrl, per-lesson videos"
```

---

## Task 4: Merge papers into the loader

**Files:** Modify `src/lib/archive/load.ts`.

- [ ] **Step 1:** add imports near the top:
```ts
import { fetchArchiveVideos, fetchArchivePapers, signPaperUrl } from './db';
import type { ArchiveItem, Facets, LessonInput, LessonRef, PaperInput, QuizInput, VideoInput } from './types';
```
(Merge `PaperInput` into the existing `./types` import; keep the others.)

- [ ] **Step 2:** after the `dbVideos` block and before `buildArchiveItems`, add paper fetching + signing:
```ts
  const paperRows = await fetchArchivePapers(course);
  const papers: PaperInput[] = [];
  for (const r of paperRows) {
    const fileUrl = await signPaperUrl(r.storage_path);
    if (!fileUrl) continue; // skip papers whose file can't be signed
    papers.push({
      id: r.id,
      course: r.course_slug,
      kind: r.kind,
      title: r.title,
      covers: r.covers,
      semester: { term: r.semester_term, year: r.semester_year },
      fileUrl,
      fileName: r.original_filename,
    });
  }
```

- [ ] **Step 3:** pass `papers` into the build call:
```ts
  const items = buildArchiveItems({ lessons, quizzes, videos, papers, course });
```

- [ ] **Step 4: Verify** — `node --test 'src/lib/**/*.test.ts'` (still pass), `npm run typecheck`, then build:
```bash
PUBLIC_SUPABASE_URL=https://placeholder.supabase.co PUBLIC_SUPABASE_ANON_KEY=placeholder PUBLIC_SITE_URL=http://localhost:4321 npm run build
```
Expected PASS (placeholder env → fetch/sign return []/null, archive renders git-only).

- [ ] **Step 5: Commit** —
```bash
git add src/lib/archive/load.ts
git commit -m "feat(archive): merge uploaded file papers (signed URLs) into the loader"
```

---

## Task 5: Render file downloads in `ArchiveBrowser`

**Files:** Modify `src/components/archive/ArchiveBrowser.tsx`.

- [ ] **Step 1:** in the list item render, the current branch is `item.type === 'video' ? (...) : (<a href={item.href}>...)`. Change the non-video branch to render a download link when `fileUrl` is set. Replace the `: (` else-branch `<a>` with:

```tsx
            ) : item.fileUrl ? (
              <a
                href={item.fileUrl}
                target="_blank"
                rel="noopener"
                className="mt-1 block font-medium text-accent hover:underline"
              >
                {item.title}{' '}
                <span className="text-xs text-ink-muted">
                  (download{item.fileName ? ` · ${item.fileName}` : ''})
                </span>
              </a>
            ) : (
              <a
                href={item.href}
                className="mt-1 block font-medium hover:text-accent"
              >
                {item.title}
              </a>
            )}
```

- [ ] **Step 2: Verify** — `npm run typecheck` + `npm run format` + build (placeholder env). Expected PASS.
- [ ] **Step 3: Commit** —
```bash
git add src/components/archive/ArchiveBrowser.tsx
git commit -m "feat(archive): render file-paper items as gated download links"
```

---

## Task 6: Paper CRUD APIs

**Files:** Create `src/pages/api/instructor/archive/paper/{create,update,delete}.ts`.

> Mirrors the Phase 1 video handlers' gate order (`isContentManager` → `instructorOwnsCourse` → own-row), error-redirect to `/instructor/archive` (#16). `create` is multipart with Storage upload + orphan cleanup.

- [ ] **Step 1: create.ts** — `src/pages/api/instructor/archive/paper/create.ts`:

```ts
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getAdminClient } from '@lib/supabase/admin';
import { isContentManager } from '@lib/roles';
import { instructorOwnsCourse } from '@lib/archive/access';
import { normalizeLessonSlug } from '@lib/archive/build';

const TERMS = new Set(['spring', 'summer', 'fall']);
const KINDS = new Set(['exam', 'assignment']);
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const MAX_BYTES = 25 * 1024 * 1024;

function err(reason: string): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: `/instructor/archive?error=${encodeURIComponent(reason)}` },
  });
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file';
}

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  const role = locals.profile?.role ?? 'student';

  const form = await request.formData();
  const course = String(form.get('course_slug') ?? '');
  const kind = String(form.get('kind') ?? '');
  const title = String(form.get('title') ?? '').trim();
  const term = String(form.get('semester_term') ?? '');
  const year = Number(form.get('semester_year') ?? NaN);
  const covers = form.getAll('covers').map(String).filter(Boolean);
  const file = form.get('file');

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
    year > 2100
  ) {
    return err('invalid_input');
  }
  if (!(file instanceof File) || file.size === 0) return err('missing_file');
  if (!ALLOWED_TYPES.has(file.type)) return err('bad_file_type');
  if (file.size > MAX_BYTES) return err('file_too_large');

  // covers must reference real lessons of this course
  const lessons = await getCollection('lessons', (l) => l.data.course === course);
  const valid = new Set(lessons.map((l) => normalizeLessonSlug(l.id)));
  if (covers.some((c) => !valid.has(c))) return err('invalid_lesson');

  const admin = getAdminClient();
  const id = crypto.randomUUID();
  const path = `${course}/${id}/${sanitize(file.name)}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const up = await admin.storage
    .from('archive-papers')
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (up.error) return err('upload_failed');

  const { error } = await admin.from('archive_papers').insert({
    id,
    course_slug: course,
    kind: kind as 'exam' | 'assignment',
    title,
    semester_term: term as 'spring' | 'summer' | 'fall',
    semester_year: year,
    covers,
    storage_path: path,
    original_filename: file.name,
    content_type: file.type,
    size_bytes: file.size,
    created_by: user.id,
  });
  if (error) {
    // No orphan: remove the just-uploaded object.
    await admin.storage.from('archive-papers').remove([path]);
    return err('insert_failed');
  }

  return new Response(null, {
    status: 303,
    headers: { Location: `/instructor/archive?ok=paper_created` },
  });
};
```

- [ ] **Step 2: update.ts** — `src/pages/api/instructor/archive/paper/update.ts` (metadata only; no file replace in 2a):

```ts
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getAdminClient } from '@lib/supabase/admin';
import { isContentManager, isAdmin } from '@lib/roles';
import { instructorOwnsCourse } from '@lib/archive/access';
import { normalizeLessonSlug } from '@lib/archive/build';

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
  const id = String(form.get('id') ?? '');
  const kind = String(form.get('kind') ?? '');
  const title = String(form.get('title') ?? '').trim();
  const term = String(form.get('semester_term') ?? '');
  const year = Number(form.get('semester_year') ?? NaN);
  const covers = form.getAll('covers').map(String).filter(Boolean);
  const published = form.get('published') != null;

  if (!user) return err('unauthenticated');
  if (!isContentManager(role)) return err('forbidden');
  if (!id) return err('invalid_input');

  const admin = getAdminClient();
  const { data: row } = await admin
    .from('archive_papers')
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
    year > 2100
  ) {
    return err('invalid_input');
  }
  const lessons = await getCollection(
    'lessons',
    (l) => l.data.course === row.course_slug,
  );
  const valid = new Set(lessons.map((l) => normalizeLessonSlug(l.id)));
  if (covers.some((c) => !valid.has(c))) return err('invalid_lesson');

  const { error } = await admin
    .from('archive_papers')
    .update({
      kind: kind as 'exam' | 'assignment',
      title,
      semester_term: term as 'spring' | 'summer' | 'fall',
      semester_year: year,
      covers,
      published,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) return err('update_failed');

  return new Response(null, {
    status: 303,
    headers: { Location: `/instructor/archive?ok=paper_updated` },
  });
};
```

- [ ] **Step 3: delete.ts** — `src/pages/api/instructor/archive/paper/delete.ts` (soft-delete; file retained):

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
    .from('archive_papers')
    .select('course_slug, created_by')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!row) return err('not_found');
  if (!(await instructorOwnsCourse(user.id, row.course_slug, role)))
    return err('not_course_instructor');
  if (!isAdmin(role) && row.created_by !== user.id) return err('not_owner');

  const { error } = await admin
    .from('archive_papers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return err('delete_failed');

  return new Response(null, {
    status: 303,
    headers: { Location: `/instructor/archive?ok=paper_deleted` },
  });
};
```

- [ ] **Step 4: Verify** — `npm run typecheck`, `npm run format`, build (placeholder env). Expected PASS.
- [ ] **Step 5: Commit** —
```bash
git add src/pages/api/instructor/archive/paper/create.ts src/pages/api/instructor/archive/paper/update.ts src/pages/api/instructor/archive/paper/delete.ts
git commit -m "feat(archive): instructor file-paper upload/update/delete APIs (gated)"
```

---

## Task 7: Hub data loader — also load papers

**Files:** Modify `src/lib/instructor/archive-manage.ts`.

- [ ] **Step 1:** add a `ManagePaper` interface + fetch, extending the return shape. After the `ManageVideo` interface add:
```ts
export interface ManagePaper {
  id: string;
  courseSlug: string;
  kind: 'exam' | 'assignment';
  title: string;
  semesterTerm: string;
  semesterYear: number;
  originalFilename: string;
  published: boolean;
  createdBy: string;
}
```

- [ ] **Step 2:** change `loadInstructorArchive` to also return papers. After the `videos` mapping (before `return`), add:
```ts
  const { data: paperRows } = await admin
    .from('archive_papers')
    .select(
      'id, course_slug, kind, title, semester_term, semester_year, original_filename, published, created_by',
    )
    .in('course_slug', courses)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const papers: ManagePaper[] = (paperRows ?? []).map((p) => ({
    id: p.id,
    courseSlug: p.course_slug,
    kind: p.kind,
    title: p.title,
    semesterTerm: p.semester_term,
    semesterYear: p.semester_year,
    originalFilename: p.original_filename,
    published: p.published,
    createdBy: p.created_by,
  }));
```
and change the return to `return { courses, videos, papers };` (and the function's return type to `{ courses: string[]; videos: ManageVideo[]; papers: ManagePaper[] }`). Also update the early `courses.length === 0` return to `return { courses, videos: [], papers: [] };`.

- [ ] **Step 3: Verify** — `npm run typecheck` → 0 errors.
- [ ] **Step 4: Commit** —
```bash
git add src/lib/instructor/archive-manage.ts
git commit -m "feat(archive): hub loader returns file papers too"
```

---

## Task 8: Hub rework — sections, upload form, paper list, video prefill

**Files:** Modify `src/pages/instructor/archive/index.astro`; create `src/pages/instructor/archive/paper/[id].astro`.

- [ ] **Step 1: Rework the hub** `src/pages/instructor/archive/index.astro`. Read the current file. Apply these changes:

(a) In the frontmatter, destructure papers and partition them like videos, and read prefill params:
```ts
const { courses, videos, papers } = await loadInstructorArchive(user.id, role);
const canManage = isContentManager(role);
const editableVideos = partitionByOwnership(videos, {
  userId: user.id,
  canEditAll: isAdmin(role),
});
const editablePapers = partitionByOwnership(papers, {
  userId: user.id,
  canEditAll: isAdmin(role),
});
const prefillCourse = Astro.url.searchParams.get('course') ?? '';
const prefillLesson = Astro.url.searchParams.get('lesson') ?? '';
const manageCourses = courses; // courses the viewer manages
```
(Replace the existing single `partitionByOwnership(videos, ...)` call. `partitionByOwnership` is generic so it works for `ManagePaper` too.)

(b) In the add-video form, preselect the prefill course (hidden input stays `eco-1002`) and preselect the lesson option when `prefillLesson` matches: change the lesson `<option>` map to:
```astro
              {ecoLessons.map((l) => (
                <option value={l.slug} selected={l.slug === prefillLesson}>
                  {l.title}
                </option>
              ))}
```

(c) Add an **Exams & assignments** section after the Videos section, with an upload form and the paper list. Insert before the closing `</div>` of the page container:
```astro
    <section class="mt-10">
      <h2 class="text-lg font-semibold">Exams &amp; assignments</h2>
      <p class="mt-1 text-sm text-ink-muted">
        Upload a past exam or assignment (PDF or Word, max 25&nbsp;MB).
        Enrolled students download it from the course archive.
      </p>

      {canManage && manageCourses.length > 0 && (
        <form
          method="POST"
          action="/api/instructor/archive/paper/create"
          enctype="multipart/form-data"
          class="mt-4 space-y-3 rounded-lg border border-slate-200 p-5 text-sm"
        >
          <h3 class="font-medium">Upload a file</h3>
          <label class="block">
            <span class="text-ink-muted">Course</span>
            <select name="course_slug" required class="mt-1 w-full rounded border border-slate-300 px-2 py-1">
              {manageCourses.map((c) => (
                <option value={c} selected={c === prefillCourse}>{c}</option>
              ))}
            </select>
          </label>
          <label class="block">
            <span class="text-ink-muted">Kind</span>
            <select name="kind" required class="mt-1 rounded border border-slate-300 px-2 py-1">
              <option value="exam">Exam</option>
              <option value="assignment">Assignment</option>
            </select>
          </label>
          <label class="block">
            <span class="text-ink-muted">Title</span>
            <input name="title" required class="mt-1 w-full rounded border border-slate-300 px-2 py-1" />
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
          <label class="block">
            <span class="text-ink-muted">File (PDF or .docx)</span>
            <input name="file" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required class="mt-1 block w-full text-sm" />
          </label>
          <button type="submit" class="rounded bg-accent px-3 py-1.5 font-medium text-white hover:bg-blue-700">
            Upload
          </button>
          <p class="text-xs text-ink-muted">
            Tip: link lessons to this paper later by editing it. (Covers
            default to none.)
          </p>
        </form>
      )}

      {papers.length === 0 && (
        <p class="mt-3 text-sm text-ink-muted">
          No exams or assignments yet
          {canManage ? ' — upload a file above.' : '.'}
        </p>
      )}
      <ul class="mt-3 space-y-2">
        {editablePapers.editable.map((p) => (
          <li class="rounded border border-slate-200 p-3 text-sm">
            <div class="flex items-baseline justify-between gap-3">
              <span class="font-medium">{p.title}</span>
              <span class="text-xs text-ink-muted">
                {p.courseSlug} · {p.kind} · {p.semesterTerm} {p.semesterYear} ·{' '}
                {p.published ? 'published' : 'hidden'}
              </span>
            </div>
            {canManage && (
              <div class="mt-2 flex gap-3">
                <a href={`/instructor/archive/paper/${p.id}`} class="text-accent underline">Edit</a>
                <form method="POST" action="/api/instructor/archive/paper/delete">
                  <input type="hidden" name="id" value={p.id} />
                  <button type="submit" class="text-red-600 underline">Delete</button>
                </form>
              </div>
            )}
          </li>
        ))}
        {editablePapers.readOnly.map((p) => (
          <li class="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
            <span class="font-medium">{p.title}</span>
            <span class="ml-2 text-xs text-ink-muted">
              {p.courseSlug} · added by another instructor
            </span>
          </li>
        ))}
      </ul>
    </section>
```

(d) Wherever the page renders the existing video list from a `partitionByOwnership(videos,...)` result, rename that variable to `editableVideos` (i.e., `editableVideos.editable` / `editableVideos.readOnly`). Also update the success-banner copy to recognize `paper_created`/`paper_updated`/`paper_deleted` (the existing banner prints the raw `ok` value, which is acceptable).

- [ ] **Step 2: Paper edit page** — `src/pages/instructor/archive/paper/[id].astro` (mirrors the video edit page; metadata only):

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
const { data: p } = await admin
  .from('archive_papers')
  .select('id, course_slug, kind, title, semester_term, semester_year, covers, original_filename, published, created_by')
  .eq('id', id)
  .is('deleted_at', null)
  .maybeSingle();
if (!p) return new Response(null, { status: 404 });
if (!(await instructorOwnsCourse(user.id, p.course_slug, role))) {
  return Astro.redirect('/instructor/archive?error=not_course_instructor');
}
if (!isAdmin(role) && p.created_by !== user.id) {
  return Astro.redirect('/instructor/archive?error=not_owner');
}

const lessons = (await getCollection('lessons', (l) => l.data.course === p.course_slug))
  .map((l) => ({ slug: normalizeLessonSlug(l.id), title: l.data.title }))
  .sort((a, b) => a.title.localeCompare(b.title));
const covers = new Set(p.covers);
---

<BaseLayout title="Edit paper">
  <div class="mx-auto max-w-2xl px-4 py-12">
    <h1 class="text-2xl font-semibold tracking-tight">Edit exam / assignment</h1>
    <p class="mt-1 text-sm text-ink-muted">File: {p.original_filename} (replace not supported yet — delete and re-upload to change the file).</p>
    <form method="POST" action="/api/instructor/archive/paper/update" class="mt-6 space-y-3 text-sm">
      <input type="hidden" name="id" value={p.id} />
      <label class="block">
        <span class="text-ink-muted">Kind</span>
        <select name="kind" required class="mt-1 rounded border border-slate-300 px-2 py-1">
          {['exam', 'assignment'].map((k) => (
            <option value={k} selected={k === p.kind}>{k}</option>
          ))}
        </select>
      </label>
      <label class="block">
        <span class="text-ink-muted">Title</span>
        <input name="title" required value={p.title} class="mt-1 w-full rounded border border-slate-300 px-2 py-1" />
      </label>
      <div class="flex gap-3">
        <label class="block">
          <span class="text-ink-muted">Term</span>
          <select name="semester_term" required class="mt-1 rounded border border-slate-300 px-2 py-1">
            {['spring', 'summer', 'fall'].map((t) => (
              <option value={t} selected={t === p.semester_term}>{t}</option>
            ))}
          </select>
        </label>
        <label class="block">
          <span class="text-ink-muted">Year</span>
          <input name="semester_year" type="number" min="2020" max="2100" required value={p.semester_year} class="mt-1 w-28 rounded border border-slate-300 px-2 py-1" />
        </label>
      </div>
      <fieldset class="block">
        <legend class="text-ink-muted">Lessons covered</legend>
        <div class="mt-1 space-y-1">
          {lessons.map((l) => (
            <label class="flex items-center gap-2">
              <input type="checkbox" name="covers" value={l.slug} checked={covers.has(l.slug)} />
              <span>{l.title}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label class="flex items-center gap-2">
        <input type="checkbox" name="published" checked={p.published} />
        <span>Published (visible to students)</span>
      </label>
      <div class="flex gap-3">
        <button type="submit" class="rounded bg-accent px-3 py-1.5 font-medium text-white hover:bg-blue-700">Save</button>
        <a href="/instructor/archive" class="px-3 py-1.5 text-ink-muted underline">Cancel</a>
      </div>
    </form>
  </div>
</BaseLayout>
```

- [ ] **Step 3: Verify** — `npm run typecheck`, `npm run format`, build (placeholder env). Confirm `/instructor/archive` and `/instructor/archive/paper/[id]` routes emit. Expected PASS.
- [ ] **Step 4: Commit** —
```bash
git add src/pages/instructor/archive/index.astro src/pages/instructor/archive/paper/[id].astro
git commit -m "feat(archive): hub Exams&assignments section, upload form, paper edit, video prefill"
```

---

## Task 9: Staff "Manage this archive" link on the archive pages

**Files:** Modify `src/pages/eco-1002/archive.astro`, `src/pages/fin-3610/archive.astro`.

- [ ] **Step 1:** In each archive page, the frontmatter already computes `staff` (`isStaff(...)`). Add a staff-only banner above `<ArchiveBrowser .../>`. In the `canView` branch, replace `<ArchiveBrowser client:load items={items} facets={facets} />` with:
```astro
      <>
        {staff && (
          <p class="mt-6 rounded border border-accent/30 bg-accent/5 p-3 text-sm">
            <a href={`/${COURSE}/../instructor/archive?course=${COURSE}`.replace('/..', '')} class="font-medium text-accent underline">
              ＋ Manage this archive →
            </a>
            <span class="ml-2 text-ink-muted">Add or edit videos, exams, and assignments.</span>
          </p>
        )}
        <ArchiveBrowser client:load items={items} facets={facets} />
      </>
```
Simpler href: use `/instructor/archive?course={COURSE}` directly:
```astro
            <a href={`/instructor/archive?course=${COURSE}`} class="font-medium text-accent underline">
```
(Use the simpler form; drop the `.replace` line.)

- [ ] **Step 2: Verify** — `npm run typecheck`, `npm run format`, build. Expected PASS.
- [ ] **Step 3: Commit** —
```bash
git add src/pages/eco-1002/archive.astro src/pages/fin-3610/archive.astro
git commit -m "feat(archive): staff Manage-this-archive link on course archive pages"
```

---

## Task 10: Lesson-page video section (enrolled + staff)

**Files:** Modify `src/layouts/LessonLayout.astro`.

- [ ] **Step 1:** In `LessonLayout.astro` frontmatter, add imports + gated fetch. After the existing `const { prev, next } = findPrevNext(...)` line add:
```ts
import { canViewCourse } from '@lib/archive/access';
import { fetchArchiveVideosForLesson } from '@lib/archive/db';
import { normalizeLessonSlug } from '@lib/archive/build';

const lessonSlug = normalizeLessonSlug(lesson.id);
const canSeeVideos = await canViewCourse(Astro.locals, data.course);
const lessonVideos = canSeeVideos
  ? await fetchArchiveVideosForLesson(data.course, lessonSlug)
  : [];
const viewerIsStaffForVideos = canSeeVideos; // staff pass canViewCourse; refine below
const role = Astro.locals.profile?.role ?? 'student';
```
(Move the `import` lines to the top with the other imports; keep the `const` lines after `findPrevNext`.)

- [ ] **Step 2:** Add a "Lecture videos" section in the template, after the `<slot />` `</div>` and before `{article && ...}`:
```astro
    {canSeeVideos && (
      <section class="mt-10">
        <h2 class="text-lg font-semibold">Lecture videos</h2>
        {lessonVideos.length === 0 ? (
          <p class="mt-2 text-sm text-ink-muted">
            No videos for this lesson yet.
          </p>
        ) : (
          <ul class="mt-3 space-y-4">
            {lessonVideos.map((v) => (
              <li>
                <p class="text-sm font-medium">{v.title}</p>
                <div class="mt-2 aspect-video w-full">
                  <iframe
                    class="h-full w-full rounded"
                    src={
                      v.provider === 'youtube'
                        ? `https://www.youtube-nocookie.com/embed/${v.video_id}`
                        : `https://player.vimeo.com/video/${v.video_id}`
                    }
                    title={v.title}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowfullscreen
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
        {role !== 'student' && role !== 'ta' && (
          <p class="mt-3 text-sm">
            <a
              href={`/instructor/archive?course=${data.course}&lesson=${lessonSlug}`}
              class="text-accent underline"
            >
              ＋ Add a video for this lesson →
            </a>
          </p>
        )}
      </section>
    )}
```
(The `role !== 'student' && role !== 'ta'` check = instructor/admin = `isContentManager`; import and use `isContentManager(role)` instead for clarity: add `import { isContentManager } from '@lib/roles'` and use `{isContentManager(role) && (...)}`.)

- [ ] **Step 3:** Use `isContentManager(role)` for the add link (cleaner than inline role checks, convention #12). Final add-link guard:
```astro
        {isContentManager(role) && (
          <p class="mt-3 text-sm">
            <a href={`/instructor/archive?course=${data.course}&lesson=${lessonSlug}`} class="text-accent underline">
              ＋ Add a video for this lesson →
            </a>
          </p>
        )}
```
Remove the unused `viewerIsStaffForVideos` const.

- [ ] **Step 4: Verify** — `npm run typecheck`, `npm run format`, build (placeholder env → `canViewCourse` false without env → no section; compiles). Expected PASS.
- [ ] **Step 5: Commit** —
```bash
git add src/layouts/LessonLayout.astro
git commit -m "feat(archive): lesson-page Lecture videos section (enrolled+staff) + add-from-lesson link"
```

---

## Task 11: Full verification + manual matrix

**Files:** none.

- [ ] **Step 1:** `node --test 'src/lib/**/*.test.ts'` (all pass), `npm run typecheck`, `npm run format`, build (placeholder env). If `npm run format` touches unrelated pre-existing files, `git restore` them.
- [ ] **Step 2:** Apply `supabase/schema.sql` to the real project; confirm `archive_papers` exists + bucket `archive-papers` exists (private). Regenerate `database.types.ts` if you have CLI access (else keep hand-edit).
- [ ] **Step 3: Manual matrix** (`npm run dev` against real Supabase; instructor with an enrollment row owning a course, plus an enrolled student):
  - Discoverability: as staff, `/{course}/archive` shows "＋ Manage this archive →" → `/instructor/archive?course=…` → both Videos and Exams & assignments sections with Add controls.
  - Upload: instructor uploads a PDF in the Exams & assignments form → `?ok=paper_created` → appears in the hub paper list → enrolled student sees it on `/{course}/archive` as a "(download)" link → clicking opens the signed URL (expires after 1h). Non-PDF/oversize → error banner, no row.
  - Ownership: second instructor sees it read-only; POST update/delete with its id → `not_owner`. TA: no Add controls; POST create → `forbidden`.
  - Lesson videos: enrolled student on `/lessons/<slug>` sees "Lecture videos" with the lesson's videos; guest sees the lesson WITHOUT the section; staff see the section + "＋ Add a video for this lesson →" which deep-links the hub with course+lesson preselected.
- [ ] **Step 4:** Final review + PR titled `db: archive Phase 2a — file uploads + discoverability + lesson videos`.

---

## Self-Review (completed during authoring)

- **Spec coverage (Phase 2a):** `archive_papers` table+RLS+bucket+types (T1); pure file-exam items (T2); db fetch + signing + per-lesson videos (T3); loader merge (T4); download rendering (T5); paper CRUD gated incl. orphan cleanup (T6); hub loader papers (T7); hub sections + upload form + paper edit + video prefill (T8); staff archive-page link (T9); lesson-page videos + add-from-lesson (T10); verification (T11). Phase 2b (archive_quizzes, builder, git-or-DB resolver) explicitly excluded.
- **Placeholder scan:** none; complete code per step.
- **Type consistency:** `PaperInput` (types) → `papers` build input → `ArchivePaperRow` (db) → `PaperInput` mapping (load) → `fileUrl`/`fileName` on `ArchiveItem` → `ArchiveBrowser` render; `ManagePaper.createdBy` feeds `partitionByOwnership` (generic `OwnableItem`); `loadInstructorArchive` return shape `{courses,videos,papers}` consumed in T8; `fetchArchiveVideosForLesson` row shape matches the existing `ArchiveVideoRow`.
- **Conventions:** writes gate on `isContentManager` (TA excluded); service-role + ownership (#6); error-redirect to page (#16); degrade-safe (#5); pure logic alias-free + `node --test`; signed URLs server-side only, `storage_path` never client-side; orphan cleanup on failed insert.
