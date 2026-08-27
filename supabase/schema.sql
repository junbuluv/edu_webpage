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
  tos_version text,
  created_at timestamptz not null default now()
);

-- Idempotent migration: drop legacy plaintext email if it's still here.
alter table public.profiles drop column if exists email;
alter table public.profiles add column if not exists email_hmac text;
alter table public.profiles add column if not exists tos_accepted_at timestamptz;
alter table public.profiles add column if not exists tos_version text;
alter table public.profiles add column if not exists active_course_slug text;

-- Student ID (CUNY EMPLID), HMAC'd like every other sensitive identifier
-- (convention #9): never stored in the clear, but still comparable, so a
-- registrar export can be matched against it. Deliberately excluded from the
-- authenticated column grant below: only service-role code reads it.
alter table public.profiles add column if not exists student_id_hmac text;

create unique index if not exists profiles_email_hmac_uq
  on public.profiles (email_hmac);

-- One account per student ID. Partial so the many staff/legacy rows with a
-- NULL value don't collide with each other.
create unique index if not exists profiles_student_id_hmac_uq
  on public.profiles (student_id_hmac)
  where student_id_hmac is not null;

alter table public.profiles enable row level security;

drop policy if exists "profiles_self_read" on public.profiles;
create policy "profiles_self_read"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id);

-- RLS can identify the row a user owns, but cannot restrict which columns
-- they update. Keep the preference fields client-writable while withholding
-- role and identity fields from authenticated PostgREST clients.
revoke update on table public.profiles from anon, authenticated;
grant update (display_name, active_course_slug)
  on table public.profiles to authenticated;

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

revoke all on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon, authenticated;

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
revoke execute on function public.backfill_email_hmac() from anon, authenticated;
-- Run manually as a one-off after first setting app.pii_hmac_secret:
--   select public.backfill_email_hmac();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================================
-- terms_acceptances --- immutable, versioned evidence of consent.
-- =========================================================================
do $$ begin
  alter table public.profiles
    add constraint profiles_tos_version_check
    check (tos_version is null or char_length(tos_version) between 1 and 64)
    not valid;
exception when duplicate_object then null; end $$;

create table if not exists public.terms_acceptances (
  user_id uuid not null references public.profiles(id) on delete cascade,
  policy_version text not null,
  accepted_at timestamptz not null default now(),
  source text not null,
  primary key (user_id, policy_version),
  check (char_length(policy_version) between 1 and 64),
  check (char_length(source) between 1 and 64)
);

insert into public.terms_acceptances (
  user_id, policy_version, accepted_at, source
)
select id, 'legacy-unversioned', tos_accepted_at, 'legacy-profile'
  from public.profiles
 where tos_accepted_at is not null
on conflict (user_id, policy_version) do nothing;
update public.profiles
   set tos_version = 'legacy-unversioned'
 where tos_accepted_at is not null
   and tos_version is null;

alter table public.terms_acceptances enable row level security;
drop policy if exists "terms_acceptances_authenticated_read"
  on public.terms_acceptances;
create policy "terms_acceptances_authenticated_read"
  on public.terms_acceptances for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.profiles p
       where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );
revoke insert, update, delete on table public.terms_acceptances
  from anon, authenticated;

create or replace function public.accept_terms(
  p_user_id uuid,
  p_policy_version text,
  p_source text
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_accepted_at timestamptz := pg_catalog.clock_timestamp();
begin
  if p_user_id is null
     or p_policy_version is null
     or p_source is null
     or char_length(p_policy_version) not between 1 and 64
     or char_length(p_source) not between 1 and 64 then
    raise exception 'invalid terms acceptance input' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('terms:' || p_user_id::text, 0)
  );
  if not exists (
    select 1 from public.profiles p where p.id = p_user_id
  ) then
    return 'missing_user';
  end if;

  insert into public.terms_acceptances (
    user_id, policy_version, accepted_at, source
  ) values (
    p_user_id, p_policy_version, v_accepted_at, p_source
  )
  on conflict (user_id, policy_version) do nothing;

  select t.accepted_at into v_accepted_at
    from public.terms_acceptances t
   where t.user_id = p_user_id
     and t.policy_version = p_policy_version;

  update public.profiles
     set tos_accepted_at = greatest(
           coalesce(tos_accepted_at, '-infinity'::timestamptz),
           v_accepted_at
         ),
         tos_version = p_policy_version
   where id = p_user_id;
  return 'accepted';
end;
$$;
revoke all on function public.accept_terms(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.accept_terms(uuid, text, text)
  to service_role;

-- =========================================================================
-- teaching_assignments --- explicit admin-managed teaching authority.
--
-- Never infer authority from the presence or absence of student rows. An
-- instructor may manage a course offering only while this assignment is
-- active; historical rows remain linked after deactivation.
-- =========================================================================
create table if not exists public.teaching_assignments (
  instructor_id uuid not null references public.profiles(id) on delete restrict,
  course_slug text not null,
  semester text not null,
  active boolean not null default true,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (instructor_id, course_slug, semester),
  check (course_slug in ('eco-1002', 'fin-3610')),
  check (char_length(semester) between 1 and 64)
);

create index if not exists teaching_assignments_course_term_idx
  on public.teaching_assignments (course_slug, semester, active);

alter table public.teaching_assignments enable row level security;
drop policy if exists "teaching_assignments_authenticated_read"
  on public.teaching_assignments;
create policy "teaching_assignments_authenticated_read"
  on public.teaching_assignments for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'instructor'
        and teaching_assignments.instructor_id = (select auth.uid())
    )
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

-- =========================================================================
-- role_requests --- a signup asking for staff access, pending admin review.
--
-- Choosing "lecturer" or "TA" on the signup form must never write
-- profiles.role: that would let anyone self-promote and read other students'
-- records. Signup records a request here; the role changes only when an admin
-- approves it through /admin. 'admin' is excluded by CHECK, so a forged form
-- value cannot request it. One row per user: re-requesting overwrites.
-- =========================================================================
create table if not exists public.role_requests (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  requested_role user_role not null,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  note text,
  constraint role_requests_role_chk
    check (requested_role in ('instructor', 'ta')),
  constraint role_requests_status_chk
    check (status in ('pending', 'approved', 'denied')),
  constraint role_requests_note_chk
    check (note is null or char_length(note) between 1 and 300)
);

create index if not exists role_requests_pending_idx
  on public.role_requests (status, requested_at desc);

alter table public.role_requests enable row level security;

drop policy if exists "role_requests_self_or_admin_read" on public.role_requests;
create policy "role_requests_self_or_admin_read"
  on public.role_requests for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

-- Requests are created by the signup handler and settled by the admin
-- handler, both service-role. No client may write them.
revoke insert, update, delete on table public.role_requests
  from anon, authenticated;

-- =========================================================================
-- lesson_progress --- one row per (user, lesson)
-- =========================================================================
create table if not exists public.lesson_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_slug text not null,
  course_slug text,
  status progress_status not null default 'started',
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_slug)
);

alter table public.lesson_progress add column if not exists course_slug text;
update public.lesson_progress
  set course_slug = split_part(lesson_slug, '/', 1)
  where course_slug is null
    and split_part(lesson_slug, '/', 1) in ('eco-1002', 'fin-3610');
do $$ begin
  alter table public.lesson_progress
    add constraint lesson_progress_course_chk
    check (course_slug in ('eco-1002', 'fin-3610'));
exception when duplicate_object then null; end $$;
create index if not exists lesson_progress_user_course_idx
  on public.lesson_progress (user_id, course_slug, updated_at desc);
drop index if exists public.lesson_progress_offering_idx;

alter table public.lesson_progress enable row level security;

drop policy if exists "lesson_progress_self_all" on public.lesson_progress;
drop policy if exists "lesson_progress_self_read" on public.lesson_progress;
drop policy if exists "lesson_progress_instructor_read_scoped" on public.lesson_progress;
drop policy if exists "lesson_progress_authenticated_read" on public.lesson_progress;

-- Lesson status is authoritative progress data. Only server-side handlers
-- using the service role may write it after validating the lesson collection.
revoke insert, update, delete on table public.lesson_progress
  from anon, authenticated;

-- =========================================================================
-- quiz_attempts --- append-only attempts log
-- =========================================================================
create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  client_attempt_id uuid not null default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  quiz_slug text not null,
  course_slug text,
  semester text,
  instructor_id uuid references public.profiles(id) on delete set null,
  score numeric not null,
  max_score numeric not null,
  answers jsonb not null,
  submitted_at timestamptz not null default now()
);

alter table public.quiz_attempts
  add column if not exists client_attempt_id uuid;
update public.quiz_attempts
   set client_attempt_id = id
 where client_attempt_id is null;
alter table public.quiz_attempts
  alter column client_attempt_id set default gen_random_uuid(),
  alter column client_attempt_id set not null;
alter table public.quiz_attempts add column if not exists course_slug text;
alter table public.quiz_attempts add column if not exists semester text;
alter table public.quiz_attempts
  add column if not exists instructor_id uuid references public.profiles(id) on delete set null;
update public.quiz_attempts
  set course_slug = case
    when quiz_slug like 'eco-1002-%' then 'eco-1002'
    when quiz_slug like 'fin-3610-%' then 'fin-3610'
  end
  where course_slug is null;
do $$ begin
  alter table public.quiz_attempts
    add constraint quiz_attempts_course_chk
    check (course_slug in ('eco-1002', 'fin-3610'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.quiz_attempts
    add constraint quiz_attempts_scope_chk
    check ((semester is null) = (instructor_id is null));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.quiz_attempts
    add constraint quiz_attempts_answers_size_chk
    check (octet_length(answers::text) <= 32768) not valid;
exception when duplicate_object then null; end $$;

create unique index if not exists quiz_attempts_user_client_attempt_uq
  on public.quiz_attempts (user_id, client_attempt_id);
create index if not exists quiz_attempts_user_quiz_idx
  on public.quiz_attempts (user_id, quiz_slug, submitted_at desc);
create index if not exists quiz_attempts_user_course_idx
  on public.quiz_attempts (user_id, course_slug, submitted_at desc);
create index if not exists quiz_attempts_offering_idx
  on public.quiz_attempts (instructor_id, course_slug, semester, submitted_at desc);

alter table public.quiz_attempts enable row level security;

drop policy if exists "quiz_attempts_self_read" on public.quiz_attempts;
drop policy if exists "quiz_attempts_instructor_read" on public.quiz_attempts;
drop policy if exists "quiz_attempts_instructor_read_scoped" on public.quiz_attempts;
drop policy if exists "quiz_attempts_authenticated_read" on public.quiz_attempts;

drop policy if exists "quiz_attempts_self_insert" on public.quiz_attempts;
revoke insert, update, delete on table public.quiz_attempts
  from anon, authenticated;

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

do $$
declare
  invalid_count integer;
  invalid_summary jsonb;
begin
  select
    count(*) filter (where
      course_slug not in ('eco-1002', 'fin-3610')
      or char_length(semester) not between 1 and 64
      or (student_name is not null and char_length(student_name) not between 1 and 120)
    ),
    jsonb_build_object(
      'invalid_course', count(*) filter (where course_slug not in ('eco-1002', 'fin-3610')),
      'invalid_semester', count(*) filter (where char_length(semester) not between 1 and 64),
      'invalid_student_name', count(*) filter (where student_name is not null and char_length(student_name) not between 1 and 120)
    )
    into invalid_count, invalid_summary
    from public.enrollments;

  if invalid_count > 0 then
    raise exception '% enrollment row(s) cannot be mapped to a teaching assignment: %. Correct these rows before retrying',
      invalid_count, invalid_summary;
  end if;
end $$;

with unambiguous_enrollment as (
  select
    user_id,
    course_slug,
    min(semester) as semester,
    min(instructor_id::text)::uuid as instructor_id
  from public.enrollments
  group by user_id, course_slug
  having count(*) = 1
)
update public.quiz_attempts q
   set semester = e.semester,
       instructor_id = e.instructor_id
  from unambiguous_enrollment e
 where q.user_id = e.user_id
   and q.course_slug = e.course_slug
   and q.semester is null
   and q.instructor_id is null;

do $$
declare
  unscoped_attempts bigint;
begin
  select count(*) into unscoped_attempts
    from public.quiz_attempts
   where semester is null and instructor_id is null;
  if unscoped_attempts > 0 then
    raise notice '% quiz attempt row(s) remain unscoped because their enrollment history is ambiguous; students and admins retain access',
      unscoped_attempts;
  end if;
end $$;

create index if not exists enrollments_instructor_idx
  on public.enrollments (instructor_id, semester);
create index if not exists enrollments_course_idx
  on public.enrollments (course_slug, semester);

-- Seed explicit assignments from the ownership already recorded on legacy
-- enrollments. Only current instructors are activated automatically; rows
-- owned by a demoted user or an admin remain inactive for owner review.
insert into public.teaching_assignments (
  instructor_id, course_slug, semester, active
)
select distinct
  e.instructor_id,
  e.course_slug,
  e.semester,
  p.role = 'instructor'
from public.enrollments e
join public.profiles p on p.id = e.instructor_id
where e.course_slug in ('eco-1002', 'fin-3610')
  and char_length(e.semester) between 1 and 64
on conflict (instructor_id, course_slug, semester) do nothing;

alter table public.enrollments
  drop constraint if exists enrollments_teaching_assignment_fkey;
alter table public.enrollments
  add constraint enrollments_teaching_assignment_fkey
  foreign key (instructor_id, course_slug, semester)
  references public.teaching_assignments (instructor_id, course_slug, semester)
  on update restrict on delete restrict;
do $$ begin
  alter table public.enrollments
    add constraint enrollments_course_check
    check (course_slug in ('eco-1002', 'fin-3610'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.enrollments
    add constraint enrollments_semester_check
    check (char_length(semester) between 1 and 64);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.enrollments
    add constraint enrollments_student_name_check
    check (student_name is null or char_length(student_name) between 1 and 120);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.enrollments
    add constraint enrollments_eco_section_required_check
    check (course_slug <> 'eco-1002' or section is not null) not valid;
exception when duplicate_object then null; end $$;

-- Exact offering progress is separate from lifetime lesson mastery. This
-- preserves a student's lifetime completion while keeping instructor reports
-- tied to the course, term, and owner that existed when the work occurred.
create table if not exists public.offering_lesson_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_slug text not null,
  semester text not null,
  instructor_id uuid not null references public.profiles(id) on delete restrict,
  lesson_slug text not null,
  status progress_status not null default 'started',
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, course_slug, semester, lesson_slug),
  check (course_slug in ('eco-1002', 'fin-3610')),
  check (char_length(semester) between 1 and 64),
  foreign key (instructor_id, course_slug, semester)
    references public.teaching_assignments (
      instructor_id, course_slug, semester
    ) on update restrict on delete restrict
);

-- Projects that applied the prior scoped-progress schema still have the
-- legacy semester/instructor columns. Copy those exact rows before removing
-- the columns; a fresh project skips this compatibility block.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'lesson_progress'
       and column_name = 'semester'
  ) and exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'lesson_progress'
       and column_name = 'instructor_id'
  ) then
    execute $backfill$
      insert into public.offering_lesson_progress (
        user_id, course_slug, semester, instructor_id, lesson_slug,
        status, completed_at, updated_at
      )
      select
        user_id, course_slug, semester, instructor_id, lesson_slug,
        status, completed_at, updated_at
      from public.lesson_progress
      where course_slug is not null
        and semester is not null
        and instructor_id is not null
      on conflict (user_id, course_slug, semester, lesson_slug) do update
        set status = case
              when excluded.status = 'completed'::public.progress_status
                or public.offering_lesson_progress.status =
                  'completed'::public.progress_status
              then 'completed'::public.progress_status
              else 'started'::public.progress_status
            end,
            completed_at = coalesce(
              public.offering_lesson_progress.completed_at,
              excluded.completed_at
            ),
            updated_at = greatest(
              public.offering_lesson_progress.updated_at,
              excluded.updated_at
            )
    $backfill$;
  end if;
