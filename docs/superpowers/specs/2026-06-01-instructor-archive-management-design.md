# Instructor-facing archive management (videos + file papers)

**Date:** 2026-06-01
**Status:** Approved (brainstorming → ready for implementation plan)
**Builds on:** the read-only per-course archive (PR #90,
`docs/superpowers/specs/2026-06-01-per-course-archive-design.md`)

## Goal

Let instructors add and manage prior-semester archive content through the
browser, instead of only via git-committed JSON:

- **Lecture videos** (ECO 1002 only) — metadata only (provider + video id +
  lesson + semester + title).
- **Past exams / assignments** (both courses) — **file uploads** (PDF/docx)
  to private storage, surfaced as gated download links. No in-browser grading.

Content created this way is **DB-backed** (instructors cannot commit to git)
and merged into the existing archive alongside git content.

## Non-goals

- No in-browser interactive quiz builder. Interactive, server-graded exams
  remain git-authored quiz JSON (unchanged). Instructor-uploaded exams are
  files only.
- No public file hosting. Files are private; access is via short-lived signed
  URLs gated to enrolled students + staff.
- No migration of existing git content into the DB. The archive stays
  **hybrid** (git content + DB content); git remains the source for lessons,
  the seed fixtures, and interactive-quiz exams.
- No FIN 3610 videos (ECO-only constraint retained).
- No draft/review workflow. Saving publishes immediately.
- TAs do not manage content (read-only).

## Decisions (from interview)

