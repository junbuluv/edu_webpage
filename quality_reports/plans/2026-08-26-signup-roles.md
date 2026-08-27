# Plan: role selection + student ID at signup, admin approval for staff

Interview (2026-08-26): pending staff get **student-level access plus a
banner**; student IDs are **HMAC'd** (convention #9) with last-4 shown to
staff; approvals happen in a **queue on /admin with an email alert**.

Security frame: today `profiles.role` is SQL-only by design. A self-chosen
role at signup must therefore never write `profiles.role` directly. Signup
records a _request_; only an admin decision mutates the role. Requests are
constrained to `instructor` / `ta` at the database level, so `admin` can
never be requested even if the form is forged.

## Schema (`supabase/schema.sql`, idempotent)

- `profiles.student_id_hmac text` + partial unique index (where not null), so
  two accounts cannot claim the same EMPLID.
- `role_requests`: PK `user_id` (one open request per person, re-request
  overwrites), `requested_role user_role` checked in ('instructor','ta'),
  `status` in ('pending','approved','denied'), `requested_at`, `decided_by`,
  `decided_at`, `note`. RLS: self-read own row, admin reads all; no client
  writes (service-role only). Index on (status, requested_at desc).

## Pure, alias-free logic (unit-tested per convention #3)

- `src/lib/auth/signup-role.ts`
  - `isSignupRole`, `normalizeStudentId` (strip `#`, spaces, dashes),
    `validateStudentId` (exactly 8 digits — verified against all 85 rows of
    the real Fall 2026 roster), `classifySignup({role, studentId})` →
    `ok | student_id_required | student_id_invalid | invalid_role`.
- `src/lib/admin/role-decision.ts`
  - `classifyRoleDecision({exists, status, currentRole, decision})` →
    `ok | not_found | already_decided | cannot_modify_admin`.

## Signup

- `signup.astro`: role radios (Student / Lecturer / Teaching assistant),
  conditional Student ID field (visible by default, hidden by a small inline
  script when a staff role is picked, so it degrades gracefully without JS),
  and a note that staff access needs admin approval.
- `api/auth/signup.ts`: validate via the pure module; pre-check the student-ID
  hash for duplicates; `signUp` as today; then, using the service role:
  - guard on `data.user.identities?.length` so the obfuscated
    already-registered response never writes rows for a fake id;
  - students: set `student_id_hmac`;
  - staff: upsert a pending `role_requests` row and email the admins.

## Admin approval

- `/admin` gains a "Staff access requests" section listing pending requests
  (email, requested role, when) with Approve / Deny.
- `api/admin/role-request.ts` (operation=approve|deny): admin-gated, mirrors
  `assign-role.ts` (self-gating, redirect-to-page per convention #16),
  audit-logged via the existing `promote_role` action with
  `metadata: { via: 'request' }`.
- Approve sets `profiles.role` to the requested role; deny only records the
  decision. Neither can touch an admin.

## Notification

- `src/lib/email/notify.ts`: Resend REST send to every admin's address,
  fail-open (console.error) when `RESEND_API_KEY` is unset or the call fails,
  so a mail outage can never break signup. Requires adding `RESEND_API_KEY`
  to Vercel env.

## Pending banner

- Dashboard-only (not BaseLayout) so no extra query runs on every page load.

## Deliberately out of scope

- Matching students to roster rows by student ID at import time. It is a
  genuine win (a student who falls back to Gmail still matches), but it needs
  a `student_id` column in the import CSV and its own tests. Follow-up PR.

## Verify

typecheck; `node --test` (both new modules); build; apply schema to prod;
deploy; then live: student signup writes a hash, staff signup appears in the
queue, approve flips the role, deny does not.