end $$;

drop policy if exists "lesson_progress_self_read" on public.lesson_progress;
drop policy if exists "lesson_progress_instructor_read_scoped"
  on public.lesson_progress;
drop policy if exists "lesson_progress_authenticated_read"
  on public.lesson_progress;
alter table public.lesson_progress
  drop constraint if exists lesson_progress_scope_chk,
  drop column if exists semester,
  drop column if exists instructor_id;

create index if not exists offering_lesson_progress_user_course_idx
  on public.offering_lesson_progress (
    user_id, course_slug, semester, updated_at desc
  );
create index if not exists offering_lesson_progress_instructor_idx
  on public.offering_lesson_progress (
    instructor_id, course_slug, semester, updated_at desc
  );

alter table public.offering_lesson_progress enable row level security;
drop policy if exists "offering_lesson_progress_authenticated_read"
  on public.offering_lesson_progress;
create policy "offering_lesson_progress_authenticated_read"
  on public.offering_lesson_progress for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1
        from public.enrollments e
        join public.teaching_assignments ta
          on ta.instructor_id = e.instructor_id
         and ta.course_slug = e.course_slug
         and ta.semester = e.semester
        join public.profiles p on p.id = ta.instructor_id
       where e.user_id = offering_lesson_progress.user_id
         and e.instructor_id = (select auth.uid())
         and e.instructor_id = offering_lesson_progress.instructor_id
         and e.course_slug = offering_lesson_progress.course_slug
         and e.semester = offering_lesson_progress.semester
         and ta.active
         and p.role = 'instructor'
    )
    or exists (
      select 1 from public.profiles p
       where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );
revoke insert, update, delete on table public.offering_lesson_progress
  from anon, authenticated;

drop function if exists public.transfer_enrollment_scope(
  uuid, text, text, uuid, uuid, text, text
);
create or replace function public.transfer_enrollment_scope(
  p_actor_id uuid,
  p_user_id uuid,
  p_course_slug text,
  p_semester text,
  p_current_instructor_id uuid,
  p_new_instructor_id uuid,
  p_student_name text,
  p_section text
)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  actor_role public.user_role;
  lock_instructor_id uuid;
  existing_enrolled_at timestamptz;
  changed_rows integer;
begin
  if p_actor_id is null
     or p_user_id is null
     or p_current_instructor_id is null
     or p_new_instructor_id is null
     or p_course_slug is null
     or p_semester is null
     or p_course_slug not in ('eco-1002', 'fin-3610')
     or char_length(p_semester) not between 1 and 64
     or (
       p_student_name is not null
       and char_length(p_student_name) not between 1 and 120
     )
     or (
       p_course_slug = 'eco-1002'
       and (
         p_section is null
         or not (p_section = any (array['CML', 'CTL', 'CWL', 'CRL']))
       )
     )
     or (p_course_slug = 'fin-3610' and p_section is not null) then
    raise exception 'invalid enrollment transfer input' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('instructor:' || p_actor_id::text, 0)
  );
  select p.role into actor_role
    from public.profiles p
   where p.id = p_actor_id;
  if actor_role is distinct from 'admin'::public.user_role then
    return false;
  end if;
  for lock_instructor_id in
    select distinct v.id
      from (values (p_current_instructor_id), (p_new_instructor_id)) v(id)
     order by v.id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'instructor:' || lock_instructor_id::text,
        0
      )
    );
  end loop;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'assignment:' || p_new_instructor_id::text || ':' ||
      p_course_slug || ':' || p_semester,
      0
    )
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'enrollment-scope:' || p_user_id::text || ':' || p_course_slug,
      0
    )
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'enrollment:' || p_user_id::text || ':' ||
      p_course_slug || ':' || p_semester,
      0
    )
  );

  if not exists (
    select 1
      from public.teaching_assignments ta
      join public.profiles p on p.id = ta.instructor_id
     where ta.instructor_id = p_new_instructor_id
       and ta.course_slug = p_course_slug
       and ta.semester = p_semester
       and ta.active
       and p.role = 'instructor'
  ) then
    return false;
  end if;

  -- Recreate the row because scope columns are trigger-immutable. The
  -- transaction restores the original row if the guarded insert fails.
  delete from public.enrollments
   where user_id = p_user_id
     and course_slug = p_course_slug
     and semester = p_semester
     and instructor_id = p_current_instructor_id
  returning enrolled_at into existing_enrolled_at;
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then return false; end if;

  insert into public.enrollments (
    user_id,
    course_slug,
    instructor_id,
    semester,
    enrolled_at,
    student_name,
    section
  ) values (
    p_user_id,
    p_course_slug,
    p_new_instructor_id,
    p_semester,
    existing_enrolled_at,
    p_student_name,
    p_section
  );

  update public.offering_lesson_progress
     set instructor_id = p_new_instructor_id
   where user_id = p_user_id
     and course_slug = p_course_slug
     and semester = p_semester
     and instructor_id = p_current_instructor_id;

  update public.quiz_attempts
     set instructor_id = p_new_instructor_id
   where user_id = p_user_id
     and course_slug = p_course_slug
     and semester = p_semester
     and instructor_id = p_current_instructor_id;

  return true;
end;
$$;

revoke all on function public.transfer_enrollment_scope(
  uuid, uuid, text, text, uuid, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.transfer_enrollment_scope(
  uuid, uuid, text, text, uuid, uuid, text, text
) to service_role;

create or replace function public.resolve_current_enrollment_scope(
  p_user_id uuid,
  p_course_slug text
)
returns table (semester text, instructor_id uuid)
language sql
stable
set search_path = ''
as $$
  with candidates as (
    select e.semester, e.instructor_id
      from public.enrollments e
      join public.teaching_assignments ta
        on ta.instructor_id = e.instructor_id
       and ta.course_slug = e.course_slug
       and ta.semester = e.semester
       and ta.active
      join public.profiles p
        on p.id = e.instructor_id
       and p.role = 'instructor'
     where e.user_id = p_user_id
       and e.course_slug = p_course_slug
  )
  select min(c.semester), min(c.instructor_id::text)::uuid
    from candidates c
  having count(*) = 1
$$;
revoke all on function public.resolve_current_enrollment_scope(uuid, text)
  from public, anon, authenticated;
grant execute on function public.resolve_current_enrollment_scope(uuid, text)
  to service_role;

create or replace function public.record_lesson_progress(
  p_user_id uuid,
  p_lesson_slug text,
  p_course_slug text,
  p_operation text
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_scope_count integer;
  v_semester text;
  v_instructor_id uuid;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_result_status public.progress_status;
begin
  if p_user_id is null
     or p_lesson_slug is null
     or p_course_slug is null
     or p_operation is null
     or p_course_slug not in ('eco-1002', 'fin-3610')
     or char_length(p_lesson_slug) not between 1 and 200
     or p_lesson_slug not like p_course_slug || '/%'
     or p_operation not in ('start', 'complete', 'reset') then
    raise exception 'invalid lesson progress input' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.profiles p where p.id = p_user_id
  ) then
    raise exception 'unknown progress user' using errcode = '23503';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'enrollment-scope:' || p_user_id::text || ':' || p_course_slug,
      0
    )
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'lesson-progress:' || p_user_id::text || ':' || p_lesson_slug,
      0
    )
  );

  select count(*), min(e.semester), min(e.instructor_id::text)::uuid
    into v_scope_count, v_semester, v_instructor_id
    from public.enrollments e
    join public.teaching_assignments ta
      on ta.instructor_id = e.instructor_id
     and ta.course_slug = e.course_slug
     and ta.semester = e.semester
     and ta.active
    join public.profiles p
      on p.id = e.instructor_id
     and p.role = 'instructor'
   where e.user_id = p_user_id
     and e.course_slug = p_course_slug;

  if v_scope_count > 1 then
    return 'ambiguous';
  end if;

  if p_operation = 'start' then
    insert into public.lesson_progress (
      user_id, lesson_slug, course_slug, status, updated_at
    ) values (
      p_user_id, p_lesson_slug, p_course_slug,
      'started'::public.progress_status, v_now
    ) on conflict (user_id, lesson_slug) do nothing;

    if v_scope_count = 1 then
      insert into public.offering_lesson_progress (
        user_id, course_slug, semester, instructor_id, lesson_slug,
        status, updated_at
      ) values (
        p_user_id, p_course_slug, v_semester, v_instructor_id, p_lesson_slug,
        'started'::public.progress_status, v_now
      ) on conflict (
        user_id, course_slug, semester, lesson_slug
      ) do nothing;
    end if;
    select p.status into v_result_status
      from public.lesson_progress p
     where p.user_id = p_user_id and p.lesson_slug = p_lesson_slug;
    return v_result_status::text;
  end if;

  if p_operation = 'complete' then
    insert into public.lesson_progress (
      user_id, lesson_slug, course_slug, status, completed_at, updated_at
    ) values (
      p_user_id, p_lesson_slug, p_course_slug,
      'completed'::public.progress_status, v_now, v_now
    ) on conflict (user_id, lesson_slug) do update
      set course_slug = excluded.course_slug,
          status = 'completed'::public.progress_status,
          completed_at = coalesce(
            public.lesson_progress.completed_at,
            excluded.completed_at
          ),
          updated_at = excluded.updated_at;

    if v_scope_count = 1 then
      insert into public.offering_lesson_progress (
        user_id, course_slug, semester, instructor_id, lesson_slug,
        status, completed_at, updated_at
      ) values (
        p_user_id, p_course_slug, v_semester, v_instructor_id, p_lesson_slug,
        'completed'::public.progress_status, v_now, v_now
      ) on conflict (
        user_id, course_slug, semester, lesson_slug
      ) do update
        set instructor_id = excluded.instructor_id,
            status = 'completed'::public.progress_status,
            completed_at = coalesce(
              public.offering_lesson_progress.completed_at,
              excluded.completed_at
            ),
            updated_at = excluded.updated_at;
    end if;
    return 'completed';
  end if;

  insert into public.lesson_progress (
    user_id, lesson_slug, course_slug, status, completed_at, updated_at
  ) values (
    p_user_id, p_lesson_slug, p_course_slug,
    'started'::public.progress_status, null, v_now
  ) on conflict (user_id, lesson_slug) do update
    set course_slug = excluded.course_slug,
        status = 'started'::public.progress_status,
        completed_at = null,
        updated_at = excluded.updated_at;

  if v_scope_count = 1 then
    insert into public.offering_lesson_progress (
      user_id, course_slug, semester, instructor_id, lesson_slug,
      status, completed_at, updated_at
    ) values (
      p_user_id, p_course_slug, v_semester, v_instructor_id, p_lesson_slug,
      'started'::public.progress_status, null, v_now
    ) on conflict (
      user_id, course_slug, semester, lesson_slug
    ) do update
      set instructor_id = excluded.instructor_id,
          status = 'started'::public.progress_status,
          completed_at = null,
          updated_at = excluded.updated_at;
  end if;
  return 'reset';
