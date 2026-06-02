# Enrollment CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff who own a course can add, drop, and edit individual students on the class roster page, complementing the bulk CSV import.

**Architecture:** Three no-JS form-handler APIs (`enroll`/`drop`/`update`) under `src/pages/api/instructor/classes/`, each gating `isStaff` + `instructorOwnsCourse` (admin bypass), writing via the service-role admin client, error-redirecting to the roster page (#16), and audit-logging a new `manage_enrollment` action. The roster page gets an "Add a student" form + banner; `RosterTable.astro` gets per-row Remove/Edit controls. No schema change.

**Tech Stack:** Astro 5 SSR, Supabase service-role admin client, `node --test`.

**Spec:** `docs/superpowers/specs/2026-06-02-enrollment-crud-design.md`.

---

## File Structure

**Create:**
- `src/lib/instructor/enroll-classify.ts` — pure `classifyEnroll` + test.
- `src/pages/api/instructor/classes/enroll.ts`
- `src/pages/api/instructor/classes/drop.ts`
- `src/pages/api/instructor/classes/update.ts`

**Modify:**
- `src/lib/audit.ts` — add `'manage_enrollment'` to `DisclosureAction`.
- `src/lib/instructor/class-roster.ts` — add `section` to `RosterStudent` + its loader query.
- `src/pages/instructor/classes/[course].astro` — add-student form, ok/error banner, `canManage`, pass `course`/`semester`/`canManage` to `RosterTable`.
- `src/components/instructor/RosterTable.astro` — per-row Remove + Edit controls.

**Unchanged:** `enrollments` schema, bulk import, roster at-risk logic, RLS.

---

## Task 1: Pure `classifyEnroll` helper

**Files:** Create `src/lib/instructor/enroll-classify.ts` + `src/lib/instructor/enroll-classify.test.ts`.

- [ ] **Step 1: Failing test** — `src/lib/instructor/enroll-classify.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyEnroll } from './enroll-classify.ts';

test('no account when email not found', () => {
  assert.equal(classifyEnroll({ emailFound: false, alreadyEnrolled: false }), 'no_account');
  assert.equal(classifyEnroll({ emailFound: false, alreadyEnrolled: true }), 'no_account');
});
test('already enrolled when found + existing row', () => {
  assert.equal(classifyEnroll({ emailFound: true, alreadyEnrolled: true }), 'already_enrolled');
});
test('ok when found + not enrolled', () => {
  assert.equal(classifyEnroll({ emailFound: true, alreadyEnrolled: false }), 'ok');
});
```

- [ ] **Step 2: Run → FAIL** — `node --test src/lib/instructor/enroll-classify.test.ts`.

- [ ] **Step 3: Implement** — `src/lib/instructor/enroll-classify.ts`:
```ts
export type EnrollOutcome = 'no_account' | 'already_enrolled' | 'ok';

/**
 * Decide the outcome of a single-student enroll attempt. Pure so the API
 * handler stays thin and this branching is unit-tested.
 * - email not matched to an account -> 'no_account'
 * - matched but already enrolled for this course+semester -> 'already_enrolled'
 * - matched and not yet enrolled -> 'ok' (proceed to insert)
 */
export function classifyEnroll(input: {
  emailFound: boolean;
  alreadyEnrolled: boolean;
}): EnrollOutcome {
  if (!input.emailFound) return 'no_account';
  if (input.alreadyEnrolled) return 'already_enrolled';
  return 'ok';
}
```

- [ ] **Step 4: Run → PASS** — `node --test src/lib/instructor/enroll-classify.test.ts` (3 pass). `npm run format`.
- [ ] **Step 5: Commit** — `git add src/lib/instructor/enroll-classify.ts src/lib/instructor/enroll-classify.test.ts && git commit -m "feat(enrollment): pure classifyEnroll helper with tests"`

---

## Task 2: `manage_enrollment` audit action

**Files:** Modify `src/lib/audit.ts`.

- [ ] **Step 1:** Add `'manage_enrollment'` to the `DisclosureAction` union (alongside `'import_roster'` etc.).
- [ ] **Step 2: Verify** — `npm run typecheck` → 0 errors.
- [ ] **Step 3: Commit** — `git add src/lib/audit.ts && git commit -m "feat(audit): add manage_enrollment disclosure action"`

---

## Task 3: `enroll.ts` API

**Files:** Create `src/pages/api/instructor/classes/enroll.ts`.

- [ ] **Step 1: Implement** —
```ts
import type { APIRoute } from 'astro';
import { getAdminClient, listAllAuthUsers } from '@lib/supabase/admin';
import { isStaff } from '@lib/roles';
import { isCourseSlug } from '@lib/courses';
import { instructorOwnsCourse } from '@lib/archive/access';
import { classifyEnroll } from '@lib/instructor/enroll-classify';
import { logDisclosureSafe } from '@lib/audit';

const SECTIONS = new Set(['CML', 'CTL', 'CWL', 'CRL']);
const COURSES_WITH_SECTIONS = new Set(['eco-1002']);

function redirect(course: string, semester: string, qs: string): Response {
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/instructor/classes/${course}?semester=${encodeURIComponent(semester)}&${qs}`,
    },
  });
}
const err = (c: string, s: string, reason: string) =>
  redirect(c, s, `error=${encodeURIComponent(reason)}`);