| Dimension | Decision |
|---|---|
| Content types | Videos (metadata, ECO-only) + exams/assignments (file upload, both courses) |
| Exam/assignment form | File upload (PDF/docx) → Supabase Storage, signed URLs gated to enrolled+staff |
| Permissions | Instructor: own course (`enrollments.instructor_id`) + own rows (`created_by`); admin: all; TA: read-only |
| Publish / remove | Immediate publish; `published` hide toggle; soft-delete (`deleted_at`), file retained |
| Video scope | ECO 1002 only |
| Access pattern | Service-role admin client + app-side ownership (convention #6); tables RLS-locked |
| Archive source | Hybrid — git content unchanged; DB content additive, merged in the loader |
| Build | One spec, two shippable phases: Phase 1 videos, Phase 2 file papers |

## Data model (`db:` change — `supabase/schema.sql`, idempotent)

### Table `public.archive_videos`

```
id              uuid primary key default gen_random_uuid()
course_slug     text not null check (course_slug = 'eco-1002')
lesson_slug     text not null
semester_term   text not null check (semester_term in ('spring','summer','fall'))
semester_year   int  not null check (semester_year between 2020 and 2100)
title           text not null
provider        text not null check (provider in ('youtube','vimeo'))
video_id        text not null
description     text
duration_minutes int
created_by      uuid not null references public.profiles(id) on delete restrict
published       boolean not null default true
deleted_at      timestamptz
created_at      timestamptz not null default now()
updated_at      timestamptz not null default now()
```

### Table `public.archive_papers`

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
updated_at      timestamptz not null default now()
```

Indexes: `(course_slug)` on each; partial index `where deleted_at is null and
published` for the loader read path.

### RLS

Enable RLS on both tables with **no anon/authenticated policies** (so PostgREST
cannot read or write them). All access is via the service-role admin client,
gated in app code — the sanctioned instructor-data pattern (convention #6).
This is acceptable here because (a) there is no PII in these tables and (b) the
student read path is already gated to enrolled+staff at the page level, which
RLS "any authenticated user" policies could not express. The
`schema-roundtrip` CI must stay green (idempotent enable + locked policies).

### Storage

Private bucket `archive-papers`. Object path:
`<course_slug>/<paper_id>/<sanitized_original_filename>`. Access only through
service-role `createSignedUrl(path, 3600)` generated server-side. The
`storage_path` is never sent to the client.

### Types

Regenerate `src/lib/supabase/database.types.ts` via `npm run supabase:types`.
If no live DB is available, hand-edit the two tables in, including
`Relationships: []` per table and the file's existing
`CompositeTypes: Record<string, never>` (per CLAUDE.md — don't drop these).

## Hybrid loader + pure-core extension

### `src/lib/archive/db.ts` (new, service-role, server-only)

- `fetchArchiveVideos(course)` → published, non-deleted `archive_videos` rows.
- `fetchArchivePapers(course)` → published, non-deleted `archive_papers` rows.
- Both wrapped in try/catch returning `[]` on missing-env / error (convention
  #5 — read path never hard-throws; archive degrades to git-only).

### `src/lib/archive/load.ts` (extended)

After building git inputs:
- map DB videos → existing `VideoInput`, concatenate with git videos;
- for each DB paper, generate a signed URL via the admin client
  (`createSignedUrl(storage_path, 3600)`) and build a `PaperInput`;
- pass `papers` to `buildArchiveItems`.
Signed-URL generation lives here (async, service-role) so `build.ts` stays
pure. Runs only when `canViewCourse` already passed (loader is only called in
the gated branch).

### `src/lib/archive/types.ts` + `build.ts` (extended, still pure + tested)

- `ArchiveItem` gains optional `fileUrl?: string` and `fileName?: string`.
- New `PaperInput { id, course, kind: 'exam'|'assignment', title, semester,
  covers, fileUrl, fileName }`.
- `buildArchiveItems` gains a `papers: PaperInput[]` param; each paper becomes
  an `exam`/`assignment` `ArchiveItem` with `href: ''`, `fileUrl`/`fileName`
  set, `units` resolved from `covers` (same resolution as quiz `covers`),
  `searchText` from title + units.
- `deriveFacets` / `filterItems` unchanged (they key off
  type/semester/unit/lesson/searchText, present on both exam flavors).

### `src/components/archive/ArchiveBrowser.tsx` (extended)

For an item with `fileUrl`, render a "View / download (PDF)" link
(`href={fileUrl}` target=_blank) instead of the interactive-quiz link. Title +
type + semester chrome unchanged. (Two exam flavors coexist: interactive quiz
git exams link to `/practice/<slug>`; file papers link to the signed URL.)

## Instructor hub + APIs

Mirrors the workshop hub conventions: plain `<form>` (no-JS friendly),
service-role writes, `isStaff` + ownership gate, error-redirect to the
originating page (convention #16), not the API URL.

### Pages

- `src/pages/instructor/archive/index.astro` — pick a course you teach; list
  its archive items (videos + papers). Your rows (`created_by === you`) show
  edit / hide / delete controls; others' rows are read-only. Admins see/manage
  all. Includes "Add video" (ECO only) and "Add paper" forms. Lesson dropdowns
  populated from the content collection so only valid `lesson_slug`/`covers`
  can be chosen.
- `src/pages/instructor/archive/[type]/[id].astro` — pre-filled edit form for
  one video or paper (`type ∈ {video, paper}`); ownership-gated.
- Link an "Archive content" card from `src/pages/instructor/index.astro`.

### APIs (`src/pages/api/instructor/archive/`)

- `video/create.ts`, `video/update.ts`, `video/delete.ts` (form-data).
- `paper/create.ts` (**multipart**: parse file + fields; validate
  `content_type ∈ {application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document}`
  and `size ≤ 25 MB`; sanitize filename; upload to Storage via service-role;
  insert row), `paper/update.ts` (metadata; optional file replace),
  `paper/delete.ts` (soft-delete; file retained).
- Every handler: `isStaff(role)` → `instructorOwnsCourse(...)` for create;
  additionally `created_by === user.id` (or admin) for update/delete. On
  violation or bad input, error-redirect to the page with `?error=`.
- Publish/hide folds into `update` (a `published` checkbox); the list offers a
  quick toggle form posting `update`.

### Access helpers

- Extend `src/lib/archive/access.ts` with `instructorOwnsCourse(admin, userId,
  courseSlug): Promise<boolean>` (admins via `isAdmin` short-circuit true;
  else `enrollments.instructor_id === userId` for that course) — the same
  check `api/instructor/workshops/open.ts` performs.
- `src/lib/instructor/archive-manage.ts` (service-role) loads the hub data
  (manageable courses + their items). A **pure, alias-free** helper
  `partitionByOwnership(items, { userId, role })` → `{ editable, readOnly }`
  lives in a separate testable module per CLAUDE.md (`node --test`).

## Upload validation + security

- Allowed types: PDF and docx; max 25 MB; filename sanitized to
  `[a-zA-Z0-9._-]`; stored under a per-paper UUID path so names can't collide
  or traverse.
- Files private; signed URLs (1h) only generated server-side inside gated
  paths; `storage_path` never serialized to the client.
- All writes service-role + app-side ownership; tables RLS-locked.
- Convention #5: missing Supabase/admin env → instructor hub shows a setup
  notice; archive read path degrades to git-only (no throw).

## Error / edge handling

- Bad upload (type/size) → error-redirect banner; no row, no orphan file.
- Upload succeeds but row insert fails → delete the just-uploaded object
  (no orphan) before error-redirect.
- Unknown `lesson_slug` / `covers` entry → rejected at create/update.
- Soft-deleted or unpublished rows excluded from the loader.
- DB/storage transient error in the loader → caught, that source contributes
  no items (git content still renders).

## Testing / verification

1. `node --test 'src/lib/**/*.test.ts'` — extend `build.test.ts` for the
   `papers` param (file-exam items: `href` empty, `fileUrl`/`fileName` set,
   units from covers); unit-test `partitionByOwnership`.
2. `npm run typecheck`, `npm run format`.
3. `npm run build` (placeholder env).
4. Re-run `supabase/schema.sql` in a scratch project; confirm RLS still blocks
   direct cross-user/anon reads and `schema-roundtrip` CI passes.
5. Manual matrix: instructor add/edit/hide/delete (own course + own row),
   non-owner instructor blocked, TA read-only, admin all; student sees
   published items; signed URL opens then expires; FIN has no video form;
   `/instructor/archive` gated to staff.

## Phasing (one spec, two implementation plans)

- **Phase 1 — Videos (no Storage):** `archive_videos` table + RLS + types;
  `db.ts` video fetch; loader merge for videos; `instructorOwnsCourse` +
  `partitionByOwnership`; instructor hub index + edit page + `video/*` APIs;
  "Archive content" card; tests. Ships: ECO instructors manage videos
  in-browser; students see them.
- **Phase 2 — File papers + Storage:** `archive-papers` bucket;
  `archive_papers` table + RLS + types; multipart `paper/create` + validation +
  orphan cleanup; signed-URL generation in loader; `ArchiveItem.fileUrl` +
  island download UI; `paper/{update,delete}`; tests.

Phase 1's plan is written first.

## Surface-area summary

- **New:** `archive_videos` + `archive_papers` tables + RLS (schema.sql);
  `archive-papers` Storage bucket; `src/lib/archive/db.ts`;
  `src/lib/instructor/archive-manage.ts` + a pure ownership-partition module;
  instructor pages under `src/pages/instructor/archive/`; APIs under
  `src/pages/api/instructor/archive/`.
- **Modified:** `src/lib/archive/{types,build,load,access}.ts`;
  `src/components/archive/ArchiveBrowser.tsx`;
  `src/pages/instructor/index.astro`; `database.types.ts`.
- **Unchanged:** the read-only archive's git content path, lessons,
  interactive-quiz exams, `/practice` gating, the quiz grade API.