end;
$$;
revoke all on function public.record_lesson_progress(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_lesson_progress(
  uuid, text, text, text
) to service_role;

create or replace function public.record_quiz_attempt(
  p_user_id uuid,
  p_quiz_slug text,
  p_course_slug text,
  p_score numeric,
  p_max_score numeric,
  p_answers jsonb,
  p_client_attempt_id uuid
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_scope_count integer;
  v_semester text;
  v_instructor_id uuid;
begin
  if p_user_id is null
     or p_quiz_slug is null
     or p_course_slug is null
     or p_score is null
     or p_max_score is null
     or p_answers is null
     or p_client_attempt_id is null
     or p_course_slug not in ('eco-1002', 'fin-3610')
     or char_length(p_quiz_slug) not between 1 and 200
     or p_max_score <= 0
     or p_score < 0
     or p_score > p_max_score
     or p_score = 'NaN'::numeric
     or p_max_score = 'NaN'::numeric
     or jsonb_typeof(p_answers) is distinct from 'object'
     or octet_length(p_answers::text) > 32768 then
    raise exception 'invalid quiz attempt input' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.profiles p where p.id = p_user_id
  ) then
    raise exception 'unknown quiz user' using errcode = '23503';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'quiz-attempt:' || p_user_id::text || ':' ||
      p_client_attempt_id::text,
      0
    )
  );
  if exists (
    select 1 from public.quiz_attempts q
     where q.user_id = p_user_id
       and q.client_attempt_id = p_client_attempt_id
  ) then
    return 'duplicate';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'enrollment-scope:' || p_user_id::text || ':' || p_course_slug,
      0
    )
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'quiz-rate:' || p_user_id::text || ':' || p_quiz_slug,
      0
    )
  );

  select count(*), min(e.semester), min(e.instructor_id::text)::uuid
    into v_scope_count, v_semester, v_instructor_id
    from public.enrollments e
    join public.teaching_assignments ta
      on ta.instructor_id = e.instructor_id
     and ta.course_slug = e.course_slug
     and ta.semester = e.semester
     and ta.active
    join public.profiles p
      on p.id = e.instructor_id
     and p.role = 'instructor'
   where e.user_id = p_user_id
     and e.course_slug = p_course_slug;
  if v_scope_count > 1 then
    return 'ambiguous';
  end if;

  if (
    select count(*) >= 20
      from public.quiz_attempts q
     where q.user_id = p_user_id
       and q.quiz_slug = p_quiz_slug
       and q.submitted_at >= pg_catalog.clock_timestamp() - interval '1 hour'
  ) then
    return 'rate_limited';
  end if;

  insert into public.quiz_attempts (
    client_attempt_id, user_id, quiz_slug, course_slug, semester,
    instructor_id, score, max_score, answers
  ) values (
    p_client_attempt_id, p_user_id, p_quiz_slug, p_course_slug,
    case when v_scope_count = 1 then v_semester end,
    case when v_scope_count = 1 then v_instructor_id end,
    p_score, p_max_score, p_answers
  );
  return 'recorded';
end;
$$;
revoke all on function public.record_quiz_attempt(
  uuid, text, text, numeric, numeric, jsonb, uuid
) from public, anon, authenticated;
grant execute on function public.record_quiz_attempt(
  uuid, text, text, numeric, numeric, jsonb, uuid
) to service_role;

alter table public.enrollments enable row level security;

drop policy if exists "enrollments_self_read" on public.enrollments;
drop policy if exists "enrollments_instructor_read" on public.enrollments;
drop policy if exists "enrollments_admin_read" on public.enrollments;
drop policy if exists "enrollments_authenticated_read" on public.enrollments;
create policy "enrollments_authenticated_read"
  on public.enrollments for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1
      from public.teaching_assignments ta
      join public.profiles p on p.id = (select auth.uid())
      where ta.instructor_id = (select auth.uid())
        and ta.instructor_id = enrollments.instructor_id
        and ta.course_slug = enrollments.course_slug
        and ta.semester = enrollments.semester
        and ta.active
        and p.role = 'instructor'
    )
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

-- Only the service-role client can mutate enrollments (rosters come from
-- instructor uploads through /api/instructor/roster). No insert/update/delete
-- policies for regular roles.

