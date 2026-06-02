# Instructor single-student enrollment CRUD

**Date:** 2026-06-02
**Status:** Approved (brainstorming → ready for implementation plan)
**Roadmap:** class-management "next" step (enrollment CRUD, before gradebook).

## Goal

Let staff who own a course add, drop, and edit individual students on the
class roster page, complementing the existing bulk CSV import.

## Non-goals

- No invite/signup flow: adding a student requires an existing account
  (matched by email), exactly like the bulk import. Unknown email is rejected.
  (Email is deferred to Aug 2026, so there's no invite-email path anyway.)
- No schema change: reuses existing `enrollments` columns.
- No editing of the matched account/email; "edit" only changes
  `student_name` / `section` (the same columns the import writes).
- No soft-delete: drop is a hard delete of the enrollment row (the student's
  account, progress, and quiz attempts remain; only the course association is
  removed).
- No gradebook (separate, later roadmap item).

## Decisions (from interview)

| Dimension | Decision |
|---|---|
| Operations | add + drop + edit (section / display-name) |
| Add semantics | match email to an existing account (like import); unknown → reject |
| Permissions | `isStaff` (instructor/ta/admin) + course ownership (admin: any) — same gate as the bulk import |
| Drop | hard delete of one `(user_id, course_slug, semester)` row |
| instructor_id | enroll preserves an existing `instructor_id` (never reassigns another instructor's student); new row → self |
| Home | the class roster page `/instructor/classes/[course]` (per the viewed semester) |
| Audit | new `manage_enrollment` action via `logDisclosureSafe` |

## Data model

No migration. The `enrollments` table already has:
`user_id, course_slug, instructor_id, semester, enrolled_at, student_name,
section` (PK `(user_id, course_slug, semester)`). All three operations key on
`(user_id, course_slug, semester)`.

## APIs (`src/pages/api/instructor/classes/`)

All are form-handlers (plain `<form>`, no-JS), gate
`!user → unauthenticated`, `!isStaff(role) → forbidden`,
`instructorOwnsCourse(user.id, course, role) → not_course_instructor` (admin
bypasses ownership inside the helper), use the service-role admin client, and
error-redirect to the **roster page** (convention #16), not the API URL:
`/instructor/classes/<course>?semester=<encoded sem>&error=<reason>`; success
→ `?ok=<reason>`. Each calls `logDisclosureSafe` on success (fail-open).

- **`enroll.ts`** — form: `course_slug, semester, email, student_name?,
  section?`. Match `email` (lowercased) against `listAllAuthUsers()`
  (`@lib/supabase/admin`). No match → `?error=no_account`. If a row already
  exists for `(user_id, course_slug, semester)` → idempotent
  `?ok=already_enrolled` (no change to its `instructor_id`). Else insert
  `{ user_id, course_slug, semester, instructor_id: user.id, student_name,
  section }`. Audit `manage_enrollment` / `op: 'enroll'`, `targetUserId`,
  metadata `{ op, course, semester }`. Success `?ok=enrolled`.
- **`drop.ts`** — form: `course_slug, semester, user_id`. Hard
  `delete().eq(user_id).eq(course_slug).eq(semester)`. Audit `op: 'drop'`.
  Success `?ok=dropped`.
- **`update.ts`** — form: `course_slug, semester, user_id, student_name?,
  section?`. `update({ student_name, section })` on the row (does NOT touch
  `instructor_id`/`semester`/`user_id`). Audit `op: 'update'`. Success
  `?ok=updated`.

`section` is validated against the course's allowed sections where the course
uses them (ECO: `CML|CTL|CWL|CRL`; FIN: none) — reuse the same
`COURSES_WITH_SECTIONS` notion as `api/instructor/workshops/open.ts`; an empty
/ omitted section stores `null`. Invalid section → `?error=invalid_section`.

## Pure helper (`src/lib/instructor/enroll-classify.ts`)

Alias-free, `node --test`:
```ts
export type EnrollOutcome = 'no_account' | 'already_enrolled' | 'ok';
export function classifyEnroll(input: {
  emailFound: boolean;
  alreadyEnrolled: boolean;
}): EnrollOutcome;
```
Returns `'no_account'` if `!emailFound`, else `'already_enrolled'` if
`alreadyEnrolled`, else `'ok'`. The `enroll.ts` handler uses it to decide the
redirect/branch (keeps the decision logic unit-tested and the handler thin).

## UI (roster page + RosterTable)

- `src/pages/instructor/classes/[course].astro`: compute
  `canManage = isStaff(role) && (isAdmin(role) || ownsCourse)` (ownsCourse from
  the existing instructor-courses resolution on the page). Render an **"Add a
  student"** `<form>` (email, optional display-name, optional section select)
  posting to `/api/instructor/classes/enroll` with hidden `course_slug` +
  `semester`. Render an `?ok=`/`?error=` banner with humanized messages (same
  pattern as the archive hub). Forms render only when `canManage`.
- `src/components/instructor/RosterTable.astro`: accept new props `course`,
  `semester`, `canManage`. For each student row, when `canManage`, add a
  **Remove** control (a `<form>` posting to `/api/instructor/classes/drop`
  with hidden `user_id`/`course_slug`/`semester`, with an
  `onsubmit="return confirm(...)"`) and an **Edit** affordance for
  `section`/`student_name` (a small per-row `<form>` posting to
  `/api/instructor/classes/update`). Read-only viewers (or non-managers) see
  the table unchanged.

## Audit

Add `'manage_enrollment'` to `DisclosureAction` (`src/lib/audit.ts`). Each
handler logs on success via `logDisclosureSafe` with `actorId = user.id`,
`actorRole = role` (cast `'instructor'|'ta'|'admin'`), `action =
'manage_enrollment'`, `targetUserId`, `targetResource` a readable summary
(e.g. `"enroll student in eco-1002 (Fall 2025)"`), `metadata = { op, course,
semester }`. `request` for HMAC'd IP/UA. (`actorRole` includes `'ta'` here
since TAs may manage — unlike archive content, so DO NOT cast to only
`'instructor'|'admin'`; the `DisclosureContext.actorRole` type already allows
`'ta'`.)

## Errors / edges

- Unknown email → `no_account` banner.
- Already enrolled → idempotent `already_enrolled` notice (not an error);
  existing `instructor_id` preserved.
- Drop of a non-existent row → treat as success/no-op (or `not_found`); either
  is acceptable since the end state (not enrolled) is achieved — use
  `?ok=dropped` for idempotency.
- Invalid section for a sectioned course → `invalid_section`.
- Missing required fields (email/user_id) → `invalid_input`.
- Supabase/admin env missing → `getAdminClient` throws → handler returns
  `?error=...` (no crash); roster page itself already requires Supabase.
- Cross-course: gated by `instructorOwnsCourse`; a non-owner staff member is
  rejected `not_course_instructor`.

## Testing / verification

1. `node --test 'src/lib/**/*.test.ts'` — `classifyEnroll` unit tests
   (no_account / already_enrolled / ok).
2. `npm run typecheck`, `npm run format`.
3. `npm run build` (placeholder env) — routes emit.
4. `schema-roundtrip` unaffected (no schema change).
5. Manual matrix (`npm run dev`, real Supabase): instructor adds a student by
   a known email → appears on the roster; add unknown email → `no_account`;
   add an already-enrolled student → `already_enrolled` (instructor_id
   unchanged); edit section/name → reflected; drop → removed from roster;
   TA (staff) of the course can do all three; a staff member who doesn't own
   the course → `not_course_instructor`; admin → any course; each action
   produces a `manage_enrollment` row in `/admin`.

## Surface-area summary

- **New:** `src/pages/api/instructor/classes/{enroll,drop,update}.ts`;
  `src/lib/instructor/enroll-classify.ts` + test.
- **Modified:** `src/lib/audit.ts` (`manage_enrollment`);
  `src/pages/instructor/classes/[course].astro` (add-form + banner +
  `canManage` + pass props); `src/components/instructor/RosterTable.astro`
  (per-row Remove/Edit when `canManage`).
- **Unchanged:** the `enrollments` schema, the bulk CSV import, the roster
  loader/at-risk logic, RLS.