const ok = (c: string, s: string, reason: string) =>
  redirect(c, s, `ok=${encodeURIComponent(reason)}`);

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  const role = locals.profile?.role ?? 'student';

  const form = await request.formData();
  const course = String(form.get('course_slug') ?? '');
  const semester = String(form.get('semester') ?? '');
  const email = String(form.get('email') ?? '')
    .trim()
    .toLowerCase();
  const studentName = String(form.get('student_name') ?? '').trim() || null;
  const rawSection = String(form.get('section') ?? '').trim();

  // Build redirect targets defensively even on bad input.
  const fail = (reason: string) =>
    course && isCourseSlug(course)
      ? err(course, semester, reason)
      : new Response(null, { status: 303, headers: { Location: '/instructor/classes' } });

  if (!user) return fail('unauthenticated');
  if (!isStaff(role)) return fail('forbidden');
  if (!isCourseSlug(course) || !semester) return fail('invalid_input');
  if (!(await instructorOwnsCourse(user.id, course, role)))
    return fail('not_course_instructor');
  if (!email) return fail('invalid_input');

  const usesSections = COURSES_WITH_SECTIONS.has(course);
  let section: string | null = null;
  if (usesSections && rawSection) {
    if (!SECTIONS.has(rawSection)) return err(course, semester, 'invalid_section');
    section = rawSection;
  }

  const admin = getAdminClient();
  const users = await listAllAuthUsers();
  const userId = users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;

  let alreadyEnrolled = false;
  if (userId) {
    const { data } = await admin
      .from('enrollments')
      .select('user_id')
      .eq('user_id', userId)
      .eq('course_slug', course)
      .eq('semester', semester)
      .maybeSingle();
    alreadyEnrolled = !!data;
  }

  const outcome = classifyEnroll({ emailFound: !!userId, alreadyEnrolled });
  if (outcome === 'no_account') return err(course, semester, 'no_account');
  if (outcome === 'already_enrolled') return ok(course, semester, 'already_enrolled');

  const { error } = await admin.from('enrollments').insert({
    user_id: userId!,
    course_slug: course,
    semester,
    instructor_id: user.id,
    student_name: studentName,
    section,
  });
  if (error) return err(course, semester, 'insert_failed');

  await logDisclosureSafe({
    actorId: user.id,
    actorRole: role as 'instructor' | 'ta' | 'admin',
    action: 'manage_enrollment',
    targetUserId: userId!,
    targetResource: `enroll student in ${course} (${semester})`,
    metadata: { op: 'enroll', course, semester },
    request,
  });
  return ok(course, semester, 'enrolled');
};
```

- [ ] **Step 2: Verify** — `npm run typecheck` → 0 errors; `npm run format`; build (`PUBLIC_SUPABASE_URL=https://placeholder.supabase.co PUBLIC_SUPABASE_ANON_KEY=placeholder PUBLIC_SITE_URL=http://localhost:4321 npm run build`) → PASS.
- [ ] **Step 3: Commit** — `git add src/pages/api/instructor/classes/enroll.ts && git commit -m "feat(enrollment): gated enroll API (match email, preserve instructor_id, audit)"`