-- Replace the permissive instructor-read policy on quiz_attempts with one
-- scoped by enrollment: an instructor sees attempts only for students they
-- have an active enrollment row for in the same course as the quiz.
-- Server-side grading tags each attempt with the quiz's content-collection
-- course, so this policy requires that same course and roster ownership.
-- Drop both the legacy short name and the current name so this block
-- is idempotent regardless of which version a project was last on.
drop policy if exists "quiz_attempts_self_read" on public.quiz_attempts;
drop policy if exists "quiz_attempts_instructor_read" on public.quiz_attempts;
drop policy if exists "quiz_attempts_instructor_read_scoped" on public.quiz_attempts;
drop policy if exists "quiz_attempts_authenticated_read" on public.quiz_attempts;
create policy "quiz_attempts_authenticated_read"
  on public.quiz_attempts for select
  to authenticated
  using (
    (select auth.uid()) = quiz_attempts.user_id
    or exists (
      select 1
      from public.enrollments e
      join public.teaching_assignments ta
        on ta.instructor_id = e.instructor_id
       and ta.course_slug = e.course_slug
       and ta.semester = e.semester
      join public.profiles p on p.id = ta.instructor_id
      where e.user_id = quiz_attempts.user_id
        and e.instructor_id = (select auth.uid())
        and e.course_slug = quiz_attempts.course_slug
        and e.semester = quiz_attempts.semester
        and quiz_attempts.instructor_id = (select auth.uid())
        and ta.active
        and p.role = 'instructor'
    )
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

-- Lifetime progress is private to the student (plus administrators). Exact
-- instructor reporting reads from offering_lesson_progress instead.
drop policy if exists "lesson_progress_self_read" on public.lesson_progress;
drop policy if exists "lesson_progress_instructor_read_scoped" on public.lesson_progress;
drop policy if exists "lesson_progress_authenticated_read" on public.lesson_progress;
create policy "lesson_progress_authenticated_read"
  on public.lesson_progress for select
  to authenticated
  using (
    (select auth.uid()) = lesson_progress.user_id
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

-- =========================================================================
-- audit_log --- record of staff disclosures (FERPA §99.32-style)
--
-- One row per staff disclosure, roster access, export, or management action;
-- target_user_id is populated when an action addresses one student.
-- IP and user-agent are stored as HMAC(SHA-256, server_secret)
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

drop policy if exists "audit_log_actor_self_read" on public.audit_log;
drop policy if exists "audit_log_admin_read" on public.audit_log;
drop policy if exists "audit_log_authenticated_read" on public.audit_log;
create policy "audit_log_authenticated_read"
  on public.audit_log for select
  to authenticated
  using (
    (select auth.uid()) = actor_id
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
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
revoke execute on function public.log_disclosure(text, uuid, text, jsonb)
  from anon, authenticated;

-- =========================================================================
-- Retention jobs (pg_cron)
--
-- Two scheduled functions, both running as the database role and writing
-- an audit_log row for transparency:
--
--   purge_inactive_accounts()
--     Deletes auth.users rows whose later account-creation/last-sign-in
--     timestamp is more than 24 months old. Accounts that still own
--     instructor-managed rows are skipped so one FK cannot abort the batch.
--     Eligible rows cascade through public.profiles and student records.
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
  v_candidate_count integer;
  v_cutoff timestamptz := now() - (p_months || ' months')::interval;
begin
  select count(*) into v_candidate_count
    from auth.users u
    join public.profiles p on p.id = u.id and p.role = 'student'
   where coalesce(u.last_sign_in_at, u.created_at) < v_cutoff;

  with deleted as (
    delete from auth.users u
     where coalesce(u.last_sign_in_at, u.created_at) < v_cutoff
       and exists (
         select 1 from public.profiles profile
          where profile.id = u.id and profile.role = 'student'
       )
       and not exists (
         select 1 from public.enrollments e where e.instructor_id = u.id
       )
       and not exists (
         select 1 from public.teaching_assignments ta
          where ta.instructor_id = u.id
       )
       and not exists (
         select 1 from public.workshop_administrations w
          where w.instructor_id = u.id
       )
       and not exists (
         select 1 from public.archive_videos v where v.created_by = u.id
       )
       and not exists (
         select 1 from public.archive_papers p where p.created_by = u.id
       )
       and not exists (
         select 1 from public.archive_paper_upload_intents i
          where i.actor_id = u.id
       )
       and not exists (
         select 1 from public.archive_quizzes q where q.created_by = u.id
       )
    returning u.id
  )
  select count(*) into v_count from deleted;

  insert into public.audit_log (
    actor_id, actor_role, action, target_resource, metadata
  ) values (
    null, null, 'system_retention_purge_inactive', 'auth.users',
    jsonb_build_object(
      'cutoff_months', p_months,
      'count', v_count,
      'skipped_owned_records', v_candidate_count - v_count
    )
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
revoke execute on function public.purge_inactive_accounts(integer)
  from anon, authenticated;
revoke execute on function public.purge_old_quiz_attempts(integer)
  from anon, authenticated;

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
--   (workshop_slug, semester, section, week_of, instructor_id).
--   FIN 3610 runs one workshop session per week (no per-day sections),
--   so a FIN row has `section = null` and is keyed by
--   (workshop_slug, semester, week_of, instructor_id).
--   The two cases are enforced by two partial unique indexes below.
--
-- workshop_attendance: one row per successful stamp. Two unique
--   constraints: (administration_id, user_id) blocks self-double-stamp
--   and (administration_id, device_hmac) blocks the friend-stamps-for-friend
--   pattern on the same browser without retaining a raw device identifier.
-- =========================================================================

do $$ begin
  create type workshop_section as enum ('CML', 'CTL', 'CWL', 'CRL');
exception when duplicate_object then null; end $$;

create table if not exists public.workshop_administrations (
  id uuid primary key default gen_random_uuid(),
  workshop_slug text not null,
  course_slug text not null,
  semester text not null,
  section workshop_section,
  week_of date not null,
  schedule_version smallint not null default 2,
  instructor_id uuid not null references public.profiles(id) on delete restrict,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  required_lat numeric(8, 5),
  required_lng numeric(8, 5),
  geofence_required boolean generated always as (
    required_lat is not null and required_lng is not null
  ) stored,
  required_radius_meters integer not null default 200,
  location_label text not null default '55 Lexington Ave',
  questions_revealed_at timestamptz,
  cancelled_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  check (closes_at > opens_at),
  check (required_radius_meters > 0)
);

alter table public.workshop_administrations
  add column if not exists semester text;
alter table public.workshop_administrations
  add column if not exists schedule_version smallint;
alter table public.workshop_administrations
  add column if not exists location_label text;
alter table public.workshop_administrations
  add column if not exists questions_revealed_at timestamptz;
alter table public.workshop_administrations
  add column if not exists cancelled_at timestamptz;
alter table public.workshop_administrations
  add column if not exists geofence_required boolean generated always as (
    required_lat is not null and required_lng is not null
  ) stored;

-- Never guess the academic term for existing education records. An owner must
-- map every legacy row before this hardening can be applied.
do $$
declare unmapped_count integer;
begin
  select count(*) into unmapped_count
    from public.workshop_administrations
   where semester is null;
  if unmapped_count > 0 then
    raise exception '% workshop administration row(s) need an owner-confirmed semester before migration', unmapped_count;
  end if;
end $$;
update public.workshop_administrations
   set schedule_version = 1
 where schedule_version is null;
update public.workshop_administrations
   set location_label = '55 Lexington Ave'
 where location_label is null;

-- Fail before adding constraints so legacy rows get an actionable diagnostic
-- instead of an opaque ALTER TABLE violation.
do $$
declare
  invalid_count integer;
  invalid_summary jsonb;
begin
  select
    count(*) filter (where
      char_length(semester) not between 1 and 64
      or course_slug not in ('eco-1002', 'fin-3610')
      or (required_lat is null) <> (required_lng is null)
      or (required_lat is not null and required_lat not between -90 and 90)
      or (required_lng is not null and required_lng not between -180 and 180)
      or required_radius_meters not between 10 and 50000
      or closes_at <= opens_at
      or (cancelled_at is not null and cancelled_at > opens_at)
      or char_length(location_label) not between 1 and 120
      or (notes is not null and char_length(notes) > 200)
    ),
    jsonb_build_object(
      'invalid_semester', count(*) filter (where char_length(semester) not between 1 and 64),
      'invalid_course', count(*) filter (where course_slug not in ('eco-1002', 'fin-3610')),
      'invalid_coordinate_pair', count(*) filter (where (required_lat is null) <> (required_lng is null)),
      'invalid_coordinate_range', count(*) filter (where
        (required_lat is not null and required_lat not between -90 and 90)
        or (required_lng is not null and required_lng not between -180 and 180)
      ),
      'invalid_radius', count(*) filter (where required_radius_meters not between 10 and 50000),
      'invalid_window', count(*) filter (where closes_at <= opens_at),
      'invalid_cancellation', count(*) filter (where cancelled_at is not null and cancelled_at > opens_at),
      'invalid_location_label', count(*) filter (where char_length(location_label) not between 1 and 120),
      'oversized_notes', count(*) filter (where notes is not null and char_length(notes) > 200)
    )
    into invalid_count, invalid_summary
    from public.workshop_administrations;

  if invalid_count > 0 then
    raise exception '% workshop administration row(s) violate the hardened schedule constraints: %. Run the legacy preflight query in CONTRIBUTING.md before retrying',
      invalid_count, invalid_summary;
  end if;
end $$;

alter table public.workshop_administrations
  alter column semester set not null,
  alter column schedule_version set default 2,
  alter column schedule_version set not null,
  alter column location_label set default '55 Lexington Ave',
  alter column location_label set not null;

-- Migration: section was originally `not null` (ECO-only model). Make it
-- nullable so FIN 3610 rows can omit it. PostgreSQL treats a repeated drop as
-- a no-op, while real catalog or permission errors must remain visible.
alter table public.workshop_administrations
  alter column section drop not null;

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

-- ECO 1002 partial unique: one row per instructor's (workshop, section,
-- week) when section is set.
drop index if exists public.workshop_admins_section_week_unique;
create unique index workshop_admins_section_week_unique
  on public.workshop_administrations (
    workshop_slug, semester, section, week_of, instructor_id
  )
  where section is not null and cancelled_at is null;

-- FIN 3610 partial unique: one row per instructor's (workshop, week) when
-- section is null. This prevents an instructor from accidentally opening the
-- same workshop twice in the same week while allowing another class's window.
drop index if exists public.workshop_admins_nosection_week_unique;
create unique index workshop_admins_nosection_week_unique
  on public.workshop_administrations (
    workshop_slug, semester, week_of, instructor_id
  )
  where section is null and cancelled_at is null;

drop index if exists public.workshop_admins_course_window_idx;
create index workshop_admins_course_window_idx
  on public.workshop_administrations (course_slug, semester, opens_at, closes_at);
create index if not exists workshop_admins_instructor_idx
  on public.workshop_administrations (instructor_id);

alter table public.workshop_administrations
  drop constraint if exists workshop_admins_semester_check,
  drop constraint if exists workshop_admins_schedule_version_check,
  drop constraint if exists workshop_admins_schedule_check,
  drop constraint if exists workshop_admins_course_section_day_check,
  drop constraint if exists workshop_admins_location_check,
  drop constraint if exists workshop_admins_radius_check,
  drop constraint if exists workshop_admins_duration_check,
  drop constraint if exists workshop_admins_cancellation_check,
  drop constraint if exists workshop_admins_text_length_check;
alter table public.workshop_administrations
  add constraint workshop_admins_semester_check
    check (char_length(semester) between 1 and 64),
  add constraint workshop_admins_schedule_version_check
    check (schedule_version in (1, 2)),
  add constraint workshop_admins_schedule_check
    check (
      schedule_version = 1
      or week_of = date_trunc(
        'week', opens_at at time zone 'America/New_York'
      )::date
    ),
  add constraint workshop_admins_course_section_day_check
    check (
      schedule_version = 1
      or (
        course_slug = 'eco-1002'
        and section is not null
        and extract(isodow from opens_at at time zone 'America/New_York') =
          case section::text
            when 'CML' then 1
            when 'CTL' then 2
            when 'CWL' then 3
            when 'CRL' then 4
          end
      )
      or (course_slug = 'fin-3610' and section is null)
    ),
  add constraint workshop_admins_location_check
    check (
      (required_lat is null) = (required_lng is null)
      and (required_lat is null or required_lat between -90 and 90)
      and (required_lng is null or required_lng between -180 and 180)
    ),
  add constraint workshop_admins_radius_check
    check (required_radius_meters between 10 and 50000),
  add constraint workshop_admins_duration_check
    check (
      closes_at > opens_at
      and (schedule_version = 1 or closes_at <= opens_at + interval '24 hours')
    ),
  add constraint workshop_admins_cancellation_check
    check (cancelled_at is null or cancelled_at <= opens_at),
  add constraint workshop_admins_text_length_check
    check (
      char_length(location_label) between 1 and 120
      and (notes is null or char_length(notes) <= 200)
    );

-- Preserve every legacy workshop owner as an explicit assignment. As with
-- enrollment backfill, only a current instructor is activated automatically.
insert into public.teaching_assignments (
  instructor_id, course_slug, semester, active
)
select distinct
  a.instructor_id,
  a.course_slug,
  a.semester,
  p.role = 'instructor'
from public.workshop_administrations a
join public.profiles p on p.id = a.instructor_id
where a.course_slug in ('eco-1002', 'fin-3610')
  and char_length(a.semester) between 1 and 64
on conflict (instructor_id, course_slug, semester) do nothing;

alter table public.workshop_administrations
  drop constraint if exists workshop_admins_teaching_assignment_fkey;
alter table public.workshop_administrations
  add constraint workshop_admins_teaching_assignment_fkey
  foreign key (instructor_id, course_slug, semester)
  references public.teaching_assignments (instructor_id, course_slug, semester)
  on update restrict on delete restrict;

alter table public.workshop_administrations enable row level security;

drop policy if exists "workshop_admins_authenticated_read" on public.workshop_administrations;
drop policy if exists "workshop_admins_course_read" on public.workshop_administrations;
create policy "workshop_admins_course_read"
  on public.workshop_administrations for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      join public.teaching_assignments ta
        on ta.instructor_id = p.id
      where p.id = (select auth.uid())
        and p.role = 'instructor'
        and workshop_administrations.instructor_id = (select auth.uid())
        and ta.course_slug = workshop_administrations.course_slug
        and ta.semester = workshop_administrations.semester
        and ta.active
    )
    or exists (
      select 1 from public.enrollments e
      where e.user_id = (select auth.uid())
        and e.course_slug = workshop_administrations.course_slug
        and e.semester = workshop_administrations.semester
        and e.instructor_id = workshop_administrations.instructor_id
        and (
          workshop_administrations.section is null
          or e.section = workshop_administrations.section::text
        )
    )
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

-- Students need schedules and a yes/no geofence indicator, never the target
-- coordinate, radius, or instructor notes. Instructor detail pages use the
-- service-role client after an ownership check.
revoke select on table public.workshop_administrations from anon, authenticated;
revoke select (required_lat, required_lng, required_radius_meters, notes)
  on public.workshop_administrations from anon, authenticated;
grant select (
  id, workshop_slug, course_slug, semester, section, week_of,
  schedule_version, instructor_id, opens_at, closes_at, geofence_required,
  location_label, questions_revealed_at, cancelled_at, created_at
) on public.workshop_administrations to authenticated;
revoke insert, update, delete on table public.workshop_administrations
  from anon, authenticated;

-- Inserts/updates/deletes via service-role only (instructor UI uses it
-- under a verified instructor role server-side).

create table if not exists public.workshop_attendance (
  id uuid primary key default gen_random_uuid(),
  administration_id uuid not null references public.workshop_administrations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  stamped_at timestamptz not null default now(),
  device_hmac text,
  verification_method text not null,
  recorded_by uuid references public.profiles(id) on delete set null,
  correction_reason text,
  unique (administration_id, user_id)
);

alter table public.workshop_attendance
  add column if not exists device_hmac text,
  add column if not exists verification_method text,
  add column if not exists recorded_by uuid,
  add column if not exists correction_reason text;
update public.workshop_attendance
   set verification_method = 'legacy'
 where verification_method is null;
alter table public.workshop_attendance
  alter column verification_method drop default,
  alter column verification_method set not null;

-- New writes leave legacy verification columns null. Existing values remain
-- intact until the project owner separately authorizes a retention scrub.
do $$ begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'workshop_attendance'
       and column_name = 'device_id'
  ) then
    alter table public.workshop_attendance alter column device_id drop not null;
  end if;
end $$;

alter table public.workshop_attendance
  drop constraint if exists workshop_attendance_recorded_by_fkey,
  drop constraint if exists workshop_attendance_verification_check;
alter table public.workshop_attendance
  add constraint workshop_attendance_recorded_by_fkey
    foreign key (recorded_by) references public.profiles(id) on delete set null,
  add constraint workshop_attendance_verification_check
    check (
      (
        verification_method = 'legacy'
        and device_hmac is null
        and recorded_by is null
        and correction_reason is null
      )
      or (
        verification_method in ('geofence', 'window')
        and device_hmac ~ '^[0-9a-f]{64}$'
        and recorded_by is null
        and correction_reason is null
      )
      or (
        verification_method = 'manual'
        and device_hmac is null
        and char_length(correction_reason) between 1 and 200
      )
    );

create or replace function public.guard_workshop_attendee_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
     where p.id = new.user_id and p.role = 'student'
  ) then
    raise exception 'workshop attendance requires a student profile'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_workshop_attendee_role()
  from public, anon, authenticated, service_role;
drop trigger if exists workshop_attendance_student_check
  on public.workshop_attendance;
create trigger workshop_attendance_student_check
  before insert on public.workshop_attendance
  for each row execute function public.guard_workshop_attendee_role();

create or replace function public.validate_manual_workshop_attendance_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role public.user_role;
begin
  select p.role into actor_role
    from public.profiles p
   where p.id = new.recorded_by;

  if actor_role = 'admin' then
    return new;
  end if;

  if actor_role = 'instructor' and exists (
    select 1
      from public.workshop_administrations a
      join public.teaching_assignments ta
        on ta.instructor_id = a.instructor_id
       and ta.course_slug = a.course_slug
       and ta.semester = a.semester
       and ta.active
     where a.id = new.administration_id
       and a.instructor_id = new.recorded_by
  ) then
    return new;
  end if;

  raise exception 'manual attendance requires the owning instructor or an admin'
    using errcode = '23514';
end;
$$;

revoke all on function public.validate_manual_workshop_attendance_insert()
  from public, anon, authenticated, service_role;
drop trigger if exists workshop_attendance_manual_actor_check
  on public.workshop_attendance;
create trigger workshop_attendance_manual_actor_check
  before insert on public.workshop_attendance
  for each row
  when (new.verification_method = 'manual')
  execute function public.validate_manual_workshop_attendance_insert();

create index if not exists workshop_attendance_admin_idx
  on public.workshop_attendance (administration_id, stamped_at desc);
create index if not exists workshop_attendance_user_idx
  on public.workshop_attendance (user_id, stamped_at desc);
create unique index if not exists workshop_attendance_device_unique
  on public.workshop_attendance (administration_id, device_hmac)
  where device_hmac is not null;

alter table public.workshop_attendance enable row level security;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.instructor_can_read_workshop_attendance(
  p_administration_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.workshop_administrations a
      join public.enrollments e
        on e.user_id = p_user_id
       and e.course_slug = a.course_slug
       and e.semester = a.semester
      join public.teaching_assignments ta
        on ta.instructor_id = e.instructor_id
       and ta.course_slug = e.course_slug
       and ta.semester = e.semester
       and ta.active
      join public.profiles p
        on p.id = (select auth.uid())
       and p.role = 'instructor'
     where a.id = p_administration_id
       and a.instructor_id = (select auth.uid())
       and e.instructor_id = (select auth.uid())
  )
$$;
revoke all on function private.instructor_can_read_workshop_attendance(uuid, uuid)
  from public, anon, service_role;
grant execute on function private.instructor_can_read_workshop_attendance(uuid, uuid)
  to authenticated;

drop policy if exists "workshop_attendance_self_read" on public.workshop_attendance;
drop policy if exists "workshop_attendance_instructor_read_scoped" on public.workshop_attendance;
drop policy if exists "workshop_attendance_authenticated_read" on public.workshop_attendance;
drop function if exists public.instructor_can_read_workshop_attendance(uuid, uuid);
create policy "workshop_attendance_authenticated_read"
  on public.workshop_attendance for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
    or (select private.instructor_can_read_workshop_attendance(
      workshop_attendance.administration_id,
      workshop_attendance.user_id
    ))
  );

