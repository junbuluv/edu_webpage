insert into auth.users (
  id, email, email_confirmed_at, aud, role, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000101', 'rls-student-eco@example.test', now(), 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000102', 'rls-student-fin@example.test', now(), 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000201', 'rls-instructor-eco@example.test', now(), 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000202', 'rls-instructor-fin@example.test', now(), 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000203', 'rls-ta@example.test', now(), 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000204', 'rls-admin@example.test', now(), 'authenticated', 'authenticated', now(), now())
on conflict (id) do update
  set email = excluded.email,
      email_confirmed_at = excluded.email_confirmed_at,
      updated_at = excluded.updated_at;

insert into public.profiles (id, role) values
  ('00000000-0000-0000-0000-000000000101', 'student'),
  ('00000000-0000-0000-0000-000000000102', 'student'),
  ('00000000-0000-0000-0000-000000000201', 'instructor'),
  ('00000000-0000-0000-0000-000000000202', 'instructor'),
  ('00000000-0000-0000-0000-000000000203', 'ta'),
  ('00000000-0000-0000-0000-000000000204', 'admin')
on conflict (id) do update set role = excluded.role;

insert into public.enrollments (user_id, course_slug, instructor_id, semester)
values
  ('00000000-0000-0000-0000-000000000101', 'eco-1002', '00000000-0000-0000-0000-000000000201', 'fall-2026'),
  ('00000000-0000-0000-0000-000000000102', 'fin-3610', '00000000-0000-0000-0000-000000000202', 'fall-2026')
on conflict (user_id, course_slug, semester) do update
  set instructor_id = excluded.instructor_id;

insert into public.lesson_progress (user_id, lesson_slug, course_slug, status)
values
  ('00000000-0000-0000-0000-000000000101', 'eco-1002/islm-intro', 'eco-1002', 'started'),
  ('00000000-0000-0000-0000-000000000102', 'fin-3610/financial-statements-and-ratios', 'fin-3610', 'started')
on conflict (user_id, lesson_slug) do update
  set course_slug = excluded.course_slug,
      status = excluded.status,
      updated_at = now();

delete from public.quiz_attempts
where quiz_slug in ('eco-1002-rls-fixture', 'fin-3610-rls-fixture');

insert into public.quiz_attempts (user_id, quiz_slug, course_slug, score, max_score, answers)
values
  ('00000000-0000-0000-0000-000000000101', 'eco-1002-rls-fixture', 'eco-1002', 1, 1, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000102', 'fin-3610-rls-fixture', 'fin-3610', 1, 1, '{}'::jsonb);

delete from public.workshop_administrations
where workshop_slug in ('eco-1002-rls-fixture', 'fin-3610-rls-fixture');

insert into public.workshop_administrations (
  workshop_slug, course_slug, section, week_of, instructor_id, opens_at, closes_at
) values
  ('eco-1002-rls-fixture', 'eco-1002', 'CML', '2026-07-13', '00000000-0000-0000-0000-000000000201', '2026-07-14 12:00:00+00', '2026-07-14 14:00:00+00'),
  ('fin-3610-rls-fixture', 'fin-3610', null, '2026-07-13', '00000000-0000-0000-0000-000000000202', '2026-07-14 12:00:00+00', '2026-07-14 14:00:00+00');

insert into public.workshop_attendance (administration_id, user_id, device_id)
select id, '00000000-0000-0000-0000-000000000101'::uuid, 'rls-device-eco'
from public.workshop_administrations
where workshop_slug = 'eco-1002-rls-fixture'
union all
select id, '00000000-0000-0000-0000-000000000102'::uuid, 'rls-device-fin'
from public.workshop_administrations
where workshop_slug = 'fin-3610-rls-fixture';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
do $$
declare
  visible_rows integer;
begin
  select count(*) into visible_rows from public.profiles;
  if visible_rows <> 1 then
    raise exception 'student profile self-read expected 1 row, got %', visible_rows;
  end if;

  update public.profiles
     set display_name = 'RLS test student'
   where id = auth.uid();
  if not found then
    raise exception 'student preference update was not permitted';
  end if;

  begin
    update public.profiles set role = 'admin' where id = auth.uid();
    raise exception 'student role escalation was permitted';
  exception when insufficient_privilege then null;
  end;

  select count(*) into visible_rows from public.lesson_progress;
  if visible_rows <> 1 then
    raise exception 'student progress read expected 1 row, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.quiz_attempts;
  if visible_rows <> 1 then
    raise exception 'student quiz read expected 1 row, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.workshop_administrations;
  if visible_rows <> 1 then
    raise exception 'student workshop read expected 1 row, got %', visible_rows;
  end if;

  begin
    insert into public.lesson_progress (user_id, lesson_slug, course_slug)
    values (auth.uid(), 'eco-1002/forged-progress', 'eco-1002');
    raise exception 'student progress insert was permitted';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.quiz_attempts (user_id, quiz_slug, course_slug, score, max_score, answers)
    values (auth.uid(), 'eco-1002-forged-attempt', 'eco-1002', 1, 1, '{}'::jsonb);
    raise exception 'student quiz insert was permitted';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.log_disclosure('rls_fixture', auth.uid());
    raise exception 'student audit RPC execute was permitted';
  exception when insufficient_privilege then null;
  end;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', true);
do $$
declare
  visible_rows integer;
begin
  select count(*) into visible_rows from public.lesson_progress;
  if visible_rows <> 1 then
    raise exception 'instructor progress read expected 1 own-course row, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.quiz_attempts;
  if visible_rows <> 1 then
    raise exception 'instructor quiz read expected 1 own-course row, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.workshop_attendance;
  if visible_rows <> 1 then
    raise exception 'instructor attendance read expected 1 own-course row, got %', visible_rows;
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000203', true);
do $$
declare
  visible_rows integer;
begin
  select count(*) into visible_rows from public.lesson_progress;
  if visible_rows <> 0 then
    raise exception 'TA progress read expected 0 rows, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.quiz_attempts;
  if visible_rows <> 0 then
    raise exception 'TA quiz read expected 0 rows, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.workshop_attendance;
  if visible_rows <> 0 then
    raise exception 'TA attendance read expected 0 rows, got %', visible_rows;
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000204', true);
do $$
declare
  visible_rows integer;
begin
  select count(*) into visible_rows from public.workshop_administrations;
  if visible_rows <> 2 then
    raise exception 'admin workshop read expected 2 rows, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.workshop_attendance;
  if visible_rows <> 2 then
    raise exception 'admin attendance read expected 2 rows, got %', visible_rows;
  end if;
end $$;
