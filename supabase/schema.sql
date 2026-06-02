-- Run this against your Supabase project (SQL editor or `supabase db push`).
-- Idempotent: safe to re-run.

create extension if not exists "pgcrypto";

-- =========================================================================
-- ENUMS
-- =========================================================================
do $$ begin
  create type user_role as enum ('student', 'instructor', 'admin');
exception when duplicate_object then null; end $$;

-- Add 'ta' to user_role if it isn't already present. ALTER TYPE ADD
-- VALUE cannot run inside an explicit transaction block, but
-- Supabase's SQL Editor runs statements outside one by default. If
-- you ever see "ALTER TYPE ... ADD cannot run inside a transaction
-- block", run this single statement on its own.
alter type user_role add value if not exists 'ta';

do $$ begin
  create type progress_status as enum ('started', 'completed');
exception when duplicate_object then null; end $$;

-- =========================================================================
-- profiles --- one row per auth.users entry, created via trigger
--
-- We do NOT duplicate the plaintext email into public.profiles. The
-- authoritative email lives in auth.users (managed by Supabase Auth).
-- This table stores an HMAC-SHA256 of the email for indexable lookups
-- ("has this email already signed up?") without exposing email in a
-- leak of just the public schema.
--
-- The HMAC secret is read at trigger-execution time from the database
-- session variable `app.pii_hmac_secret`. Set it once per project:
--
--     alter database postgres set app.pii_hmac_secret = 'your-32+ char secret';
--
-- The Vercel-side helper at src/lib/crypto/pii.ts must use the same
-- secret so signup/lookup HMACs agree.
-- =========================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email_hmac text,
  display_name text,
  role user_role not null default 'student',
  tos_accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- Idempotent migration: drop legacy plaintext email if it's still here.
alter table public.profiles drop column if exists email;
alter table public.profiles add column if not exists email_hmac text;
alter table public.profiles add column if not exists tos_accepted_at timestamptz;
alter table public.profiles add column if not exists active_course_slug text;

create unique index if not exists profiles_email_hmac_uq
  on public.profiles (email_hmac);

alter table public.profiles enable row level security;

drop policy if exists "profiles_self_read" on public.profiles;
create policy "profiles_self_read"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile row on new signup, computing email_hmac from
-- auth.users.email using the session-level secret.
--
-- TODO (deferred): migrate the secret read from current_setting() to
-- Supabase Vault. Hosted Supabase rejects `alter database postgres set
-- app.pii_hmac_secret = ...` with 42501 permission denied, so the
-- current_setting() call always returns NULL on hosted projects and
-- email_hmac is therefore NULL for every new signup. No code currently
-- reads email_hmac, so this is non-blocking — defer until a real need
-- surfaces (duplicate-account detection, roster-by-email import, etc.).
-- When that day comes:
--   1. create extension if not exists pgsodium;
--      create extension if not exists vault with schema vault;
--   2. select vault.create_secret('<PII_HMAC_SECRET value>',
--        'pii_hmac_secret', 'matches the env var in Vercel');
--   3. Replace the current_setting block below (and in
--      backfill_email_hmac) with:
--        select decrypted_secret into v_secret
--          from vault.decrypted_secrets where name = 'pii_hmac_secret'
--          limit 1;
--   4. select public.backfill_email_hmac();  -- one-time recompute
--   5. The dedup index already exists (profiles_email_hmac_uq) — at
--      that point it actually enforces something. Consider switching
--      to a partial index `where email_hmac is not null` so legacy
--      NULL rows don't collide.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
  v_hmac text;
begin
  -- Read the secret. If it isn't set, fall back to NULL so signup still
  -- works in dev (lookups by email_hmac will simply miss until the
  -- secret is configured and existing rows are back-filled).
  begin
    v_secret := current_setting('app.pii_hmac_secret', true);
  exception when others then
    v_secret := null;
  end;

  if v_secret is not null and length(v_secret) >= 32 and new.email is not null then
    v_hmac := encode(
      hmac(lower(trim(new.email)), v_secret, 'sha256'),
      'hex'
    );
  else
    v_hmac := null;
  end if;

  insert into public.profiles (id, email_hmac)
  values (new.id, v_hmac)
  on conflict (id) do update
    set email_hmac = coalesce(excluded.email_hmac, public.profiles.email_hmac);
  return new;