-- A student-facing attendance read only needs the result, not its protected
-- device token or the instructor's correction metadata. Authorized staff
-- detail/export pages read those fields through the service-role client.
revoke select on table public.workshop_attendance from anon, authenticated;
revoke select (device_hmac, recorded_by, correction_reason)
  on public.workshop_attendance from anon, authenticated;
grant select (
  id, administration_id, user_id, stamped_at, verification_method
) on public.workshop_attendance to authenticated;

-- Serialize authorization changes with writes that depend on them. App-level
-- checks still provide friendly errors; these triggers close revocation races.
create or replace function public.guard_active_assignment_reference()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('instructor:' || new.instructor_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'assignment:' || new.instructor_id::text || ':' ||
      new.course_slug || ':' || new.semester,
      0
    )
  );

  if tg_table_name = 'enrollments' then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'enrollment:' || (pg_catalog.to_jsonb(new)->>'user_id') || ':' ||
        new.course_slug || ':' || new.semester,
        0
      )
    );
  end if;

  if not exists (
    select 1
      from public.teaching_assignments ta
      join public.profiles p on p.id = ta.instructor_id
     where ta.instructor_id = new.instructor_id
       and ta.course_slug = new.course_slug
       and ta.semester = new.semester
       and ta.active
       and p.role = 'instructor'
  ) then
    raise exception 'an active instructor teaching assignment is required'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_active_assignment_reference()
  from public, anon, authenticated, service_role;

create or replace function public.guard_teaching_assignment_state()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_instructor_id uuid;
  v_course_slug text;
  v_semester text;
begin
  v_instructor_id := case when tg_op = 'DELETE'
    then old.instructor_id else new.instructor_id end;
  v_course_slug := case when tg_op = 'DELETE'
    then old.course_slug else new.course_slug end;
  v_semester := case when tg_op = 'DELETE'
    then old.semester else new.semester end;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('instructor:' || v_instructor_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'assignment:' || v_instructor_id::text || ':' ||
      v_course_slug || ':' || v_semester,
      0
    )
  );

  if tg_op = 'DELETE' then
    if old.active then
      raise exception 'deactivate teaching assignments before deleting them'
        using errcode = '23514';
    end if;
    return old;
  end if;

  if new.active and not exists (
    select 1 from public.profiles p
     where p.id = new.instructor_id and p.role = 'instructor'
  ) then
    raise exception 'teaching assignments require an instructor profile'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and old.active and not new.active and exists (
    select 1
      from public.workshop_administrations w
     where w.instructor_id = old.instructor_id
       and w.course_slug = old.course_slug
       and w.semester = old.semester
       and w.cancelled_at is null
       and w.closes_at >= pg_catalog.clock_timestamp()
  ) then
    raise exception 'close or cancel live and future workshops before deactivation'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_teaching_assignment_state()
  from public, anon, authenticated, service_role;

create or replace function public.guard_instructor_role_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_offboard_transfer boolean := false;
begin
  if old.role is distinct from new.role then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('instructor:' || new.id::text, 0)
    );
  end if;
  if old.role in ('instructor', 'ta') and new.role = 'student' then
    v_offboard_transfer :=
      current_setting('app.offboard_scope_transfer', true) = 'on'
      and nullif(
        current_setting('app.offboard_target_id', true), ''
      )::uuid = new.id;

    if exists (
      select 1 from public.teaching_assignments ta
       where ta.instructor_id = new.id
    ) or exists (
      select 1 from public.enrollments e where e.instructor_id = new.id
    ) or exists (
      select 1 from public.offering_lesson_progress p
       where p.instructor_id = new.id
    ) or exists (
      select 1 from public.quiz_attempts q where q.instructor_id = new.id
    ) or exists (
      select 1 from public.workshop_administrations w
       where w.instructor_id = new.id
    ) or exists (
      select 1 from public.archive_videos v where v.created_by = new.id
    ) or exists (
      select 1 from public.archive_papers p where p.created_by = new.id
    ) or exists (
      select 1 from public.archive_quizzes q where q.created_by = new.id
    ) or exists (
      select 1 from public.archive_paper_upload_intents i
       where i.actor_id = new.id
         and (not v_offboard_transfer or i.state = 'finalized')
    ) then
      raise exception 'offboard staff before changing their role to student'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_instructor_role_change()
  from public, anon, authenticated, service_role;

create or replace function public.guard_archive_creator_course()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  creator_role public.user_role;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('instructor:' || new.created_by::text, 0)
  );
  select p.role into creator_role
    from public.profiles p
   where p.id = new.created_by;

  if creator_role = 'admin' then
    return new;
  end if;
  if creator_role = 'instructor' and exists (
    select 1 from public.teaching_assignments ta
     where ta.instructor_id = new.created_by
       and ta.course_slug = new.course_slug
       and ta.active
  ) then
    return new;
  end if;
  raise exception 'archive creation requires an admin or active course instructor'
    using errcode = '23514';
end;
$$;
revoke all on function public.guard_archive_creator_course()
  from public, anon, authenticated, service_role;

-- Identity and authorization-scope changes use dedicated workflows. Reject
-- them before any advisory lock so row locks cannot invert the workflow order.
create or replace function public.reject_immutable_scope_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_target uuid;
  v_successor uuid;
begin
  if current_setting('app.offboard_scope_transfer', true) = 'on' then
    v_target := nullif(
      current_setting('app.offboard_target_id', true), ''
    )::uuid;
    v_successor := nullif(
      current_setting('app.offboard_successor_id', true), ''
    )::uuid;

    if tg_table_name = 'enrollments' then
      if old.user_id = new.user_id
         and old.course_slug = new.course_slug
         and old.semester = new.semester
         and old.instructor_id = v_target
         and new.instructor_id = v_successor then
        return new;
      end if;
    elsif tg_table_name = 'workshop_administrations' then
      if old.workshop_slug = new.workshop_slug
         and old.course_slug = new.course_slug
         and old.semester = new.semester
         and old.section is not distinct from new.section
         and old.week_of = new.week_of
         and old.instructor_id = v_target
         and new.instructor_id = v_successor then
        return new;
      end if;
    elsif tg_table_name in (
      'archive_videos', 'archive_papers', 'archive_quizzes'
    ) then
      if old.course_slug = new.course_slug
         and old.created_by = v_target
         and new.created_by = v_successor then
        return new;
      end if;
    end if;
  end if;

  raise exception '% identity or authorization scope is immutable', tg_table_name
    using errcode = '23514';
end;
$$;
revoke all on function public.reject_immutable_scope_update()
  from public, anon, authenticated, service_role;

create or replace function public.lock_enrollment_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_course_slug text;
begin
  if tg_op = 'DELETE' then
    v_user_id := old.user_id;
    v_course_slug := old.course_slug;
  else
    v_user_id := new.user_id;
    v_course_slug := new.course_slug;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'enrollment-scope:' || v_user_id::text || ':' || v_course_slug,
      0
    )
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
revoke all on function public.lock_enrollment_scope()
  from public, anon, authenticated, service_role;

drop trigger if exists teaching_assignments_state_insert
  on public.teaching_assignments;
create trigger teaching_assignments_state_insert
  before insert on public.teaching_assignments
  for each row execute function public.guard_teaching_assignment_state();
drop trigger if exists teaching_assignments_state_update
  on public.teaching_assignments;
create trigger teaching_assignments_state_update
  before update of active
  on public.teaching_assignments
  for each row execute function public.guard_teaching_assignment_state();
drop trigger if exists teaching_assignments_state_delete
  on public.teaching_assignments;
create trigger teaching_assignments_state_delete
  before delete on public.teaching_assignments
  for each row execute function public.guard_teaching_assignment_state();
drop trigger if exists teaching_assignments_identity_update
  on public.teaching_assignments;
create trigger teaching_assignments_identity_update
  before update of instructor_id, course_slug, semester
  on public.teaching_assignments
  for each row execute function public.reject_immutable_scope_update();

drop trigger if exists profiles_instructor_role_change on public.profiles;
create trigger profiles_instructor_role_change
  before update of role on public.profiles
  for each row execute function public.guard_instructor_role_change();

drop trigger if exists enrollments_active_assignment_insert
  on public.enrollments;
drop trigger if exists enrollments_scope_lock on public.enrollments;
create trigger enrollments_scope_lock
  before insert or update or delete on public.enrollments
  for each row execute function public.lock_enrollment_scope();
create trigger enrollments_active_assignment_insert
  before insert on public.enrollments
  for each row execute function public.guard_active_assignment_reference();
drop trigger if exists enrollments_active_assignment_update
  on public.enrollments;
drop trigger if exists enrollments_scope_update_reject
  on public.enrollments;
create trigger enrollments_scope_update_reject
  before update of user_id, instructor_id, course_slug, semester
  on public.enrollments
  for each row execute function public.reject_immutable_scope_update();

drop trigger if exists workshop_admins_active_assignment_insert
  on public.workshop_administrations;
create trigger workshop_admins_active_assignment_insert
  before insert on public.workshop_administrations
  for each row execute function public.guard_active_assignment_reference();
drop trigger if exists workshop_admins_active_assignment_update
  on public.workshop_administrations;
drop trigger if exists workshop_admins_scope_update_reject
  on public.workshop_administrations;
create trigger workshop_admins_scope_update_reject
  before update of workshop_slug, instructor_id, course_slug, semester,
    section, week_of
  on public.workshop_administrations
  for each row execute function public.reject_immutable_scope_update();

revoke insert, update, delete on table public.workshop_attendance
  from anon, authenticated;

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
  published boolean not null default false,
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
-- archive_paper_upload_intents --- durable authorization for direct uploads.
-- The browser uploads bytes straight to private Storage; finalization trusts
-- only this server-written metadata. The unique intent link on archive_papers
-- makes retries and concurrent finalizers idempotent.
-- =========================================================================
create table if not exists public.archive_paper_upload_intents (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete cascade,
  course_slug text not null,
  kind text not null,
  title text not null,
  semester_term text not null,
  semester_year integer not null,
  covers text[] not null default '{}',
  storage_path text not null unique,
  original_filename text not null,
  content_type text not null,
  file_size bigint not null,
  published boolean not null default false,
  state text not null default 'pending',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  finalized_at timestamptz,
  check (course_slug in ('eco-1002', 'fin-3610')),
  check (kind in ('exam', 'assignment')),
  check (char_length(title) between 1 and 200),
  check (semester_term in ('spring', 'summer', 'fall')),
  check (semester_year between 2020 and 2100),
  check (cardinality(covers) <= 100),
  check (char_length(storage_path) between 1 and 500),
  check (char_length(original_filename) between 1 and 160),
  check (content_type in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )),
  check (file_size between 1 and 26214400),
  check (state in ('pending', 'finalized', 'expired')),
  check (expires_at > created_at),
  check ((state = 'finalized') = (finalized_at is not null))
);

create index if not exists archive_paper_upload_intents_expiry_idx
  on public.archive_paper_upload_intents (state, expires_at);

alter table public.archive_paper_upload_intents enable row level security;
-- No policies: intents are service-role only.

-- Old upload flows could persist a publish flag before the bytes were
-- finalized. Only a finalized intent may carry that flag forward.
update public.archive_paper_upload_intents
   set published = false
 where state <> 'finalized' and published;
do $$ begin
  alter table public.archive_paper_upload_intents
    add constraint archive_paper_upload_intents_published_state_check
    check (not published or state = 'finalized');
exception when duplicate_object then null; end $$;
alter table public.archive_paper_upload_intents
  validate constraint archive_paper_upload_intents_published_state_check;

create or replace function public.reserve_archive_paper_upload_intent(
  p_id uuid,
  p_actor_id uuid,
  p_course_slug text,
  p_kind text,
  p_title text,
  p_semester_term text,
  p_semester_year integer,
  p_covers text[],
  p_storage_path text,
  p_original_filename text,
  p_content_type text,
  p_file_size bigint,
  p_expires_at timestamptz
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_actor_role public.user_role;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('instructor:' || p_actor_id::text, 0)
  );

  select p.role into v_actor_role
    from public.profiles p
   where p.id = p_actor_id;
  if not coalesce(
    v_actor_role = 'admin'::public.user_role
      or (
        v_actor_role = 'instructor'::public.user_role
        and exists (
          select 1 from public.teaching_assignments ta
           where ta.instructor_id = p_actor_id
             and ta.course_slug = p_course_slug
             and ta.active
        )
      ),
    false
  ) then
    raise exception 'archive upload requires active course authority'
      using errcode = '42501';
  end if;

  if (
    select count(*) >= 3
      from public.archive_paper_upload_intents
     where actor_id = p_actor_id
       and state = 'pending'
       and expires_at > now()
  ) then
    return false;
  end if;

  insert into public.archive_paper_upload_intents (
    id, actor_id, course_slug, kind, title, semester_term, semester_year,
    covers, storage_path, original_filename, content_type, file_size,
    published, state, expires_at
  ) values (
    p_id, p_actor_id, p_course_slug, p_kind, p_title, p_semester_term,
    p_semester_year, p_covers, p_storage_path, p_original_filename,
    p_content_type, p_file_size, false, 'pending', p_expires_at
  );
  return true;
