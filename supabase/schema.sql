-- Run this against your Supabase project (SQL editor or `supabase db push`).
-- Idempotent: safe to re-run.

create extension if not exists "pgcrypto";

-- =========================================================================
-- ENUMS
-- =========================================================================
do $$ begin
  create type user_role as enum ('student', 'instructor', 'admin');
exception when duplicate_object then null; end $$;

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
drop policy if exists "quiz_attempts_instructor_read" on public.quiz_attempts;
create policy "quiz_attempts_instructor_read_scoped"
  on public.quiz_attempts for select
  using (
    exists (
      select 1
      from public.enrollments e
      join public.profiles p on p.id = auth.uid()
      where e.user_id = quiz_attempts.user_id
        and e.instructor_id = auth.uid()
        and p.role in ('instructor', 'admin')
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
        and p.role in ('instructor', 'admin')
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
    raise exception 'log_disclosure: caller must be instructor or admin';
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

create extension if not exists pg_cron;

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