end;
$$;

-- Re-compute email_hmac for any existing rows that don't have one yet
-- (idempotent back-fill). Skips silently if the secret isn't configured.
create or replace function public.backfill_email_hmac()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
  v_count integer;
begin
  begin
    v_secret := current_setting('app.pii_hmac_secret', true);
  exception when others then
    v_secret := null;
  end;

  if v_secret is null or length(v_secret) < 32 then
    raise notice 'app.pii_hmac_secret not configured; skipping back-fill';
    return 0;
  end if;

  update public.profiles p
     set email_hmac = encode(hmac(lower(trim(u.email)), v_secret, 'sha256'), 'hex')
    from auth.users u
   where p.id = u.id
     and u.email is not null
     and p.email_hmac is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.backfill_email_hmac() from public;
-- Run manually as a one-off after first setting app.pii_hmac_secret:
--   select public.backfill_email_hmac();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================================
-- lesson_progress --- one row per (user, lesson)
-- =========================================================================
create table if not exists public.lesson_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_slug text not null,
  status progress_status not null default 'started',
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_slug)
);

alter table public.lesson_progress enable row level security;

drop policy if exists "lesson_progress_self_all" on public.lesson_progress;
create policy "lesson_progress_self_all"
  on public.lesson_progress for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =========================================================================
-- quiz_attempts --- append-only attempts log
-- =========================================================================
create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  quiz_slug text not null,
  score numeric not null,
  max_score numeric not null,
  answers jsonb not null,
  submitted_at timestamptz not null default now()
);

create index if not exists quiz_attempts_user_quiz_idx
  on public.quiz_attempts (user_id, quiz_slug, submitted_at desc);

alter table public.quiz_attempts enable row level security;

drop policy if exists "quiz_attempts_self_read" on public.quiz_attempts;
create policy "quiz_attempts_self_read"
  on public.quiz_attempts for select
  using (auth.uid() = user_id);

drop policy if exists "quiz_attempts_self_insert" on public.quiz_attempts;
create policy "quiz_attempts_self_insert"
  on public.quiz_attempts for insert
  with check (auth.uid() = user_id);

-- =========================================================================
-- enrollments --- which students an instructor may legitimately read.
--
-- FERPA's "school official" exception requires that staff access be scoped
-- to students they have a legitimate educational interest in (their own
-- courses). This table is the join: instructor_id must match the staff
-- member viewing the record.
-- =========================================================================
create table if not exists public.enrollments (
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_slug text not null,
  instructor_id uuid not null references public.profiles(id) on delete restrict,
  semester text not null,
  enrolled_at timestamptz not null default now(),
  primary key (user_id, course_slug, semester)
);

-- Roster identity (Phase 2 bulk import): registrar-provided name + section.
-- Nullable; populated by roster import. student_name is the authoritative
-- display name for instructor-facing roster views (it falls back to
-- profiles.display_name when null). section is the registrar section, if any.
alter table public.enrollments add column if not exists student_name text;
alter table public.enrollments add column if not exists section text;

create index if not exists enrollments_instructor_idx
  on public.enrollments (instructor_id, semester);
create index if not exists enrollments_course_idx
  on public.enrollments (course_slug, semester);

alter table public.enrollments enable row level security;

-- Student can read their own enrollments.
drop policy if exists "enrollments_self_read" on public.enrollments;
create policy "enrollments_self_read"
  on public.enrollments for select
  using (auth.uid() = user_id);

-- Instructor can read their own course rosters.
drop policy if exists "enrollments_instructor_read" on public.enrollments;
create policy "enrollments_instructor_read"
  on public.enrollments for select
  using (auth.uid() = instructor_id);