end;
$$;

revoke all on function public.reserve_archive_paper_upload_intent(
  uuid, uuid, text, text, text, text, integer, text[], text, text, text,
  bigint, timestamptz
) from public, anon, authenticated;
grant execute on function public.reserve_archive_paper_upload_intent(
  uuid, uuid, text, text, text, text, integer, text[], text, text, text,
  bigint, timestamptz
) to service_role;

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
  upload_intent_id uuid,
  published boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  -- updated_at is maintained by the mutation API (set to now() on update).
  updated_at timestamptz not null default now(),
  check (kind in ('exam', 'assignment')),
  check (semester_term in ('spring', 'summer', 'fall')),
  check (semester_year between 2020 and 2100)
);

alter table public.archive_papers
  add column if not exists upload_intent_id uuid;
do $$ begin
  alter table public.archive_papers
    add constraint archive_papers_upload_intent_fkey
    foreign key (upload_intent_id)
    references public.archive_paper_upload_intents(id) on delete set null;
exception when duplicate_object then null; end $$;
create unique index if not exists archive_papers_upload_intent_uidx
  on public.archive_papers (upload_intent_id)
  where upload_intent_id is not null;

create index if not exists archive_papers_live_idx
  on public.archive_papers (course_slug)
  where deleted_at is null and published;

alter table public.archive_papers enable row level security;
-- No policies: service-role only (instructor UI gates in app code).

-- Lock and validate the upload intent in the same transaction that creates
-- its paper row. Cleanup claims the same intent row, so exactly one side can
-- win and finalized bytes cannot be deleted from a stale cleanup snapshot.
create or replace function public.guard_archive_paper_upload_link()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_intent public.archive_paper_upload_intents%rowtype;
begin
  if new.upload_intent_id is null then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('instructor:' || new.created_by::text, 0)
  );
  if not exists (
    select 1 from public.profiles p
     where p.id = new.created_by
       and (
         p.role = 'admin'
         or (
           p.role = 'instructor'
           and exists (
             select 1 from public.teaching_assignments ta
              where ta.instructor_id = new.created_by
                and ta.course_slug = new.course_slug
                and ta.active
           )
         )
       )
  ) then
    raise exception 'paper finalization requires active course authority'
      using errcode = '23514';
  end if;

  select i.* into v_intent
    from public.archive_paper_upload_intents i
   where i.id = new.upload_intent_id
   for update;
  if not found
     or v_intent.actor_id <> new.created_by
     or v_intent.course_slug <> new.course_slug
     or v_intent.kind <> new.kind
     or v_intent.title <> new.title
     or v_intent.semester_term <> new.semester_term
     or v_intent.semester_year <> new.semester_year
     or v_intent.covers is distinct from new.covers
     or v_intent.storage_path <> new.storage_path
     or v_intent.original_filename <> new.original_filename
     or v_intent.content_type <> new.content_type
     or v_intent.file_size <> new.size_bytes
     or v_intent.published <> new.published
     or v_intent.state <> 'pending'
     or v_intent.expires_at <= pg_catalog.clock_timestamp() then
    raise exception 'paper upload intent is missing, expired, or mismatched'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_archive_paper_upload_link()
  from public, anon, authenticated, service_role;

create or replace function public.finalize_archive_paper_upload_link()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.upload_intent_id is not null then
    update public.archive_paper_upload_intents
       set state = 'finalized',
           finalized_at = pg_catalog.clock_timestamp()
     where id = new.upload_intent_id and state = 'pending';
    if not found then
      raise exception 'paper upload intent could not be finalized'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.finalize_archive_paper_upload_link()
  from public, anon, authenticated, service_role;

drop trigger if exists archive_papers_upload_link_guard
  on public.archive_papers;
create trigger archive_papers_upload_link_guard
  before insert on public.archive_papers
  for each row execute function public.guard_archive_paper_upload_link();
drop trigger if exists archive_papers_upload_link_finalize
  on public.archive_papers;
create trigger archive_papers_upload_link_finalize
  after insert on public.archive_papers
  for each row execute function public.finalize_archive_paper_upload_link();

create or replace function public.claim_archive_paper_upload_intents(
  p_actor_id uuid,
  p_before timestamptz,
  p_limit integer default 100
)
returns table(intent_id uuid, storage_path text, action text)
language plpgsql
set search_path = ''
as $$
declare
  v_intent record;
begin
  if p_before is null or p_limit not between 1 and 1000 then
    raise exception 'invalid upload cleanup claim input'
      using errcode = '22023';
  end if;

  for v_intent in
    select i.id, i.storage_path
      from public.archive_paper_upload_intents i
     where i.state in ('pending', 'expired')
       and (
         (p_actor_id is not null and i.actor_id = p_actor_id)
         or (
           p_actor_id is null
           and i.expires_at < p_before
         )
       )
     order by i.expires_at, i.id
     for update skip locked
     limit p_limit
  loop
    intent_id := v_intent.id;
    storage_path := v_intent.storage_path;
    if exists (
      select 1 from public.archive_papers p
       where p.upload_intent_id = v_intent.id
    ) then
      update public.archive_paper_upload_intents
         set state = 'finalized',
             finalized_at = coalesce(
               finalized_at, pg_catalog.clock_timestamp()
             )
       where id = v_intent.id;
      action := 'repair';
    else
      update public.archive_paper_upload_intents
         set state = 'expired', finalized_at = null, published = false
       where id = v_intent.id;
      action := 'delete';
    end if;
    return next;
  end loop;
end;
$$;
revoke all on function public.claim_archive_paper_upload_intents(
  uuid, timestamptz, integer
) from public, anon, authenticated;
grant execute on function public.claim_archive_paper_upload_intents(
  uuid, timestamptz, integer
) to service_role;

-- Private Storage bucket for paper files. Access only via service-role
-- createSignedUrl(); no public reads. Idempotent.
-- Wrapped so a stock Postgres without Supabase's `storage` schema (e.g. the
-- schema-roundtrip CI stub) doesn't abort. Real Supabase has storage.buckets.
do $$ begin
  insert into storage.buckets (
    id, name, public, file_size_limit, allowed_mime_types
  ) values (
    'archive-papers',
    'archive-papers',
    false,
    26214400,
    array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  )
  on conflict (id) do update
    set public = false,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
exception
  -- Skip only on stock Postgres CI, which has no Supabase Storage schema.
  -- Hosted permission or bucket-shape errors must abort the migration.
  when invalid_schema_name or undefined_table then null;
end $$;

-- =========================================================================
-- archive_quizzes --- instructor-authored interactive quizzes (exam/assignment)
-- surfaced in the archive and taken at /practice/<id>. RLS-locked; questions
-- (incl. answer keys) live in jsonb, server-only. Validated app-side by the
-- Zod schema in src/lib/quiz/question-schema.ts before insert.
-- =========================================================================
create table if not exists public.archive_quizzes (
  id uuid primary key default gen_random_uuid(),
  course_slug text not null,
  kind text not null,
  title text not null,
  semester_term text not null,
  semester_year integer not null,
  covers text[] not null default '{}',
  questions jsonb not null,
  passing_score numeric not null default 0.7,
  created_by uuid not null references public.profiles(id) on delete restrict,
  published boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  -- updated_at maintained by the mutation API.
  updated_at timestamptz not null default now(),
  check (kind in ('exam', 'assignment')),
  check (semester_term in ('spring', 'summer', 'fall')),
  check (semester_year between 2020 and 2100),
  check (passing_score >= 0 and passing_score <= 1)
);

alter table public.archive_videos alter column published set default false;
alter table public.archive_paper_upload_intents
  alter column published set default false;
alter table public.archive_papers alter column published set default false;
alter table public.archive_quizzes alter column published set default false;

create index if not exists archive_quizzes_live_idx
  on public.archive_quizzes (course_slug)
  where deleted_at is null and published;

alter table public.archive_quizzes enable row level security;
-- No policies: service-role only (instructor UI gates in app code).

-- Backstop: restrict archive content to known course slugs (defense-in-depth;
-- the create routes also validate). Idempotent.
do $$ begin
  alter table public.archive_papers
    add constraint archive_papers_course_chk check (course_slug in ('eco-1002', 'fin-3610'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.archive_quizzes
    add constraint archive_quizzes_course_chk check (course_slug in ('eco-1002', 'fin-3610'));
exception when duplicate_object then null; end $$;

alter table public.archive_videos
  drop constraint if exists archive_videos_input_check;
alter table public.archive_videos
  add constraint archive_videos_input_check check (
    char_length(title) between 1 and 200
    and char_length(lesson_slug) between 1 and 200
    and char_length(video_id) between 1 and 64
    and (description is null or char_length(description) <= 2000)
    and (duration_minutes is null or duration_minutes between 1 and 1440)
  ) not valid;
alter table public.archive_videos
  validate constraint archive_videos_input_check;

alter table public.archive_papers
  drop constraint if exists archive_papers_input_check;
alter table public.archive_papers
  add constraint archive_papers_input_check check (
    char_length(title) between 1 and 200
    and cardinality(covers) <= 100
    and char_length(storage_path) between 1 and 500
    and char_length(original_filename) between 1 and 160
    and content_type in (
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
    and size_bytes between 1 and 26214400
  ) not valid;
alter table public.archive_papers
  validate constraint archive_papers_input_check;

alter table public.archive_quizzes
  drop constraint if exists archive_quizzes_input_check;
alter table public.archive_quizzes
  add constraint archive_quizzes_input_check check (
    char_length(title) between 1 and 200
    and cardinality(covers) <= 100
    and jsonb_typeof(questions) = 'array'
    and jsonb_array_length(questions) between 1 and 100
  ) not valid;
alter table public.archive_quizzes
  validate constraint archive_quizzes_input_check;

drop trigger if exists archive_videos_creator_course_insert
  on public.archive_videos;
create trigger archive_videos_creator_course_insert
  before insert on public.archive_videos
  for each row execute function public.guard_archive_creator_course();
drop trigger if exists archive_videos_creator_course_update
  on public.archive_videos;
drop trigger if exists archive_videos_scope_update_reject
  on public.archive_videos;
create trigger archive_videos_scope_update_reject
  before update of created_by, course_slug on public.archive_videos
  for each row execute function public.reject_immutable_scope_update();

drop trigger if exists archive_papers_creator_course_insert
  on public.archive_papers;
create trigger archive_papers_creator_course_insert
  before insert on public.archive_papers
  for each row execute function public.guard_archive_creator_course();
drop trigger if exists archive_papers_creator_course_update
  on public.archive_papers;
drop trigger if exists archive_papers_scope_update_reject
  on public.archive_papers;
create trigger archive_papers_scope_update_reject
  before update of created_by, course_slug on public.archive_papers
  for each row execute function public.reject_immutable_scope_update();

drop trigger if exists archive_quizzes_creator_course_insert
  on public.archive_quizzes;
create trigger archive_quizzes_creator_course_insert
  before insert on public.archive_quizzes
  for each row execute function public.guard_archive_creator_course();
drop trigger if exists archive_quizzes_creator_course_update
  on public.archive_quizzes;
drop trigger if exists archive_quizzes_scope_update_reject
  on public.archive_quizzes;
create trigger archive_quizzes_scope_update_reject
  before update of created_by, course_slug on public.archive_quizzes
  for each row execute function public.reject_immutable_scope_update();

-- Actor-aware mutation functions serialize the final authorization check with
-- the write. Server routes still preflight for useful errors, but a concurrent
-- role or teaching-assignment revocation cannot slip between check and write.
create or replace function public.apply_roster_import(
  p_actor_id uuid,
  p_instructor_id uuid,
  p_course_slug text,
  p_semester text,
  p_rows jsonb
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  actor_role public.user_role;
  lock_user_id uuid;
  changed_rows integer;
  expected_rows integer;
begin
  if p_actor_id is null
     or p_instructor_id is null
     or p_course_slug is null
     or p_semester is null
     or p_course_slug not in ('eco-1002', 'fin-3610')
     or char_length(p_semester) not between 1 and 64
     or jsonb_typeof(p_rows) is distinct from 'array'
     or jsonb_array_length(p_rows) not between 1 and 5000 then
    raise exception 'invalid roster import input' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('instructor:' || p_actor_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('instructor:' || p_instructor_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'assignment:' || p_instructor_id::text || ':' ||
      p_course_slug || ':' || p_semester,
      0
    )
  );

  select p.role into actor_role
    from public.profiles p
   where p.id = p_actor_id;
  if not coalesce(
    actor_role = 'admin'::public.user_role
      or (
        actor_role = 'instructor'::public.user_role
        and p_actor_id = p_instructor_id
      ),
    false
  ) then
    return false;
  end if;
  if not exists (
    select 1
      from public.teaching_assignments ta
      join public.profiles p on p.id = ta.instructor_id
     where ta.instructor_id = p_instructor_id
       and ta.course_slug = p_course_slug
       and ta.semester = p_semester
       and ta.active
       and p.role = 'instructor'
  ) then
    return false;
  end if;

  if exists (
    select 1
      from jsonb_to_recordset(p_rows) as r(
        user_id uuid,
        student_name text,
        section text,
        expected_existing boolean
      )
     where r.user_id is null
        or r.expected_existing is null
        or (
          r.student_name is not null
          and char_length(r.student_name) not between 1 and 120
        )
        or (
          p_course_slug = 'eco-1002'
          and (
            r.section is null
            or not (r.section = any (array['CML', 'CTL', 'CWL', 'CRL']))
          )
        )
        or (p_course_slug = 'fin-3610' and r.section is not null)
  ) then
    raise exception 'invalid roster row' using errcode = '22023';
  end if;
  if (
    select count(*) <> count(distinct r.user_id)
      from jsonb_to_recordset(p_rows) as r(user_id uuid)
  ) then
    raise exception 'duplicate roster user' using errcode = '22023';
  end if;

  for lock_user_id in
    select r.user_id
      from jsonb_to_recordset(p_rows) as r(user_id uuid)
     order by r.user_id::text
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'enrollment-scope:' || lock_user_id::text || ':' || p_course_slug,
        0
      )
    );
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'enrollment:' || lock_user_id::text || ':' ||
        p_course_slug || ':' || p_semester,
        0
      )
    );
  end loop;

  if exists (
    select 1
      from jsonb_to_recordset(p_rows) as r(
        user_id uuid,
        expected_existing boolean
      )
      left join public.enrollments e
        on e.user_id = r.user_id
       and e.course_slug = p_course_slug
       and e.semester = p_semester
     where (
       r.expected_existing
       and (e.user_id is null or e.instructor_id <> p_instructor_id)
     ) or (
       not r.expected_existing and e.user_id is not null
     )
  ) then
    return false;
  end if;

  with input_rows as (
    select *
      from jsonb_to_recordset(p_rows) as r(
        user_id uuid,
        student_name text,
        section text,
        expected_existing boolean
      )
  )
  update public.enrollments e
     set student_name = r.student_name,
         section = r.section
    from input_rows r
   where r.expected_existing
     and e.user_id = r.user_id
     and e.course_slug = p_course_slug
     and e.semester = p_semester
     and e.instructor_id = p_instructor_id;
  get diagnostics changed_rows = row_count;
  select count(*) into expected_rows
    from jsonb_to_recordset(p_rows) as r(expected_existing boolean)
   where r.expected_existing;
  if changed_rows <> expected_rows then
    raise exception 'roster changed during import' using errcode = '40001';
  end if;

  insert into public.enrollments (
    user_id,
    course_slug,
    instructor_id,
    semester,
    student_name,
    section
  )
  select
    r.user_id,
    p_course_slug,
    p_instructor_id,
    p_semester,
    r.student_name,
    r.section
  from jsonb_to_recordset(p_rows) as r(
    user_id uuid,
    student_name text,
    section text,
    expected_existing boolean
  )
  where not r.expected_existing;

  return true;
