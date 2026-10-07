-- TA role removal (2026-10-07), step 1 of a rehearsal of production.
--
-- Production was built from schema.sql while it still added 'ta' to
-- user_role. This puts a fresh database back in that state: 'ta' in the enum,
-- the old role_requests check, and leftover TA rows. CI then re-runs
-- schema.sql, which must rebuild the type, and remove_ta_role_check.sql.
-- Fresh-schema only (CI step "Rehearse removing the TA role").

-- Runs on its own (autocommit) so the value is committed before it is used.
alter type public.user_role add value if not exists 'ta';

alter table public.role_requests drop constraint if exists role_requests_role_chk;
alter table public.role_requests add constraint role_requests_role_chk
  check (requested_role in ('instructor', 'ta'));

insert into auth.users (
  id, email, email_confirmed_at, aud, role, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000951', 'retired-ta@example.test', now(), 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000952', 'ta-requester@example.test', now(), 'authenticated', 'authenticated', now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, role) values
  ('00000000-0000-0000-0000-000000000951', 'ta'),
  ('00000000-0000-0000-0000-000000000952', 'student')
on conflict (id) do update set role = excluded.role;

insert into public.role_requests (user_id, requested_role) values
  ('00000000-0000-0000-0000-000000000952', 'ta')
on conflict (user_id) do update
  set requested_role = excluded.requested_role, status = 'pending';

-- The rebuild drops and recreates policies; the check compares counts.
create schema if not exists ta_rehearsal;
create table if not exists ta_rehearsal.before (policy_count integer not null);
truncate ta_rehearsal.before;
insert into ta_rehearsal.before
  select count(*) from pg_catalog.pg_policies where schemaname = 'public';