-- Admin read-all.
drop policy if exists "enrollments_admin_read" on public.enrollments;
create policy "enrollments_admin_read"
  on public.enrollments for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Only the service-role client can mutate enrollments (rosters come from
-- instructor uploads through /api/instructor/roster). No insert/update/delete
-- policies for regular roles.

-- Replace the permissive instructor-read policy on quiz_attempts with one
-- scoped by enrollment: an instructor sees attempts only for students they
-- have an active enrollment row for in the same course as the quiz.
-- We assume quiz_slug encodes the course as a prefix like "macro-..."; the
-- application layer is responsible for ensuring enrollment + quiz course
-- prefixes align. For now we scope by student-instructor relationship only.
-- Drop both the legacy short name and the current name so this block
-- is idempotent regardless of which version a project was last on.
drop policy if exists "quiz_attempts_instructor_read" on public.quiz_attempts;
drop policy if exists "quiz_attempts_instructor_read_scoped" on public.quiz_attempts;
create policy "quiz_attempts_instructor_read_scoped"
  on public.quiz_attempts for select
  using (
    exists (
      select 1
      from public.enrollments e
      join public.profiles p on p.id = auth.uid()
      where e.user_id = quiz_attempts.user_id
        and e.instructor_id = auth.uid()
        and p.role in ('instructor', 'ta', 'admin')
    )
  );

-- Same scoping for lesson_progress instructor reads (new policy, additive
-- to the existing student-self-all policy).
drop policy if exists "lesson_progress_instructor_read_scoped" on public.lesson_progress;
create policy "lesson_progress_instructor_read_scoped"
  on public.lesson_progress for select
  using (
    exists (
      select 1
      from public.enrollments e
      join public.profiles p on p.id = auth.uid()
      where e.user_id = lesson_progress.user_id
        and e.instructor_id = auth.uid()
        and p.role in ('instructor', 'ta', 'admin')
    )
  );

-- =========================================================================
-- audit_log --- record of staff disclosures (FERPA §99.32-style)
--
-- One row per administrator/instructor read of an individual student's
-- record. IP and user-agent are stored as HMAC(SHA-256, server_secret)
-- so a DB leak cannot enumerate them without the server-side key.
-- Inserts are performed via the service-role client; the table is RLS-on
-- so application code can never write to it directly.
-- =========================================================================
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role user_role,
  action text not null,
  target_user_id uuid,
  target_resource text,
  client_ip_hmac text,
  user_agent_hmac text,
  metadata jsonb,
  ts timestamptz not null default now()
);

create index if not exists audit_log_actor_ts_idx
  on public.audit_log (actor_id, ts desc);
create index if not exists audit_log_target_ts_idx
  on public.audit_log (target_user_id, ts desc);
create index if not exists audit_log_action_ts_idx
  on public.audit_log (action, ts desc);

alter table public.audit_log enable row level security;

-- The actor can read their own disclosure history (transparency).
drop policy if exists "audit_log_actor_self_read" on public.audit_log;
create policy "audit_log_actor_self_read"
  on public.audit_log for select
  using (auth.uid() = actor_id);

-- Admins can read all disclosures.
drop policy if exists "audit_log_admin_read" on public.audit_log;
create policy "audit_log_admin_read"
  on public.audit_log for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- No INSERT/UPDATE/DELETE policies => only the service-role client (which
-- bypasses RLS by design) may write.

