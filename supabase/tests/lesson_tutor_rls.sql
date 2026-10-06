-- Lesson tutor (2026-10-05 design): table lockdown, rolling 24-hour cap,
-- self-only reads, no client writes, no client access to the quota RPC.
--
-- Runs against a fresh supabase/schema.sql only (CI "Exercise lesson tutor
-- RLS"). security_hardening_rls.sql also runs on the upgrade-path database
-- built from the July fixture plus migrations, which predates this table, so
-- tutor checks live here instead of there.
begin;

insert into auth.users (
  id, email, email_confirmed_at, aud, role, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000901', 'tutor-student-a@example.test', now(), 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000902', 'tutor-student-b@example.test', now(), 'authenticated', 'authenticated', now(), now())
on conflict (id) do update
  set email = excluded.email,
      email_confirmed_at = excluded.email_confirmed_at,
      updated_at = excluded.updated_at;

insert into public.profiles (id, role) values
  ('00000000-0000-0000-0000-000000000901', 'student'),
  ('00000000-0000-0000-0000-000000000902', 'student')
on conflict (id) do update set role = excluded.role;

-- Privileges: same rules as the "Client privileges" sweep, plus the
-- column-level read grant (students see ids and times, not token counts).
do $$
declare
  privilege_name text;
begin
  if has_any_column_privilege('anon', 'public.tutor_messages', 'SELECT') then
    raise exception 'anonymous SELECT remained granted on public.tutor_messages';
  end if;
  foreach privilege_name in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
    if not has_table_privilege('service_role', 'public.tutor_messages', privilege_name) then
      raise exception 'service_role lacks % on public.tutor_messages', privilege_name;
    end if;
  end loop;
  foreach privilege_name in array array['TRUNCATE', 'REFERENCES', 'TRIGGER'] loop
    if has_table_privilege('service_role', 'public.tutor_messages', privilege_name) then
      raise exception 'service_role retained unnecessary % on public.tutor_messages',
        privilege_name;
    end if;
  end loop;
  foreach privilege_name in array array[
    'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
  ] loop
    if has_table_privilege('anon', 'public.tutor_messages', privilege_name)
       or has_table_privilege('authenticated', 'public.tutor_messages', privilege_name) then
      raise exception '% remained granted on public.tutor_messages to a client role',
        privilege_name;
    end if;
  end loop;
  if not has_column_privilege('authenticated', 'public.tutor_messages', 'created_at', 'SELECT') then
    raise exception 'authenticated cannot read tutor_messages.created_at';
  end if;
  if has_column_privilege('authenticated', 'public.tutor_messages', 'input_tokens', 'SELECT') then
    raise exception 'authenticated can read tutor token counts';
  end if;
end $$;

-- Cap boundary and the rolling 24-hour window.
do $$
declare
  r record;
begin
  insert into public.tutor_messages (user_id, course_slug, lesson_slug)
  select '00000000-0000-0000-0000-000000000901', 'eco-1002', 'eco-1002/is-lm-intro'
    from generate_series(1, 39);

  select * into r from public.consume_tutor_quota(
    '00000000-0000-0000-0000-000000000901', 'eco-1002', 'eco-1002/is-lm-intro', 40
  );
  if r.status <> 'ok' or r.message_id is null or r.remaining <> 0 then
    raise exception 'tutor quota: 40th message returned %/%/%',
      r.status, r.message_id, r.remaining;
  end if;

  select * into r from public.consume_tutor_quota(
    '00000000-0000-0000-0000-000000000901', 'eco-1002', 'eco-1002/is-lm-intro', 40
  );
  if r.status <> 'rate_limited' then
    raise exception 'tutor quota: 41st message returned %', r.status;
  end if;

  update public.tutor_messages
     set created_at = now() - interval '25 hours'
   where user_id = '00000000-0000-0000-0000-000000000901';
  select * into r from public.consume_tutor_quota(
    '00000000-0000-0000-0000-000000000901', 'eco-1002', 'eco-1002/is-lm-intro', 40
  );
  if r.status <> 'ok' or r.remaining <> 39 then
    raise exception 'tutor quota counted messages older than 24 hours (%/%)',
      r.status, r.remaining;
  end if;

  insert into public.tutor_messages (user_id, course_slug, lesson_slug)
  values ('00000000-0000-0000-0000-000000000902', 'eco-1002', 'eco-1002/is-lm-intro');
end $$;

-- A student reads only their own rows and can neither write nor call the RPC.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000901', true);
do $$
begin
  if not exists (
    select 1 from public.tutor_messages
     where user_id = '00000000-0000-0000-0000-000000000901'
  ) then
    raise exception 'student could not read their own tutor usage';
  end if;
  if exists (
    select 1 from public.tutor_messages
     where user_id <> '00000000-0000-0000-0000-000000000901'
  ) then
    raise exception 'student read another student''s tutor usage';
  end if;
  begin
    insert into public.tutor_messages (user_id, course_slug, lesson_slug)
    values ('00000000-0000-0000-0000-000000000901', 'eco-1002', 'eco-1002/forged');
    raise exception 'student inserted a tutor usage row directly';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.consume_tutor_quota(
      '00000000-0000-0000-0000-000000000901', 'eco-1002', 'eco-1002/forged', 40
    );
    raise exception 'student executed consume_tutor_quota';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

rollback;
