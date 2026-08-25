create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  aud text,
  role text,
  created_at timestamptz,
  updated_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz
);

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

do $$ begin create role anon nologin;
  exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin;
  exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin;
  exception when duplicate_object then null; end $$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Legacy Supabase projects granted client roles broad table access. The
-- canonical schema must revoke it. service_role intentionally receives no
-- default table grants so its explicit server-side surface is also tested.
alter default privileges in schema public
  grant all on tables to anon, authenticated;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;