---

## Task 4: `drop.ts` API

**Files:** Create `src/pages/api/instructor/classes/drop.ts`.

- [ ] **Step 1: Implement** —
```ts
import type { APIRoute } from 'astro';
import { getAdminClient } from '@lib/supabase/admin';
import { isStaff } from '@lib/roles';
import { isCourseSlug } from '@lib/courses';
import { instructorOwnsCourse } from '@lib/archive/access';
import { logDisclosureSafe } from '@lib/audit';

function redirect(course: string, semester: string, qs: string): Response {
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/instructor/classes/${course}?semester=${encodeURIComponent(semester)}&${qs}`,
    },
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  const role = locals.profile?.role ?? 'student';
  const form = await request.formData();
  const course = String(form.get('course_slug') ?? '');
  const semester = String(form.get('semester') ?? '');
  const userId = String(form.get('user_id') ?? '');

  const fail = (reason: string) =>
    course && isCourseSlug(course)
      ? redirect(course, semester, `error=${encodeURIComponent(reason)}`)
      : new Response(null, { status: 303, headers: { Location: '/instructor/classes' } });

  if (!user) return fail('unauthenticated');
  if (!isStaff(role)) return fail('forbidden');
  if (!isCourseSlug(course) || !semester || !userId) return fail('invalid_input');
  if (!(await instructorOwnsCourse(user.id, course, role)))
    return fail('not_course_instructor');

  const admin = getAdminClient();
  const { error } = await admin
    .from('enrollments')
    .delete()
    .eq('user_id', userId)
    .eq('course_slug', course)
    .eq('semester', semester);
  if (error) return fail('delete_failed');

  await logDisclosureSafe({
    actorId: user.id,
    actorRole: role as 'instructor' | 'ta' | 'admin',
    action: 'manage_enrollment',
    targetUserId: userId,
    targetResource: `drop student from ${course} (${semester})`,
    metadata: { op: 'drop', course, semester },
    request,
  });
  return redirect(course, semester, 'ok=dropped');
};
```

- [ ] **Step 2: Verify** — `npm run typecheck`; `npm run format`; build (placeholder env). PASS.
- [ ] **Step 3: Commit** — `git add src/pages/api/instructor/classes/drop.ts && git commit -m "feat(enrollment): gated drop API (hard delete + audit)"`

---

## Task 5: `update.ts` API

**Files:** Create `src/pages/api/instructor/classes/update.ts`.

- [ ] **Step 1: Implement** —
```ts
import type { APIRoute } from 'astro';
import { getAdminClient } from '@lib/supabase/admin';
import { isStaff } from '@lib/roles';
import { isCourseSlug } from '@lib/courses';
import { instructorOwnsCourse } from '@lib/archive/access';
import { logDisclosureSafe } from '@lib/audit';

const SECTIONS = new Set(['CML', 'CTL', 'CWL', 'CRL']);
const COURSES_WITH_SECTIONS = new Set(['eco-1002']);