end;
$$;
revoke all on function public.apply_roster_import(
  uuid, uuid, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.apply_roster_import(
  uuid, uuid, text, text, jsonb
) to service_role;

create or replace function public.mutate_enrollment(
  p_actor_id uuid,
  p_user_id uuid,
  p_course_slug text,
  p_semester text,
  p_instructor_id uuid,
  p_student_name text,
  p_section text,
  p_operation text
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  actor_role public.user_role;
  changed_rows integer;
begin
  if p_actor_id is null
     or p_user_id is null
     or p_instructor_id is null
     or p_course_slug is null
     or p_semester is null
     or p_operation is null
     or p_course_slug not in ('eco-1002', 'fin-3610')
     or char_length(p_semester) not between 1 and 64
     or p_operation not in ('insert', 'update', 'delete') then
    raise exception 'invalid enrollment mutation input' using errcode = '22023';
  end if;
  if p_operation in ('insert', 'update') and (
    (p_student_name is not null and char_length(p_student_name) not between 1 and 120)
    or (
      p_course_slug = 'eco-1002'
      and (
        p_section is null
        or not (p_section = any (array['CML', 'CTL', 'CWL', 'CRL']))
      )
    )
    or (p_course_slug = 'fin-3610' and p_section is not null)
  ) then
    raise exception 'invalid enrollment update' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('instructor:' || p_actor_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('instructor:' || p_instructor_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'assignment:' || p_instructor_id::text || ':' ||
      p_course_slug || ':' || p_semester,
      0
    )
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'enrollment-scope:' || p_user_id::text || ':' || p_course_slug,
      0
    )
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'enrollment:' || p_user_id::text || ':' ||
      p_course_slug || ':' || p_semester,
      0
    )
  );

  select p.role into actor_role
    from public.profiles p
   where p.id = p_actor_id;
  if not coalesce(
    actor_role = 'admin'::public.user_role
      or (
        actor_role = 'instructor'::public.user_role
        and p_actor_id = p_instructor_id
        and exists (
          select 1 from public.teaching_assignments ta
           where ta.instructor_id = p_actor_id
             and ta.course_slug = p_course_slug
             and ta.semester = p_semester
             and ta.active
        )
      ),
    false
  ) then
    return false;
  end if;
  if p_operation = 'insert' and not exists (
    select 1
      from public.teaching_assignments ta
      join public.profiles p on p.id = ta.instructor_id
     where ta.instructor_id = p_instructor_id
       and ta.course_slug = p_course_slug
       and ta.semester = p_semester
       and ta.active
       and p.role = 'instructor'
  ) then
    return false;
  end if;

  if p_operation = 'insert' then
    insert into public.enrollments (
      user_id,
      course_slug,
      instructor_id,
      semester,
      student_name,
      section
    ) values (
      p_user_id,
      p_course_slug,
      p_instructor_id,
      p_semester,
      p_student_name,
      p_section
    );
  elsif p_operation = 'update' then
    update public.enrollments
       set student_name = p_student_name,
           section = p_section
     where user_id = p_user_id
       and course_slug = p_course_slug
       and semester = p_semester
       and instructor_id = p_instructor_id;
  else
    delete from public.enrollments
     where user_id = p_user_id
       and course_slug = p_course_slug
       and semester = p_semester
       and instructor_id = p_instructor_id;
  end if;
  get diagnostics changed_rows = row_count;
  return changed_rows = 1;
end;
$$;
revoke all on function public.mutate_enrollment(
  uuid, uuid, text, text, uuid, text, text, text
) from public, anon, authenticated;
grant execute on function public.mutate_enrollment(
  uuid, uuid, text, text, uuid, text, text, text
) to service_role;

create or replace function public.mutate_archive_item(
  p_actor_id uuid,
  p_resource text,
  p_id uuid,
  p_operation text,
  p_patch jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  actor_role public.user_role;
  item_course text;
  item_creator uuid;
begin
  if p_actor_id is null
     or p_id is null
     or p_resource is null
     or p_operation is null
     or p_resource not in ('video', 'paper', 'quiz')
     or p_operation not in ('update', 'delete') then
    raise exception 'invalid archive mutation input' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('instructor:' || p_actor_id::text, 0)
  );
  select p.role into actor_role
    from public.profiles p
   where p.id = p_actor_id;

  if p_resource = 'video' then
    select v.course_slug, v.created_by
      into item_course, item_creator
      from public.archive_videos v
     where v.id = p_id and v.deleted_at is null
     for update;
  elsif p_resource = 'paper' then
    select p.course_slug, p.created_by
      into item_course, item_creator
      from public.archive_papers p
     where p.id = p_id and p.deleted_at is null
     for update;
  else
    select q.course_slug, q.created_by
      into item_course, item_creator
      from public.archive_quizzes q
     where q.id = p_id and q.deleted_at is null
     for update;
  end if;
  if not found then
    return false;
  end if;
  if not coalesce(
    actor_role = 'admin'::public.user_role
      or (
        actor_role = 'instructor'::public.user_role
        and item_creator = p_actor_id
        and exists (
          select 1 from public.teaching_assignments ta
           where ta.instructor_id = p_actor_id
             and ta.course_slug = item_course
             and ta.active
        )
      ),
    false
  ) then
    return false;
  end if;

  if p_operation = 'delete' then
    if p_resource = 'video' then
      update public.archive_videos
         set deleted_at = pg_catalog.clock_timestamp(),
             updated_at = pg_catalog.clock_timestamp()
       where id = p_id and deleted_at is null;
    elsif p_resource = 'paper' then
      update public.archive_papers
         set deleted_at = pg_catalog.clock_timestamp(),
             updated_at = pg_catalog.clock_timestamp()
       where id = p_id and deleted_at is null;
    else
      update public.archive_quizzes
         set deleted_at = pg_catalog.clock_timestamp(),
             updated_at = pg_catalog.clock_timestamp()
       where id = p_id and deleted_at is null;
    end if;
    return found;
  end if;

  if jsonb_typeof(p_patch) is distinct from 'object' then
    raise exception 'invalid archive patch' using errcode = '22023';
  end if;
  if p_resource = 'video' then
    if not (p_patch ?& array[
      'lesson_slug', 'semester_term', 'semester_year', 'title', 'provider',
      'video_id', 'description', 'duration_minutes', 'published'
    ]) or p_patch - array[
      'lesson_slug', 'semester_term', 'semester_year', 'title', 'provider',
      'video_id', 'description', 'duration_minutes', 'published'
    ] <> '{}'::jsonb then
      raise exception 'invalid video patch' using errcode = '22023';
    end if;
    update public.archive_videos
       set lesson_slug = p_patch->>'lesson_slug',
           semester_term = p_patch->>'semester_term',
           semester_year = (p_patch->>'semester_year')::integer,
           title = p_patch->>'title',
           provider = p_patch->>'provider',
           video_id = p_patch->>'video_id',
           description = p_patch->>'description',
           duration_minutes = (p_patch->>'duration_minutes')::integer,
           published = (p_patch->>'published')::boolean,
           updated_at = pg_catalog.clock_timestamp()
     where id = p_id and deleted_at is null;
  elsif p_resource = 'paper' then
    if not (p_patch ?& array[
      'kind', 'title', 'semester_term', 'semester_year', 'covers', 'published'
    ]) or p_patch - array[
      'kind', 'title', 'semester_term', 'semester_year', 'covers', 'published'
    ] <> '{}'::jsonb then
      raise exception 'invalid paper patch' using errcode = '22023';
    end if;
    update public.archive_papers
       set kind = p_patch->>'kind',
           title = p_patch->>'title',
           semester_term = p_patch->>'semester_term',
           semester_year = (p_patch->>'semester_year')::integer,
           covers = array(
             select jsonb_array_elements_text(p_patch->'covers')
           ),
           published = (p_patch->>'published')::boolean,
           updated_at = pg_catalog.clock_timestamp()
     where id = p_id and deleted_at is null;
  else
    if not (p_patch ?& array[
      'kind', 'title', 'semester_term', 'semester_year', 'covers',
      'questions', 'passing_score', 'published'
    ]) or p_patch - array[
      'kind', 'title', 'semester_term', 'semester_year', 'covers',
      'questions', 'passing_score', 'published'
    ] <> '{}'::jsonb then
      raise exception 'invalid quiz patch' using errcode = '22023';
    end if;
    update public.archive_quizzes
       set kind = p_patch->>'kind',
           title = p_patch->>'title',
           semester_term = p_patch->>'semester_term',
           semester_year = (p_patch->>'semester_year')::integer,
           covers = array(
             select jsonb_array_elements_text(p_patch->'covers')
           ),
           questions = p_patch->'questions',
           passing_score = (p_patch->>'passing_score')::numeric,
           published = (p_patch->>'published')::boolean,
           updated_at = pg_catalog.clock_timestamp()
     where id = p_id and deleted_at is null;
  end if;
  return found;
end;
$$;
revoke all on function public.mutate_archive_item(
  uuid, text, uuid, text, jsonb
) from public, anon, authenticated;
grant execute on function public.mutate_archive_item(
  uuid, text, uuid, text, jsonb
) to service_role;

