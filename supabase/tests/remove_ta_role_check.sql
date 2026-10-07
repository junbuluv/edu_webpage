-- TA role removal (2026-10-07), step 2 of the rehearsal: runs after
-- remove_ta_role_setup.sql and a further schema.sql run. Fresh-schema only.
do $$
declare
  v_labels text[];
  v_default text;
  v_before integer;
  v_after integer;
begin
  select array_agg(e.enumlabel::text order by e.enumsortorder) into v_labels
    from pg_catalog.pg_enum e
    join pg_catalog.pg_type t on t.oid = e.enumtypid
    join pg_catalog.pg_namespace n on n.oid = t.typnamespace
   where n.nspname = 'public' and t.typname = 'user_role';
  if v_labels is distinct from array['student', 'instructor', 'admin'] then
    raise exception 'user_role is %, expected {student,instructor,admin}', v_labels;
  end if;

  begin
    perform 'ta'::public.user_role;
    raise exception 'ta is still a valid user_role';
  exception when invalid_text_representation then null;
  end;

  if (
    select role::text from public.profiles
     where id = '00000000-0000-0000-0000-000000000951'
  ) is distinct from 'student' then
    raise exception 'the leftover TA account was not made a student';
  end if;
  if exists (
    select 1 from public.role_requests
     where user_id = '00000000-0000-0000-0000-000000000952'
  ) then
    raise exception 'the leftover TA staff request was not removed';
  end if;

  -- Losing the default would break every signup (new profiles take it).
  select column_default into v_default
    from information_schema.columns
   where table_schema = 'public' and table_name = 'profiles'
     and column_name = 'role';
  if v_default is distinct from '''student''::user_role' then
    raise exception 'profiles.role default is %, expected student', v_default;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_trigger
     where tgname = 'profiles_instructor_role_change'
       and tgrelid = 'public.profiles'::regclass
  ) then
    raise exception 'profiles_instructor_role_change was not recreated';
  end if;

  select policy_count into v_before from ta_rehearsal.before;
  select count(*) into v_after
    from pg_catalog.pg_policies where schemaname = 'public';
  if v_after <> v_before then
    raise exception 'policy count changed across the rebuild: % before, % after',
      v_before, v_after;
  end if;

  -- Staff requests are instructor-only now.
  begin
    insert into public.role_requests (user_id, requested_role)
    values ('00000000-0000-0000-0000-000000000952', 'student');
    raise exception 'role_requests accepted a student request';
  exception when check_violation then null;
  end;
end $$;

drop schema ta_rehearsal cascade;