function redirect(course: string, semester: string, qs: string): Response {
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/instructor/classes/${course}?semester=${encodeURIComponent(semester)}&${qs}`,
    },
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  const role = locals.profile?.role ?? 'student';
  const form = await request.formData();
  const course = String(form.get('course_slug') ?? '');
  const semester = String(form.get('semester') ?? '');
  const userId = String(form.get('user_id') ?? '');
  const studentName = String(form.get('student_name') ?? '').trim() || null;
  const rawSection = String(form.get('section') ?? '').trim();

  const fail = (reason: string) =>
    course && isCourseSlug(course)
      ? redirect(course, semester, `error=${encodeURIComponent(reason)}`)
      : new Response(null, { status: 303, headers: { Location: '/instructor/classes' } });

  if (!user) return fail('unauthenticated');
  if (!isStaff(role)) return fail('forbidden');
  if (!isCourseSlug(course) || !semester || !userId) return fail('invalid_input');
  if (!(await instructorOwnsCourse(user.id, course, role)))
    return fail('not_course_instructor');

  let section: string | null = null;
  if (COURSES_WITH_SECTIONS.has(course) && rawSection) {
    if (!SECTIONS.has(rawSection)) return fail('invalid_section');
    section = rawSection;
  }

  const admin = getAdminClient();
  const { error } = await admin
    .from('enrollments')
    .update({ student_name: studentName, section })
    .eq('user_id', userId)
    .eq('course_slug', course)
    .eq('semester', semester);
  if (error) return fail('update_failed');

  await logDisclosureSafe({
    actorId: user.id,
    actorRole: role as 'instructor' | 'ta' | 'admin',
    action: 'manage_enrollment',
    targetUserId: userId,
    targetResource: `update student in ${course} (${semester})`,
    metadata: { op: 'update', course, semester },
    request,
  });
  return redirect(course, semester, 'ok=updated');
};
```

- [ ] **Step 2: Verify** — `npm run typecheck`; `npm run format`; build (placeholder env). PASS.
- [ ] **Step 3: Commit** — `git add src/pages/api/instructor/classes/update.ts && git commit -m "feat(enrollment): gated update API (student_name/section + audit)"`

---

## Task 6: Add `section` to `RosterStudent`

**Files:** Modify `src/lib/instructor/class-roster.ts`.

- [ ] **Step 1:** In the `RosterStudent` interface, add `section: string | null;` (after `name`).
- [ ] **Step 2:** The roster loader's second enrollments query currently is `.from('enrollments').select('user_id, instructor_id, student_name')`. Change it to `.select('user_id, instructor_id, student_name, section')`. Build a `sectionById` map alongside the existing `registrarNameById`: where the code does `registrarNameById.set(r.user_id, r.student_name ?? null)`, add `sectionById.set(r.user_id, r.section ?? null)` (declare `const sectionById = new Map<string, string | null>()` next to `registrarNameById`).
- [ ] **Step 3:** In the `students = userIds.map((id) => { ... return { userId: id, name: ..., email: ..., ... } })`, add `section: sectionById.get(id) ?? null,` to the returned object.
- [ ] **Step 4: Verify** — `npm run typecheck` (0 errors); `node --test 'src/lib/**/*.test.ts'` (roster-csv tests still pass; they don't depend on `section`).
- [ ] **Step 5: Commit** — `git add src/lib/instructor/class-roster.ts && git commit -m "feat(enrollment): expose section on RosterStudent for inline editing"`

---

## Task 7: Roster page — add-student form + banner + canManage

**Files:** Modify `src/pages/instructor/classes/[course].astro`.

- [ ] **Step 1:** In the frontmatter, after `const courseCode = ...` and `const semesterQs = ...`, add:
```ts
import { isStaff } from '@lib/roles';
// canManage: the viewer reached this roster (loadClassRoster already enforced
// ownership / admin), so any staff here may manage enrollments.
const canManage = isStaff(role);
const okMsg = Astro.url.searchParams.get('ok');
const errMsg = Astro.url.searchParams.get('error');
const ENROLL_OK: Record<string, string> = {
  enrolled: 'Student added.',
  already_enrolled: 'That student is already enrolled.',
  dropped: 'Student removed.',
  updated: 'Student updated.',
};
const ENROLL_ERR: Record<string, string> = {
  no_account: 'No account found for that email. The student must sign up first.',
  not_course_instructor: 'You are not an instructor for this course.',
  forbidden: 'You do not have permission to manage this roster.',
  invalid_input: 'Some required fields were missing.',
  invalid_section: 'That section is not valid for this course.',
  insert_failed: 'Could not add the student. Please try again.',
  update_failed: 'Could not save changes. Please try again.',
  delete_failed: 'Could not remove the student. Please try again.',
};
const okText = okMsg ? (ENROLL_OK[okMsg] ?? null) : null;
const errText = errMsg ? (ENROLL_ERR[errMsg] ?? null) : null;
const usesSections = course === 'eco-1002';
```
(`import { isStaff }` goes with the other imports at top; `isAdminRole` is already imported. Note this page's `?ok`/`?error` are the enrollment ones; the existing `?imported=` banner is separate and stays.)

- [ ] **Step 2:** Render the banner just after the `importSummary` block:
```astro
    {okText && (
      <div class="mt-4 rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">
        {okText}
      </div>
    )}
    {errText && (
      <div class="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        {errText}
      </div>
    )}
```

- [ ] **Step 3:** Add the "Add a student" form (only for managers) just above the `<nav … Filter>` block:
```astro
    {canManage && (
      <details class="mt-6 rounded-lg border border-slate-200 p-4">
        <summary class="cursor-pointer text-sm font-medium">Add a student</summary>
        <form
          method="POST"
          action="/api/instructor/classes/enroll"
          class="mt-3 flex flex-wrap items-end gap-3 text-sm"
        >
          <input type="hidden" name="course_slug" value={course} />
          <input type="hidden" name="semester" value={semester} />
          <label class="block">
            <span class="text-ink-muted">Student email</span>
            <input name="email" type="email" required class="mt-1 w-64 rounded border border-slate-300 px-2 py-1" />
          </label>
          <label class="block">
            <span class="text-ink-muted">Display name (optional)</span>
            <input name="student_name" class="mt-1 w-48 rounded border border-slate-300 px-2 py-1" />
          </label>
          {usesSections && (
            <label class="block">
              <span class="text-ink-muted">Section</span>
              <select name="section" class="mt-1 rounded border border-slate-300 px-2 py-1">
                <option value="">—</option>
                <option value="CML">CML</option>
                <option value="CTL">CTL</option>
                <option value="CWL">CWL</option>
                <option value="CRL">CRL</option>
              </select>
            </label>
          )}
          <button type="submit" class="rounded bg-accent px-3 py-1.5 font-medium text-white hover:bg-blue-700">
            Add
          </button>
        </form>
        <p class="mt-2 text-xs text-ink-muted">
          The student must already have an account (matched by email), same as
          the bulk import.
        </p>
      </details>
    )}
```

- [ ] **Step 4:** Pass the new props to `RosterTable` (both call sites — there's one, in the `visibleStudents.length === 0 ? … : <RosterTable …/>` ternary):
```astro
        <RosterTable
          students={visibleStudents}
          lessonsTotal={roster.lessonsTotal}
          course={course}
          semester={semester}
          usesSections={usesSections}
          canManage={canManage}
        />
```

- [ ] **Step 5: Verify** — `npm run typecheck`; `npm run format`; build (placeholder env) → PASS; confirm the page still renders (route emits).
- [ ] **Step 6: Commit** — `git add src/pages/instructor/classes/[course].astro && git commit -m "feat(enrollment): add-student form + banner on the roster page"`

---

## Task 8: RosterTable — per-row Remove + Edit

**Files:** Modify `src/components/instructor/RosterTable.astro`.

- [ ] **Step 1:** Extend `Props` and destructure:
```ts
interface Props {
  students: RosterStudent[];
  lessonsTotal: number;
  course: string;
  semester: string;
  usesSections: boolean;
  canManage: boolean;
}
const { students, lessonsTotal, course, semester, usesSections, canManage } = Astro.props;
const SECTION_OPTS = ['CML', 'CTL', 'CWL', 'CRL'];
```

- [ ] **Step 2:** Add a "Manage" column header (only when `canManage`). In the `<thead>` `<tr>`, after the `Flag` `<th>`:
```astro
        {canManage && <th class="px-3 py-2 font-medium">Manage</th>}
```

- [ ] **Step 3:** Add a manage cell per row. After the `Flag` `<td>` (the at-risk `<td>`), add:
```astro
            {canManage && (
              <td class="px-3 py-2">
                <details>
                  <summary class="cursor-pointer text-xs text-accent">Edit</summary>
                  <form
                    method="POST"
                    action="/api/instructor/classes/update"
                    class="mt-2 flex flex-col gap-1"
                  >
                    <input type="hidden" name="course_slug" value={course} />
                    <input type="hidden" name="semester" value={semester} />
                    <input type="hidden" name="user_id" value={s.userId} />
                    <input
                      name="student_name"
                      placeholder="Display name"
                      value={s.name ?? ''}
                      class="rounded border border-slate-300 px-1 py-0.5 text-xs"
                    />
                    {usesSections && (
                      <select
                        name="section"
                        class="rounded border border-slate-300 px-1 py-0.5 text-xs"
                      >
                        <option value="" selected={!s.section}>
                          —
                        </option>
                        {SECTION_OPTS.map((o) => (
                          <option value={o} selected={s.section === o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    )}
                    <button type="submit" class="rounded bg-accent px-2 py-0.5 text-xs text-white">
                      Save
                    </button>
                  </form>
                  <form
                    method="POST"
                    action="/api/instructor/classes/drop"
                    class="mt-2"
                    onsubmit="return confirm('Remove this student from the class?');"
                  >
                    <input type="hidden" name="course_slug" value={course} />
                    <input type="hidden" name="semester" value={semester} />
                    <input type="hidden" name="user_id" value={s.userId} />
                    <button type="submit" class="text-xs text-red-600 underline">
                      Remove
                    </button>
                  </form>
                </details>
              </td>
            )}
```

- [ ] **Step 4: Verify** — `npm run typecheck`; `npm run format`; build (placeholder env) → PASS.
- [ ] **Step 5: Commit** — `git add src/components/instructor/RosterTable.astro && git commit -m "feat(enrollment): per-row Edit/Remove controls in RosterTable"`

---

## Task 9: Full verification + final review

- [ ] **Step 1:** `node --test 'src/lib/**/*.test.ts'` (incl. classifyEnroll), `npm run typecheck`, `npm run format` (restore unrelated reformats if any), build (placeholder env). All pass.
- [ ] **Step 2: Manual matrix** (`npm run dev`, real Supabase; instructor owning a course + a known-email student account + a TA + admin):
  - Add a student by a known email → appears on the roster, `?ok=enrolled`.
  - Add an unknown email → `no_account` banner; no row created.
  - Add an already-enrolled student → `already_enrolled`; their `instructor_id` unchanged.
  - Edit a student's display-name / section → reflected on the roster.
  - Remove a student → gone from the roster, `?ok=dropped`.
  - TA (staff) of the course can do all three; a staff member who doesn't own the course → `not_course_instructor`; admin → any course.
  - Each action writes a `manage_enrollment` row visible in `/admin`.
- [ ] **Step 3:** Final review + PR titled `feat(enrollment): instructor single-student enroll/drop/edit on the roster`.

---

## Self-Review (completed during authoring)

- **Spec coverage:** classifyEnroll (T1); `manage_enrollment` (T2); enroll/drop/update APIs with isStaff+ownership gate, email match, instructor_id-preserve, section validation, audit (T3–T5); `section` on RosterStudent (T6); roster-page add-form + banner + canManage (T7); RosterTable Remove/Edit (T8); verification incl. the full permission/audit matrix (T9).
- **Placeholder scan:** none; complete code per step.
- **Type consistency:** `classifyEnroll` signature matches T3 usage; `instructorOwnsCourse(userId, course, role)` matches its definition; `RosterStudent.section` added in T6 is consumed in T8; redirect targets `/instructor/classes/<course>?semester=…&ok|error=` consistent across the 3 APIs + the page banner maps; `usesSections`/`canManage`/`course`/`semester` props threaded page→RosterTable.
- **Conventions:** form-handler + error-redirect to the page (#16); service-role + `instructorOwnsCourse` (#6); `isStaff` gate (TAs allowed, matching the bulk import); `logDisclosureSafe` fail-open with `actorRole` allowing `'ta'` (not narrowed to instructor|admin); pure logic alias-free + `node --test`. No schema change (drop is a hard delete on existing columns).