-- =========================================================================
-- log_disclosure(action, target_user_id, target_resource, metadata) RPC
--
-- Called by the application layer (under the user's JWT) when an
-- instructor/admin is about to read another user's record. Runs with
-- definer rights to write the audit_log row even though no insert policy
-- exists for ordinary roles. Refuses to log for student-role actors so
-- it can't be misused as a write channel.
-- =========================================================================
create or replace function public.log_disclosure(
  p_action text,
  p_target_user_id uuid,
  p_target_resource text default null,
  p_metadata jsonb default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role user_role;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role is null or v_role = 'student' then
    raise exception 'log_disclosure: caller must be instructor, ta, or admin';
  end if;
  insert into public.audit_log (
    actor_id, actor_role, action, target_user_id, target_resource, metadata
  ) values (
    auth.uid(), v_role, p_action, p_target_user_id, p_target_resource, p_metadata
  );
end;
$$;

revoke all on function public.log_disclosure(text, uuid, text, jsonb) from public;
grant execute on function public.log_disclosure(text, uuid, text, jsonb) to authenticated;

-- =========================================================================
-- Retention jobs (pg_cron)
--
-- Two scheduled functions, both running as the database role and writing
-- an audit_log row for transparency:
--
--   purge_inactive_accounts()
--     Deletes auth.users rows whose last_sign_in_at is more than 24
--     months ago. Cascades through public.profiles (and from there
--     through lesson_progress, quiz_attempts, enrollments).
--
--   purge_old_quiz_attempts()
--     Deletes quiz_attempts whose submitted_at is more than 2 academic
--     years (730 days) old. lesson_progress is kept (it's keyed on
--     (user, lesson) so old rows are not multiplying).
--
-- Audit log: each run inserts a "system retention" audit_log row with
-- the count purged in metadata.count. actor_id is NULL because this is
-- system action, not staff action.
--
-- Scheduling:
--   purge_inactive_accounts  -> monthly, 1st @ 04:00 UTC
--   purge_old_quiz_attempts  -> weekly, Sunday @ 04:15 UTC
--
-- pg_cron is preinstalled on Supabase but the extension must be enabled
-- by the project owner (Database -> Extensions -> "pg_cron" -> Enable),
-- after which the cron.schedule(...) calls below succeed. Until then,
-- the function definitions still install and can be invoked manually.
-- =========================================================================

-- pg_cron must be enabled in Supabase Dashboard (Database -> Extensions).
-- Wrapping in a do-block so absence doesn't abort this whole migration;
-- the cron.schedule(...) calls below have their own per-block guards.
do $$ begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'Could not enable pg_cron from SQL (likely a permissions issue on hosted Postgres). Enable it via Dashboard -> Database -> Extensions, then re-run this script. Continuing without it.';
end $$;

create or replace function public.purge_inactive_accounts(p_months integer default 24)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_count integer;
  v_cutoff timestamptz := now() - (p_months || ' months')::interval;
begin
  with deleted as (
    delete from auth.users
     where last_sign_in_at is not null
       and last_sign_in_at < v_cutoff
    returning id
  )
  select count(*) into v_count from deleted;

  insert into public.audit_log (
    actor_id, actor_role, action, target_resource, metadata
  ) values (
    null, null, 'system_retention_purge_inactive', 'auth.users',
    jsonb_build_object('cutoff_months', p_months, 'count', v_count)
  );

  return v_count;
end;
$$;

create or replace function public.purge_old_quiz_attempts(p_days integer default 730)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_cutoff timestamptz := now() - (p_days || ' days')::interval;
begin
  with deleted as (
    delete from public.quiz_attempts
     where submitted_at < v_cutoff
    returning id
  )
  select count(*) into v_count from deleted;

  insert into public.audit_log (
    actor_id, actor_role, action, target_resource, metadata
  ) values (
    null, null, 'system_retention_purge_quiz_attempts', 'public.quiz_attempts',
    jsonb_build_object('cutoff_days', p_days, 'count', v_count)
  );

  return v_count;
end;
$$;

revoke all on function public.purge_inactive_accounts(integer) from public;
revoke all on function public.purge_old_quiz_attempts(integer) from public;

-- Schedule via pg_cron. Re-running cron.schedule with the same name is a
-- no-op if the schedule + command match; if they differ, the new
-- definition replaces the old one. We wrap in DO blocks so failures
-- (e.g. extension not enabled yet) don't abort the rest of the migration.
do $$ begin
  perform cron.schedule(
    'retention_purge_inactive_accounts',
    '0 4 1 * *',
    $cron$select public.purge_inactive_accounts();$cron$
  );
exception when others then
  raise notice 'pg_cron not available yet; skipping schedule for purge_inactive_accounts. Enable the extension and re-run this script.';
end $$;

do $$ begin
  perform cron.schedule(
    'retention_purge_old_quiz_attempts',
    '15 4 * * 0',
    $cron$select public.purge_old_quiz_attempts();$cron$
  );
exception when others then
  raise notice 'pg_cron not available yet; skipping schedule for purge_old_quiz_attempts. Enable the extension and re-run this script.';
end $$;

-- =========================================================================
-- Proctored exams: REMOVED.
--
-- The exam_administrations + exam_attempts tables were introduced when
-- FIN 3610 carried a midterm/final flow. The entire UI surface
-- (src/content/exams, src/pages/exams, src/pages/api/exams,
-- ExamRunner.tsx, /instructor/exams) was deleted in PR #47 when the
-- course switched to a workshops-only model. The tables themselves
-- were left orphaned; this drop cleans them up.
--
-- `cascade` is intentional: any FK-dependent objects (indexes, policies,
-- referencing rows) come along. No app code reads these tables anymore.
-- Re-running this script on a fresh project is safe (`if exists` makes
-- the drops no-ops); re-running on a previously-migrated project
-- removes the orphans.
-- =========================================================================

drop table if exists public.exam_attempts cascade;
drop table if exists public.exam_administrations cascade;

-- =========================================================================
-- Workshops: weekly small-group sessions per lesson, with stamp-in
-- attendance gated by time window + geofence + per-device uniqueness.
--
-- workshop_administrations: one row per workshop window.
--   ECO 1002 runs four sections per week (CML/CTL/CWL/CRL = Mon/Tue/Wed/Thu),
--   so an ECO row has `section` set and is keyed by
--   (workshop_slug, section, week_of).
--   FIN 3610 runs one workshop session per week (no per-day sections),
--   so a FIN row has `section = null` and is keyed by (workshop_slug, week_of).
--   The two cases are enforced by two partial unique indexes below.
--
-- workshop_attendance: one row per successful stamp. Two unique
--   constraints: (administration_id, user_id) blocks self-double-stamp
--   and (administration_id, device_id) blocks the friend-stamps-for-friend
--   pattern on the same browser.
-- =========================================================================

do $$ begin
  create type workshop_section as enum ('CML', 'CTL', 'CWL', 'CRL');
exception when duplicate_object then null; end $$;

create table if not exists public.workshop_administrations (
  id uuid primary key default gen_random_uuid(),
  workshop_slug text not null,
  course_slug text not null,
  section workshop_section,
  week_of date not null,
  instructor_id uuid not null references public.profiles(id) on delete restrict,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  required_lat numeric(8, 5),
  required_lng numeric(8, 5),
  required_radius_meters integer not null default 200,
  notes text,
  created_at timestamptz not null default now(),
  check (closes_at > opens_at),
  check (required_radius_meters > 0)
);

-- Migration: section was originally `not null` (ECO-only model). Make it
-- nullable so FIN 3610 rows can omit it. No-op on fresh installs.
do $$ begin
  alter table public.workshop_administrations
    alter column section drop not null;
exception when others then null; end $$;

-- Migration: drop the legacy table-level unique that required all three
-- columns set. The two partial indexes below replace it.
do $$
declare con_name text;
begin
  for con_name in
    select conname from pg_constraint
     where conrelid = 'public.workshop_administrations'::regclass
       and contype = 'u'
       and pg_get_constraintdef(oid)
           = 'UNIQUE (workshop_slug, section, week_of)'
  loop
    execute format(
      'alter table public.workshop_administrations drop constraint %I',
      con_name
    );
  end loop;
end $$;

-- ECO 1002 partial unique: one row per (workshop, section, week) when
-- section is set.
create unique index if not exists workshop_admins_section_week_unique
  on public.workshop_administrations (workshop_slug, section, week_of)
  where section is not null;

-- FIN 3610 partial unique: one row per (workshop, week) when section is
-- null. This is what prevents a FIN instructor from accidentally opening
-- the same workshop twice in the same week.
create unique index if not exists workshop_admins_nosection_week_unique
  on public.workshop_administrations (workshop_slug, week_of)
  where section is null;

create index if not exists workshop_admins_course_window_idx
  on public.workshop_administrations (course_slug, opens_at, closes_at);
create index if not exists workshop_admins_instructor_idx
  on public.workshop_administrations (instructor_id);

alter table public.workshop_administrations enable row level security;

drop policy if exists "workshop_admins_authenticated_read" on public.workshop_administrations;
create policy "workshop_admins_authenticated_read"
  on public.workshop_administrations for select
  to authenticated
  using (true);

-- Inserts/updates/deletes via service-role only (instructor UI uses it
-- under a verified instructor role server-side).

create table if not exists public.workshop_attendance (
  id uuid primary key default gen_random_uuid(),
  administration_id uuid not null references public.workshop_administrations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  stamped_at timestamptz not null default now(),
  device_id text not null,
  client_lat numeric(8, 5),
  client_lng numeric(8, 5),
  client_ip_hmac text,
  user_agent_hmac text,
  unique (administration_id, user_id),
  unique (administration_id, device_id)
);

create index if not exists workshop_attendance_admin_idx
  on public.workshop_attendance (administration_id, stamped_at desc);
create index if not exists workshop_attendance_user_idx
  on public.workshop_attendance (user_id, stamped_at desc);

alter table public.workshop_attendance enable row level security;

-- Student sees only their own attendance.
drop policy if exists "workshop_attendance_self_read" on public.workshop_attendance;
create policy "workshop_attendance_self_read"
  on public.workshop_attendance for select
  using (auth.uid() = user_id);

-- Instructor sees attendance for administrations they own, scoped by
-- enrollment so privacy mirrors quiz_attempts.
drop policy if exists "workshop_attendance_instructor_read_scoped" on public.workshop_attendance;
create policy "workshop_attendance_instructor_read_scoped"
  on public.workshop_attendance for select
  using (
    exists (
      select 1
      from public.workshop_administrations a
      join public.enrollments e
        on e.user_id = workshop_attendance.user_id
       and e.course_slug = a.course_slug
       and e.instructor_id = auth.uid()
      where a.id = workshop_attendance.administration_id
        and a.instructor_id = auth.uid()
    )
  );

-- Inserts via service-role client through /api/workshops/stamp. The two
-- unique constraints above are the substantive anti-cheating barrier;
-- RLS is just a read-scoping layer.

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
  -- updated_at is maintained by the mutation API (set to now() on update);
  -- no trigger, consistent with the rest of this schema.
  updated_at timestamptz not null default now(),
  check (course_slug = 'eco-1002'),
  check (semester_term in ('spring', 'summer', 'fall')),
  check (semester_year between 2020 and 2100),
  check (provider in ('youtube', 'vimeo'))
);

create index if not exists archive_videos_live_idx
  on public.archive_videos (course_slug)
  where deleted_at is null and published;

alter table public.archive_videos enable row level security;
-- Intentionally NO policies: PostgREST/anon/authenticated cannot read or
-- write. The service-role admin client (which bypasses RLS) is the only
-- accessor, used server-side behind isContentManager + ownership checks.

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
-- Wrapped so a stock Postgres without Supabase's `storage` schema (e.g. the
-- schema-roundtrip CI stub) doesn't abort. Real Supabase has storage.buckets.
do $$ begin
  insert into storage.buckets (id, name, public)
  values ('archive-papers', 'archive-papers', false)
  on conflict (id) do nothing;
exception
  -- best-effort: skip on a stock Postgres without Supabase's `storage`
  -- schema/table or where the role lacks privilege (e.g. the CI stub).
  when others then null;
end $$;
