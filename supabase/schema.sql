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
-- =========================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role user_role not null default 'student',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_self_read" on public.profiles;
create policy "profiles_self_read"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile row on new signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

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

-- Instructors can read all attempts (used for class dashboards later).
drop policy if exists "quiz_attempts_instructor_read" on public.quiz_attempts;
create policy "quiz_attempts_instructor_read"
  on public.quiz_attempts for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('instructor', 'admin')
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