create or replace function public.mutate_workshop(
  p_actor_id uuid,
  p_administration_id uuid,
  p_operation text,
  p_target_user_id uuid default null,
  p_reason text default null
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  actor_role public.user_role;
  administration public.workshop_administrations%rowtype;
  changed_rows integer;
begin
  if p_actor_id is null
     or p_administration_id is null
     or p_operation is null
     or p_operation not in (
    'cancel', 'close', 'reveal', 'manual_add', 'manual_remove'
  ) then
    raise exception 'invalid workshop mutation input' using errcode = '22023';
  end if;
  if p_operation in ('manual_add', 'manual_remove') and (
    p_target_user_id is null
    or p_reason is null
    or char_length(p_reason) not between 1 and 200
  ) then
    raise exception 'invalid manual attendance input' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('instructor:' || p_actor_id::text, 0)
  );
  select p.role into actor_role
    from public.profiles p
   where p.id = p_actor_id;
  select a.* into administration
    from public.workshop_administrations a
   where a.id = p_administration_id
   for update;
  if not found then
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'assignment:' || administration.instructor_id::text || ':' ||
      administration.course_slug || ':' || administration.semester,
      0
    )
  );
  if not coalesce(
    actor_role = 'admin'::public.user_role
      or (
        actor_role = 'instructor'::public.user_role
        and administration.instructor_id = p_actor_id
        and exists (
          select 1 from public.teaching_assignments ta
           where ta.instructor_id = p_actor_id
             and ta.course_slug = administration.course_slug
             and ta.semester = administration.semester
             and ta.active
        )
      ),
    false
  ) then
    return false;
  end if;

  if p_operation = 'cancel' then
    if administration.cancelled_at is not null
       or pg_catalog.clock_timestamp() >= administration.opens_at then
      return false;
    end if;
    update public.workshop_administrations
       set cancelled_at = pg_catalog.clock_timestamp()
     where id = p_administration_id and cancelled_at is null;
    return found;
  elsif p_operation = 'close' then
    if administration.cancelled_at is not null
       or pg_catalog.clock_timestamp() < administration.opens_at
       or pg_catalog.clock_timestamp() >= administration.closes_at then
      return false;
    end if;
    update public.workshop_administrations
       set closes_at = greatest(
         pg_catalog.clock_timestamp(),
         administration.opens_at + interval '1 microsecond'
       )
     where id = p_administration_id;
    return found;
  elsif p_operation = 'reveal' then
    if administration.cancelled_at is not null
       or pg_catalog.clock_timestamp() < administration.opens_at then
      return false;
    end if;
    update public.workshop_administrations
       set questions_revealed_at = coalesce(
         questions_revealed_at,
         pg_catalog.clock_timestamp()
       )
     where id = p_administration_id;
    return found;
  end if;

  if administration.cancelled_at is not null
     or pg_catalog.clock_timestamp() < administration.opens_at then
    return false;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'enrollment:' || p_target_user_id::text || ':' ||
      administration.course_slug || ':' || administration.semester,
      0
    )
  );
  if p_operation = 'manual_add' then
    if not exists (
      select 1
        from public.enrollments e
        join public.profiles p
          on p.id = e.user_id and p.role = 'student'
       where e.user_id = p_target_user_id
         and e.course_slug = administration.course_slug
         and e.semester = administration.semester
         and e.instructor_id = administration.instructor_id
         and e.section is not distinct from administration.section::text
    ) then
      return false;
    end if;
    insert into public.workshop_attendance (
      administration_id,
      user_id,
      verification_method,
      recorded_by,
      correction_reason
    ) values (
      p_administration_id,
      p_target_user_id,
      'manual',
      p_actor_id,
      p_reason
    );
    return true;
  end if;

  delete from public.workshop_attendance
   where administration_id = p_administration_id
     and user_id = p_target_user_id
     and verification_method = 'manual';
  get diagnostics changed_rows = row_count;
  return changed_rows = 1;
end;
$$;
revoke all on function public.mutate_workshop(
  uuid, uuid, text, uuid, text
) from public, anon, authenticated;
grant execute on function public.mutate_workshop(
  uuid, uuid, text, uuid, text
) to service_role;

create or replace function public.record_workshop_stamp(
  p_user_id uuid,
  p_administration_id uuid,
  p_device_hmac text,
  p_verification_method text
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  administration public.workshop_administrations%rowtype;
begin
  if p_user_id is null
     or p_administration_id is null
     or p_device_hmac is null
     or p_verification_method is null
     or p_device_hmac !~ '^[0-9a-f]{64}$'
     or p_verification_method not in ('geofence', 'window') then
    raise exception 'invalid workshop stamp input' using errcode = '22023';
  end if;

  select a.* into administration
    from public.workshop_administrations a
   where a.id = p_administration_id
   for update;
  if not found
     or administration.cancelled_at is not null
     or pg_catalog.clock_timestamp() < administration.opens_at
     or pg_catalog.clock_timestamp() > administration.closes_at
     or (
       administration.geofence_required
       and p_verification_method <> 'geofence'
     )
     or (
       not administration.geofence_required
       and p_verification_method <> 'window'
     ) then
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'enrollment:' || p_user_id::text || ':' ||
      administration.course_slug || ':' || administration.semester,
      0
    )
  );
  if not exists (
    select 1
      from public.enrollments e
      join public.profiles p
        on p.id = e.user_id and p.role = 'student'
     where e.user_id = p_user_id
       and e.course_slug = administration.course_slug
       and e.semester = administration.semester
       and e.instructor_id = administration.instructor_id
       and e.section is not distinct from administration.section::text
  ) then
    return false;
  end if;

  insert into public.workshop_attendance (
    administration_id,
    user_id,
    device_hmac,
    verification_method
  ) values (
    p_administration_id,
    p_user_id,
    p_device_hmac,
    p_verification_method
  );
  return true;
end;
$$;
revoke all on function public.record_workshop_stamp(
  uuid, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.record_workshop_stamp(
  uuid, uuid, text, text
) to service_role;

create or replace function public.offboard_staff(
  p_actor_id uuid,
  p_target_id uuid,
  p_successor_id uuid
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_actor_role public.user_role;
  v_target_role public.user_role;
  v_successor_role public.user_role;
  v_lock_id uuid;
  v_scope record;
begin
  if p_actor_id is null
     or p_target_id is null
     or p_successor_id is null
     or p_actor_id = p_target_id
     or p_target_id = p_successor_id then
    raise exception 'invalid staff offboarding input' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('instructor:' || p_actor_id::text, 0)
  );
  for v_lock_id in
    select distinct v.id
      from (values (p_target_id), (p_successor_id)) v(id)
     order by v.id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('instructor:' || v_lock_id::text, 0)
    );
  end loop;

  select p.role into v_actor_role
    from public.profiles p where p.id = p_actor_id for update;
  select p.role into v_target_role
    from public.profiles p where p.id = p_target_id for update;
  select p.role into v_successor_role
    from public.profiles p where p.id = p_successor_id for update;

  if v_actor_role is distinct from 'admin'::public.user_role then
    return 'forbidden';
  end if;
  if v_successor_role is distinct from 'instructor'::public.user_role then
    return 'invalid_roles';
  end if;
  if v_target_role = 'student'::public.user_role then
    if exists (
      select 1 from public.audit_log a
       where a.action = 'admin_offboard_staff'
         and a.target_user_id = p_target_id
         and a.metadata->>'successor_id' = p_successor_id::text
    ) then
      return 'already_offboarded';
    end if;
    return 'invalid_roles';
  end if;
  if v_target_role is null or v_target_role not in (
    'instructor'::public.user_role, 'ta'::public.user_role
  ) then
    return 'invalid_roles';
  end if;

  -- Moving a live row onto an identical successor-owned window would violate
  -- the weekly uniqueness contract. Report it before making any changes.
  if exists (
    select 1
      from public.workshop_administrations old_w
      join public.workshop_administrations new_w
        on new_w.instructor_id = p_successor_id
       and new_w.workshop_slug = old_w.workshop_slug
       and new_w.semester = old_w.semester
       and new_w.section is not distinct from old_w.section
       and new_w.week_of = old_w.week_of
       and new_w.cancelled_at is null
     where old_w.instructor_id = p_target_id
       and old_w.cancelled_at is null
  ) then
    return 'conflict';
  end if;

  for v_scope in
    select ta.course_slug, ta.semester
      from public.teaching_assignments ta
     where ta.instructor_id = p_target_id
     order by ta.course_slug, ta.semester
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'assignment:' || p_target_id::text || ':' ||
        v_scope.course_slug || ':' || v_scope.semester,
        0
      )
    );
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'assignment:' || p_successor_id::text || ':' ||
        v_scope.course_slug || ':' || v_scope.semester,
        0
      )
    );
  end loop;

  for v_scope in
    select distinct e.user_id, e.course_slug
      from public.enrollments e
     where e.instructor_id = p_target_id
     order by e.user_id, e.course_slug
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'enrollment-scope:' || v_scope.user_id::text || ':' ||
        v_scope.course_slug,
        0
      )
    );
  end loop;

  insert into public.teaching_assignments (
    instructor_id, course_slug, semester, active, assigned_by,
    assigned_at, updated_at
  )
  select
    p_successor_id, ta.course_slug, ta.semester, ta.active, p_actor_id,
    pg_catalog.clock_timestamp(), pg_catalog.clock_timestamp()
    from public.teaching_assignments ta
   where ta.instructor_id = p_target_id
  on conflict (instructor_id, course_slug, semester) do update
    set active = public.teaching_assignments.active or excluded.active,
        assigned_by = p_actor_id,
        updated_at = pg_catalog.clock_timestamp();

  perform pg_catalog.set_config('app.offboard_scope_transfer', 'on', true);
  perform pg_catalog.set_config(
    'app.offboard_target_id', p_target_id::text, true
  );
  perform pg_catalog.set_config(
    'app.offboard_successor_id', p_successor_id::text, true
  );

  update public.offering_lesson_progress
     set instructor_id = p_successor_id
   where instructor_id = p_target_id;
  update public.quiz_attempts
     set instructor_id = p_successor_id
   where instructor_id = p_target_id;
  update public.enrollments
     set instructor_id = p_successor_id
   where instructor_id = p_target_id;
  update public.workshop_administrations
     set instructor_id = p_successor_id
   where instructor_id = p_target_id;
  update public.archive_videos
     set created_by = p_successor_id,
         updated_at = pg_catalog.clock_timestamp()
   where created_by = p_target_id;
  update public.archive_papers
     set created_by = p_successor_id,
         updated_at = pg_catalog.clock_timestamp()
   where created_by = p_target_id;
  update public.archive_quizzes
     set created_by = p_successor_id,
         updated_at = pg_catalog.clock_timestamp()
   where created_by = p_target_id;
  update public.archive_paper_upload_intents
     set actor_id = p_successor_id
   where actor_id = p_target_id and state = 'finalized';

  update public.teaching_assignments
     set active = false,
         assigned_by = p_actor_id,
         updated_at = pg_catalog.clock_timestamp()
   where instructor_id = p_target_id and active;

  delete from public.teaching_assignments
   where instructor_id = p_target_id;

  update public.profiles
     set role = 'student'::public.user_role
   where id = p_target_id;

  perform pg_catalog.set_config('app.offboard_scope_transfer', 'off', true);
  perform pg_catalog.set_config('app.offboard_target_id', '', true);
  perform pg_catalog.set_config('app.offboard_successor_id', '', true);

  insert into public.audit_log (
    actor_id, actor_role, action, target_user_id, target_resource, metadata
  ) values (
    p_actor_id, v_actor_role, 'admin_offboard_staff', p_target_id,
    'public.profiles', jsonb_build_object('successor_id', p_successor_id)
  );
  return 'offboarded';
end;
$$;
revoke all on function public.offboard_staff(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.offboard_staff(uuid, uuid, uuid)
  to service_role;

-- =========================================================================
-- Client privileges
--
-- RLS governs rows but does not protect TRUNCATE, REFERENCES, or TRIGGER.
-- Supabase grants broad table privileges by default, so replace them with the
-- minimum operations and columns the authenticated application reads.
-- =========================================================================
revoke all privileges on table
  public.profiles,
  public.terms_acceptances,
  public.teaching_assignments,
  public.lesson_progress,
  public.offering_lesson_progress,
  public.quiz_attempts,
  public.enrollments,
  public.audit_log,
  public.workshop_administrations,
  public.workshop_attendance,
  public.archive_videos,
  public.archive_paper_upload_intents,
  public.archive_papers,
  public.archive_quizzes
from anon, authenticated, service_role;

grant select, insert, update, delete on table
  public.profiles,
  public.terms_acceptances,
  public.teaching_assignments,
  public.lesson_progress,
  public.offering_lesson_progress,
  public.quiz_attempts,
  public.enrollments,
  public.audit_log,
  public.workshop_administrations,
  public.workshop_attendance,
  public.archive_videos,
  public.archive_paper_upload_intents,
  public.archive_papers,
  public.archive_quizzes
to service_role;
revoke update on table public.workshop_attendance from service_role;
revoke update, delete on table public.terms_acceptances from service_role;

grant select (
  id, display_name, role, tos_accepted_at, tos_version, created_at,
  active_course_slug
) on public.profiles to authenticated;
grant update (display_name, active_course_slug)
  on public.profiles to authenticated;
grant select on table
  public.terms_acceptances,
  public.teaching_assignments,
  public.lesson_progress,
  public.offering_lesson_progress,
  public.quiz_attempts,
  public.enrollments
to authenticated;
grant select (
  id, ts, actor_id, actor_role, action, target_user_id,
  target_resource, metadata
) on public.audit_log to authenticated;
grant select (
  id, workshop_slug, course_slug, semester, section, week_of,
  schedule_version, instructor_id, opens_at, closes_at, geofence_required,
  location_label, questions_revealed_at, cancelled_at, created_at
) on public.workshop_administrations to authenticated;
grant select (
  id, administration_id, user_id, stamped_at, verification_method
) on public.workshop_attendance to authenticated;
