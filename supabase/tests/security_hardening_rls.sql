begin;

insert into auth.users (
  id, email, email_confirmed_at, aud, role, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000101', 'rls-student-eco@example.test', now(), 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000102', 'rls-student-fin@example.test', now(), 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000103', 'rls-student-wrong-section@example.test', now(), 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000104', 'rls-student-wrong-term@example.test', now(), 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000105', 'rls-student-wrong-instructor@example.test', now(), 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000106', 'rls-inactive-student@example.test', now(), 'authenticated', 'authenticated', '1970-01-01', '1970-01-01'),
  ('00000000-0000-0000-0000-000000000107', 'rls-student-demoted-owner@example.test', now(), 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000201', 'rls-instructor-eco@example.test', now(), 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000202', 'rls-instructor-fin@example.test', now(), 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000203', 'rls-ta@example.test', now(), 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000204', 'rls-admin@example.test', now(), 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000205', 'rls-inactive-owner@example.test', now(), 'authenticated', 'authenticated', '1970-01-01', '1970-01-01'),
  ('00000000-0000-0000-0000-000000000206', 'rls-inactive-admin@example.test', now(), 'authenticated', 'authenticated', '1970-01-01', '1970-01-01'),
  ('00000000-0000-0000-0000-000000000207', 'rls-offboarding-successor@example.test', now(), 'authenticated', 'authenticated', now(), now())
on conflict (id) do update
  set email = excluded.email,
      email_confirmed_at = excluded.email_confirmed_at,
      updated_at = excluded.updated_at;

insert into public.profiles (id, role) values
  ('00000000-0000-0000-0000-000000000101', 'student'),
  ('00000000-0000-0000-0000-000000000102', 'student'),
  ('00000000-0000-0000-0000-000000000103', 'student'),
  ('00000000-0000-0000-0000-000000000104', 'student'),
  ('00000000-0000-0000-0000-000000000105', 'student'),
  ('00000000-0000-0000-0000-000000000106', 'student'),
  ('00000000-0000-0000-0000-000000000107', 'student'),
  ('00000000-0000-0000-0000-000000000201', 'instructor'),
  ('00000000-0000-0000-0000-000000000202', 'instructor'),
  ('00000000-0000-0000-0000-000000000203', 'ta'),
  ('00000000-0000-0000-0000-000000000204', 'admin'),
  ('00000000-0000-0000-0000-000000000205', 'instructor'),
  ('00000000-0000-0000-0000-000000000206', 'admin'),
  ('00000000-0000-0000-0000-000000000207', 'instructor')
on conflict (id) do update set role = excluded.role;

insert into public.teaching_assignments (
  instructor_id, course_slug, semester, active, assigned_by
)
values
  ('00000000-0000-0000-0000-000000000201', 'eco-1002', 'fall-2026', true, '00000000-0000-0000-0000-000000000204'),
  ('00000000-0000-0000-0000-000000000201', 'eco-1002', 'spring-2026', true, '00000000-0000-0000-0000-000000000204'),
  ('00000000-0000-0000-0000-000000000202', 'eco-1002', 'fall-2026', true, '00000000-0000-0000-0000-000000000204'),
  ('00000000-0000-0000-0000-000000000202', 'fin-3610', 'fall-2026', true, '00000000-0000-0000-0000-000000000204'),
  ('00000000-0000-0000-0000-000000000205', 'fin-3610', 'fall-1970', true, '00000000-0000-0000-0000-000000000204')
on conflict (instructor_id, course_slug, semester) do update
  set active = excluded.active,
      assigned_by = excluded.assigned_by,
      updated_at = now();

insert into public.enrollments (
  user_id, course_slug, instructor_id, semester, section
)
values
  ('00000000-0000-0000-0000-000000000101', 'eco-1002', '00000000-0000-0000-0000-000000000201', 'fall-2026', 'CML'),
  ('00000000-0000-0000-0000-000000000102', 'fin-3610', '00000000-0000-0000-0000-000000000202', 'fall-2026', null),
  ('00000000-0000-0000-0000-000000000103', 'eco-1002', '00000000-0000-0000-0000-000000000201', 'fall-2026', 'CTL'),
  ('00000000-0000-0000-0000-000000000104', 'eco-1002', '00000000-0000-0000-0000-000000000201', 'spring-2026', 'CML'),
  ('00000000-0000-0000-0000-000000000105', 'eco-1002', '00000000-0000-0000-0000-000000000202', 'fall-2026', 'CML'),
  ('00000000-0000-0000-0000-000000000107', 'fin-3610', '00000000-0000-0000-0000-000000000205', 'fall-1970', null)
on conflict (user_id, course_slug, semester) do update
  set instructor_id = excluded.instructor_id,
      section = excluded.section;

do $$
declare
  deleted_count integer;
begin
  deleted_count := public.purge_inactive_accounts(500);
  if deleted_count <> 1 then
    raise exception 'retention purge expected 1 inactive student, got %', deleted_count;
  end if;
  if exists (
    select 1 from auth.users
     where id = '00000000-0000-0000-0000-000000000106'
  ) then
    raise exception 'inactive never-signed-in student was not purged';
  end if;
  if not exists (
    select 1 from auth.users
     where id = '00000000-0000-0000-0000-000000000205'
  ) then
    raise exception 'inactive instructor with owned rows was not skipped';
  end if;
  if not exists (
    select 1 from auth.users
     where id = '00000000-0000-0000-0000-000000000206'
  ) then
    raise exception 'inactive staff account without owned rows was purged';
  end if;
end $$;

insert into public.lesson_progress (
  user_id, lesson_slug, course_slug, status
)
values
  ('00000000-0000-0000-0000-000000000101', 'eco-1002/islm-intro', 'eco-1002', 'started'),
  ('00000000-0000-0000-0000-000000000101', 'eco-1002/cross-term-fixture', 'eco-1002', 'started'),
  ('00000000-0000-0000-0000-000000000102', 'fin-3610/financial-statements-and-ratios', 'fin-3610', 'started'),
  ('00000000-0000-0000-0000-000000000104', 'eco-1002/spring-fixture', 'eco-1002', 'started'),
  ('00000000-0000-0000-0000-000000000105', 'eco-1002/other-instructor-fixture', 'eco-1002', 'started'),
  ('00000000-0000-0000-0000-000000000107', 'fin-3610/demoted-owner-fixture', 'fin-3610', 'started')
on conflict (user_id, lesson_slug) do update
  set course_slug = excluded.course_slug,
      status = excluded.status,
      updated_at = now();

insert into public.offering_lesson_progress (
  user_id, lesson_slug, course_slug, semester, instructor_id, status
)
values
  ('00000000-0000-0000-0000-000000000101', 'eco-1002/islm-intro', 'eco-1002', 'fall-2026', '00000000-0000-0000-0000-000000000201', 'started'),
  ('00000000-0000-0000-0000-000000000101', 'eco-1002/cross-term-fixture', 'eco-1002', 'spring-2026', '00000000-0000-0000-0000-000000000201', 'started'),
  ('00000000-0000-0000-0000-000000000102', 'fin-3610/financial-statements-and-ratios', 'fin-3610', 'fall-2026', '00000000-0000-0000-0000-000000000202', 'started'),
  ('00000000-0000-0000-0000-000000000104', 'eco-1002/spring-fixture', 'eco-1002', 'spring-2026', '00000000-0000-0000-0000-000000000201', 'started'),
  ('00000000-0000-0000-0000-000000000105', 'eco-1002/other-instructor-fixture', 'eco-1002', 'fall-2026', '00000000-0000-0000-0000-000000000202', 'started'),
  ('00000000-0000-0000-0000-000000000107', 'fin-3610/demoted-owner-fixture', 'fin-3610', 'fall-1970', '00000000-0000-0000-0000-000000000205', 'started')
on conflict (user_id, course_slug, semester, lesson_slug) do update
  set instructor_id = excluded.instructor_id,
      status = excluded.status,
      updated_at = now();

delete from public.quiz_attempts
where quiz_slug in (
  'eco-1002-rls-fixture',
  'eco-1002-cross-term-fixture',
  'eco-1002-spring-fixture',
  'eco-1002-other-instructor-fixture',
  'fin-3610-rls-fixture',
  'fin-3610-demoted-owner-fixture'
);

insert into public.quiz_attempts (
  user_id, quiz_slug, course_slug, semester, instructor_id,
  score, max_score, answers
)
values
  ('00000000-0000-0000-0000-000000000101', 'eco-1002-rls-fixture', 'eco-1002', 'fall-2026', '00000000-0000-0000-0000-000000000201', 1, 1, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000101', 'eco-1002-cross-term-fixture', 'eco-1002', 'spring-2026', '00000000-0000-0000-0000-000000000201', 1, 1, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000102', 'fin-3610-rls-fixture', 'fin-3610', 'fall-2026', '00000000-0000-0000-0000-000000000202', 1, 1, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000104', 'eco-1002-spring-fixture', 'eco-1002', 'spring-2026', '00000000-0000-0000-0000-000000000201', 1, 1, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000105', 'eco-1002-other-instructor-fixture', 'eco-1002', 'fall-2026', '00000000-0000-0000-0000-000000000202', 1, 1, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000107', 'fin-3610-demoted-owner-fixture', 'fin-3610', 'fall-1970', '00000000-0000-0000-0000-000000000205', 1, 1, '{}'::jsonb);

do $$
declare
  outcome text;
begin
  outcome := public.record_lesson_progress(
    '00000000-0000-0000-0000-000000000101',
    'eco-1002/islm-intro', 'eco-1002', 'complete'
  );
  if outcome <> 'completed' then
    raise exception 'lesson completion RPC returned %', outcome;
  end if;
  outcome := public.record_lesson_progress(
    '00000000-0000-0000-0000-000000000101',
    'eco-1002/islm-intro', 'eco-1002', 'start'
  );
  if outcome <> 'completed' then
    raise exception 'start downgraded an existing completion';
  end if;

  insert into public.enrollments (
    user_id, course_slug, instructor_id, semester, section
  ) values (
    '00000000-0000-0000-0000-000000000101', 'eco-1002',
    '00000000-0000-0000-0000-000000000201', 'spring-2026', 'CML'
  );
  outcome := public.record_lesson_progress(
    '00000000-0000-0000-0000-000000000101',
    'eco-1002/ambiguous-rpc-fixture', 'eco-1002', 'start'
  );
  if outcome <> 'ambiguous' or exists (
    select 1 from public.lesson_progress
     where user_id = '00000000-0000-0000-0000-000000000101'
       and lesson_slug = 'eco-1002/ambiguous-rpc-fixture'
  ) then
    raise exception 'ambiguous lesson scope was not rejected atomically';
  end if;
  delete from public.enrollments
   where user_id = '00000000-0000-0000-0000-000000000101'
     and course_slug = 'eco-1002' and semester = 'spring-2026';

  outcome := public.record_quiz_attempt(
    '00000000-0000-0000-0000-000000000101',
    'eco-1002-rpc-idempotency', 'eco-1002', 1, 1, '{}'::jsonb,
    '00000000-0000-0000-0000-000000009901'
  );
  if outcome <> 'recorded' then
    raise exception 'quiz attempt RPC returned %', outcome;
  end if;
  outcome := public.record_quiz_attempt(
    '00000000-0000-0000-0000-000000000101',
    'eco-1002-rpc-idempotency', 'eco-1002', 1, 1, '{}'::jsonb,
    '00000000-0000-0000-0000-000000009901'
  );
  if outcome <> 'duplicate' then
    raise exception 'quiz attempt retry was not idempotent';
  end if;
  delete from public.quiz_attempts
   where quiz_slug = 'eco-1002-rpc-idempotency';

  begin
    insert into public.quiz_attempts (
      user_id, quiz_slug, course_slug, score, max_score, answers
    ) values (
      '00000000-0000-0000-0000-000000000101',
      'eco-1002-oversized-fixture', 'eco-1002', 1, 1,
      jsonb_build_object('answer', repeat('x', 32768))
    );
    raise exception 'oversized quiz answers bypassed the database check';
  exception when check_violation then null;
  end;

  insert into public.quiz_attempts (
    user_id, quiz_slug, course_slug, semester, instructor_id,
    score, max_score, answers
  )
  select
    '00000000-0000-0000-0000-000000000101',
    'eco-1002-rate-fixture', 'eco-1002', 'fall-2026',
    '00000000-0000-0000-0000-000000000201', 1, 1, '{}'::jsonb
  from generate_series(1, 20);
  outcome := public.record_quiz_attempt(
    '00000000-0000-0000-0000-000000000101',
    'eco-1002-rate-fixture', 'eco-1002', 1, 1, '{}'::jsonb,
    '00000000-0000-0000-0000-000000009902'
  );
  if outcome <> 'rate_limited' then
    raise exception 'quiz rate limit returned %', outcome;
  end if;
  delete from public.quiz_attempts where quiz_slug = 'eco-1002-rate-fixture';

  outcome := public.accept_terms(
    '00000000-0000-0000-0000-000000000101', '2026-07-14', 'signup'
  );
  if outcome <> 'accepted' or not exists (
    select 1 from public.terms_acceptances
     where user_id = '00000000-0000-0000-0000-000000000101'
       and policy_version = '2026-07-14'
  ) then
    raise exception 'versioned terms acceptance was not recorded';
  end if;
end $$;

delete from public.workshop_administrations
where workshop_slug in (
  'eco-1002-rls-fixture',
  'eco-1002-spring-rls-fixture',
  'fin-3610-rls-fixture',
  'fin-3610-demoted-owner-rls-fixture'
);

insert into public.workshop_administrations (
  workshop_slug, course_slug, semester, section, week_of,
  instructor_id, opens_at, closes_at, cancelled_at
) values
  ('eco-1002-rls-fixture', 'eco-1002', 'fall-2026', 'CML', '2026-07-13', '00000000-0000-0000-0000-000000000201', '2026-07-13 12:00:00+00', '2026-07-13 14:00:00+00', null),
  ('eco-1002-rls-fixture', 'eco-1002', 'fall-2026', 'CML', '2026-07-13', '00000000-0000-0000-0000-000000000201', '2026-07-13 12:00:00+00', '2026-07-13 14:00:00+00', '2026-07-13 11:00:00+00'),
  ('eco-1002-rls-fixture', 'eco-1002', 'fall-2026', 'CML', '2026-07-13', '00000000-0000-0000-0000-000000000202', '2026-07-13 12:00:00+00', '2026-07-13 14:00:00+00', null),
  ('eco-1002-spring-rls-fixture', 'eco-1002', 'spring-2026', 'CML', '2026-01-12', '00000000-0000-0000-0000-000000000201', '2026-01-12 12:00:00+00', '2026-01-12 14:00:00+00', null),
  ('fin-3610-rls-fixture', 'fin-3610', 'fall-2026', null, '2026-07-13', '00000000-0000-0000-0000-000000000202', '2026-07-13 12:00:00+00', '2026-07-13 14:00:00+00', null),
  ('fin-3610-demoted-owner-rls-fixture', 'fin-3610', 'fall-1970', null, '1970-10-05', '00000000-0000-0000-0000-000000000205', '1970-10-05 12:00:00+00', '1970-10-05 14:00:00+00', null);

do $$ begin
  insert into public.workshop_administrations (
    workshop_slug, course_slug, semester, section, week_of,
    schedule_version, instructor_id, opens_at, closes_at
  ) values (
    'eco-1002-rls-fixture', 'eco-1002', 'fall-2026', 'CML', '2026-07-13',
    1, '00000000-0000-0000-0000-000000000201',
    '2026-07-13 12:00:00+00', '2026-07-13 14:00:00+00'
  );
  raise exception 'legacy-version active window bypassed weekly uniqueness';
exception when unique_violation then null;
end $$;

insert into public.workshop_attendance (
  administration_id, user_id, verification_method, device_hmac
)
select id, '00000000-0000-0000-0000-000000000101'::uuid,
       'window', repeat('a', 64)
from public.workshop_administrations
where workshop_slug = 'eco-1002-rls-fixture'
  and instructor_id = '00000000-0000-0000-0000-000000000201'
  and cancelled_at is null
union all
select id, '00000000-0000-0000-0000-000000000102'::uuid,
       'window', repeat('b', 64)
from public.workshop_administrations
where workshop_slug = 'fin-3610-rls-fixture'
union all
select id, '00000000-0000-0000-0000-000000000104'::uuid,
       'window', repeat('c', 64)
from public.workshop_administrations
where workshop_slug = 'eco-1002-spring-rls-fixture'
union all
select id, '00000000-0000-0000-0000-000000000107'::uuid,
       'window', repeat('d', 64)
from public.workshop_administrations
where workshop_slug = 'fin-3610-demoted-owner-rls-fixture';

do $$
declare
  owned_administration uuid;
begin
  select id into owned_administration
    from public.workshop_administrations
   where workshop_slug = 'eco-1002-rls-fixture'
     and instructor_id = '00000000-0000-0000-0000-000000000201'
     and cancelled_at is not null
   limit 1;

  begin
    insert into public.workshop_attendance (
      administration_id, user_id, verification_method, correction_reason
    ) values (
      owned_administration, '00000000-0000-0000-0000-000000000103',
      'manual', 'Missing actor must be rejected'
    );
    raise exception 'manual attendance without recorded_by was permitted';
  exception when check_violation then null;
  end;

  begin
    insert into public.workshop_attendance (
      administration_id, user_id, verification_method, recorded_by,
      correction_reason
    ) values (
      owned_administration, '00000000-0000-0000-0000-000000000103',
      'manual', '00000000-0000-0000-0000-000000000103',
      'Student actor must be rejected'
    );
    raise exception 'manual attendance by a student actor was permitted';
  exception when check_violation then null;
  end;

  begin
    insert into public.workshop_attendance (
      administration_id, user_id, verification_method, recorded_by,
      correction_reason
    ) values (
      owned_administration, '00000000-0000-0000-0000-000000000103',
      'manual', '00000000-0000-0000-0000-000000000202',
      'Wrong instructor must be rejected'
    );
    raise exception 'manual attendance by a non-owner instructor was permitted';
  exception when check_violation then null;
  end;

  insert into public.workshop_attendance (
    administration_id, user_id, verification_method, recorded_by,
    correction_reason
  ) values (
    owned_administration, '00000000-0000-0000-0000-000000000103',
    'manual', '00000000-0000-0000-0000-000000000201',
    'Owner verification succeeds'
  );
  delete from public.workshop_attendance
   where administration_id = owned_administration
     and user_id = '00000000-0000-0000-0000-000000000103';
end $$;

do $$
declare
  outcome text;
begin
  begin
    update public.profiles
       set role = 'student'
     where id = '00000000-0000-0000-0000-000000000205';
    raise exception 'active instructor role demotion bypassed the database guard';
  exception when check_violation then null;
  end;

  outcome := public.offboard_staff(
    '00000000-0000-0000-0000-000000000204',
    '00000000-0000-0000-0000-000000000205',
    '00000000-0000-0000-0000-000000000207'
  );
  if outcome <> 'offboarded' then
    raise exception 'inactive fixture offboarding returned %', outcome;
  end if;
end $$;

do $$ begin
  begin
    insert into public.enrollments (
      user_id, course_slug, instructor_id, semester
    ) values (
      '00000000-0000-0000-0000-000000000103', 'fin-3610',
      '00000000-0000-0000-0000-000000000205', 'fall-1970'
    );
    raise exception 'inactive assignment accepted a new enrollment';
  exception when check_violation then null;
  end;

  begin
    insert into public.archive_videos (
      course_slug, title, lesson_slug, semester_term, semester_year,
      provider, video_id, created_by
    ) values (
      'eco-1002', 'Unauthorized fixture', 'eco-1002/fixture', 'fall', 2026,
      'youtube', 'abcdefghijk', '00000000-0000-0000-0000-000000000103'
    );
    raise exception 'student profile created instructor archive content';
  exception when check_violation then null;
  end;
end $$;

insert into public.workshop_administrations (
  workshop_slug, course_slug, semester, section, week_of, instructor_id,
  opens_at, closes_at
) values (
  'fin-3610-deactivation-guard-fixture', 'fin-3610', 'fall-2026', null,
  date_trunc(
    'week', (now() + interval '1 day') at time zone 'America/New_York'
  )::date,
  '00000000-0000-0000-0000-000000000202',
  now() + interval '1 day', now() + interval '2 days'
);
do $$ begin
  begin
    update public.teaching_assignments
       set active = false
     where instructor_id = '00000000-0000-0000-0000-000000000202'
       and course_slug = 'fin-3610'
       and semester = 'fall-2026';
    raise exception 'assignment with a future workshop was deactivated';
  exception when check_violation then null;
  end;
end $$;
delete from public.workshop_administrations
 where workshop_slug = 'fin-3610-deactivation-guard-fixture';

do $$
declare
  demoted_administration uuid;
begin
  select id into demoted_administration
    from public.workshop_administrations
   where workshop_slug = 'fin-3610-demoted-owner-rls-fixture';

  begin
    insert into public.workshop_attendance (
      administration_id, user_id, verification_method, recorded_by,
      correction_reason
    ) values (
      demoted_administration, '00000000-0000-0000-0000-000000000103',
      'manual', '00000000-0000-0000-0000-000000000205',
      'A demoted instructor must be rejected'
    );
    raise exception 'manual attendance by a demoted instructor was permitted';
  exception when check_violation then null;
  end;
end $$;

do $$
declare
  relation_name text;
  privilege_name text;
begin
  foreach relation_name in array array[
    'public.profiles',
    'public.teaching_assignments',
    'public.lesson_progress',
    'public.offering_lesson_progress',
    'public.quiz_attempts',
    'public.enrollments',
    'public.audit_log',
    'public.workshop_administrations',
    'public.workshop_attendance',
    'public.archive_videos',
    'public.archive_paper_upload_intents',
    'public.archive_papers',
    'public.archive_quizzes'
  ] loop
    if has_any_column_privilege('anon', relation_name, 'SELECT') then
      raise exception 'anonymous SELECT remained granted on %', relation_name;
    end if;

    foreach privilege_name in array array['SELECT', 'INSERT', 'DELETE'] loop
      if not has_table_privilege('service_role', relation_name, privilege_name) then
        raise exception 'service_role lacks % on %', privilege_name, relation_name;
      end if;
    end loop;

    if relation_name = 'public.workshop_attendance' then
      if has_table_privilege('service_role', relation_name, 'UPDATE') then
        raise exception 'service_role can update immutable attendance rows';
      end if;
    elsif not has_table_privilege('service_role', relation_name, 'UPDATE') then
      raise exception 'service_role lacks UPDATE on %', relation_name;
    end if;

    foreach privilege_name in array array[
      'TRUNCATE', 'REFERENCES', 'TRIGGER'
    ] loop
      if has_table_privilege('service_role', relation_name, privilege_name) then
        raise exception 'service_role retained unnecessary % on %',
          privilege_name, relation_name;
      end if;
    end loop;

    foreach privilege_name in array array[
      'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
    ] loop
      if has_table_privilege('anon', relation_name, privilege_name)
         or has_table_privilege('authenticated', relation_name, privilege_name) then
        raise exception '% remained granted on % to a client role',
          privilege_name, relation_name;
      end if;
    end loop;
  end loop;

  if not has_table_privilege(
    'service_role', 'public.terms_acceptances', 'SELECT'
  ) or not has_table_privilege(
    'service_role', 'public.terms_acceptances', 'INSERT'
  ) or has_table_privilege(
    'service_role', 'public.terms_acceptances', 'UPDATE'
  ) or has_table_privilege(
    'service_role', 'public.terms_acceptances', 'DELETE'
  ) then
    raise exception 'terms acceptances are not append-only for service_role';
  end if;
  if has_any_column_privilege(
    'anon', 'public.terms_acceptances', 'SELECT'
  ) or has_table_privilege(
    'authenticated', 'public.terms_acceptances', 'INSERT'
  ) or has_table_privilege(
    'authenticated', 'public.terms_acceptances', 'UPDATE'
  ) or has_table_privilege(
    'authenticated', 'public.terms_acceptances', 'DELETE'
  ) then
    raise exception 'terms acceptance client grants are too broad';
  end if;

  if not has_column_privilege(
    'authenticated', 'public.profiles', 'role', 'SELECT'
  ) or has_column_privilege(
    'authenticated', 'public.profiles', 'email_hmac', 'SELECT'
  ) or has_column_privilege(
    'authenticated', 'public.profiles', 'tos_accepted_at', 'UPDATE'
  ) then
    raise exception 'profile column grants do not match the approved client surface';
  end if;

  if not has_column_privilege(
    'authenticated', 'public.workshop_administrations', 'id', 'SELECT'
  ) or has_column_privilege(
    'authenticated', 'public.workshop_administrations', 'required_lat', 'SELECT'
  ) then
    raise exception 'workshop administration column grants expose protected fields';
  end if;

  if not has_column_privilege(
    'authenticated', 'public.workshop_attendance', 'id', 'SELECT'
  ) or has_column_privilege(
    'authenticated', 'public.workshop_attendance', 'device_hmac', 'SELECT'
  ) then
    raise exception 'workshop attendance column grants expose protected fields';
  end if;

  if not has_column_privilege(
    'authenticated', 'public.audit_log', 'id', 'SELECT'
  ) or has_column_privilege(
    'authenticated', 'public.audit_log', 'client_ip_hmac', 'SELECT'
  ) or has_column_privilege(
    'authenticated', 'public.audit_log', 'user_agent_hmac', 'SELECT'
  ) then
    raise exception 'audit-log column grants expose protected request metadata';
  end if;

  if has_any_column_privilege(
    'authenticated', 'public.archive_videos', 'SELECT'
  ) or has_any_column_privilege(
    'authenticated', 'public.archive_paper_upload_intents', 'SELECT'
  ) or has_any_column_privilege(
    'authenticated', 'public.archive_papers', 'SELECT'
  ) or has_any_column_privilege(
    'authenticated', 'public.archive_quizzes', 'SELECT'
  ) then
    raise exception 'archive tables are not service-role only';
  end if;
end $$;

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

  select count(*) into visible_rows from public.terms_acceptances;
  if visible_rows <> 1 then
    raise exception 'student terms self-read expected 1 row, got %', visible_rows;
  end if;

  begin
    update public.profiles set tos_accepted_at = now() where id = auth.uid();
    raise exception 'student could forge terms acceptance timestamp';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.profiles set role = 'admin' where id = auth.uid();
    raise exception 'student role escalation was permitted';
  exception when insufficient_privilege then null;
  end;

  select count(*) into visible_rows from public.lesson_progress;
  if visible_rows <> 2 then
    raise exception 'student progress self-read expected 2 rows, got %', visible_rows;
  end if;
  select count(*) into visible_rows from public.offering_lesson_progress;
  if visible_rows <> 2 then
    raise exception 'student offering progress self-read expected 2 rows, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.quiz_attempts;
  if visible_rows <> 2 then
    raise exception 'student quiz self-read expected 2 rows, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.enrollments;
  if visible_rows <> 1 then
    raise exception 'student enrollment self-read expected 1 row, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.teaching_assignments;
  if visible_rows <> 0 then
    raise exception 'student could read teaching assignments';
  end if;

  select count(*) into visible_rows from public.workshop_administrations;
  if visible_rows <> 2 then
    raise exception 'student workshop read expected active and cancelled rows, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.workshop_attendance;
  if visible_rows <> 1 then
    raise exception 'student attendance self-read expected 1 row, got %', visible_rows;
  end if;

  begin
    perform required_lat from public.workshop_administrations;
    raise exception 'student could read protected workshop coordinates';
  exception when insufficient_privilege then null;
  end;

  begin
    perform device_hmac from public.workshop_attendance;
    raise exception 'student could read protected attendance device token';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.workshop_attendance (administration_id, user_id)
    select id, auth.uid()
      from public.workshop_administrations
     limit 1;
    raise exception 'student workshop attendance insert was permitted';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.workshop_administrations
       set questions_revealed_at = now();
    raise exception 'student workshop reveal update was permitted';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.lesson_progress (user_id, lesson_slug, course_slug)
    values (auth.uid(), 'eco-1002/forged-progress', 'eco-1002');
    raise exception 'student progress insert was permitted';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.offering_lesson_progress (
      user_id, course_slug, semester, instructor_id, lesson_slug
    ) values (
      auth.uid(), 'eco-1002', 'fall-2026',
      '00000000-0000-0000-0000-000000000201',
      'eco-1002/forged-offering-progress'
    );
    raise exception 'student offering-progress insert was permitted';
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
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000105', true);
do $$
declare
  visible_rows integer;
begin
  select count(*) into visible_rows from public.teaching_assignments;
  if visible_rows <> 0 then
    raise exception 'student could read teaching assignments owned by an instructor';
  end if;

  select count(*) into visible_rows from public.enrollments;
  if visible_rows <> 1 then
    raise exception 'second-instructor student enrollment self-read expected 1 row, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.lesson_progress;
  if visible_rows <> 1 then
    raise exception 'second-instructor student progress self-read expected 1 row, got %', visible_rows;
  end if;
  select count(*) into visible_rows from public.offering_lesson_progress;
  if visible_rows <> 1 then
    raise exception 'second-instructor student offering progress expected 1 row, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.quiz_attempts;
  if visible_rows <> 1 then
    raise exception 'second-instructor student quiz self-read expected 1 row, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.workshop_administrations;
  if visible_rows <> 1 then
    raise exception 'second-instructor student workshop read expected 1 own row, got %', visible_rows;
  end if;

  select count(*) into visible_rows
    from public.workshop_administrations
   where instructor_id = '00000000-0000-0000-0000-000000000201';
  if visible_rows <> 0 then
    raise exception 'second-instructor student could read the other instructor workshop row';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', true);
do $$
declare
  visible_rows integer;
begin
  select count(*) into visible_rows from public.workshop_administrations;
  if visible_rows <> 0 then
    raise exception 'wrong-section student workshop read expected 0 rows, got %', visible_rows;
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000104', true);
do $$
declare
  visible_rows integer;
begin
  select count(*) into visible_rows from public.lesson_progress;
  if visible_rows <> 1 then
    raise exception 'spring student progress self-read expected 1 row, got %', visible_rows;
  end if;
  select count(*) into visible_rows from public.offering_lesson_progress;
  if visible_rows <> 1 then
    raise exception 'spring student offering progress expected 1 row, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.quiz_attempts;
  if visible_rows <> 1 then
    raise exception 'spring student quiz self-read expected 1 row, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.workshop_administrations;
  if visible_rows <> 1 then
    raise exception 'spring student workshop read expected 1 own-term row, got %', visible_rows;
  end if;

  select count(*) into visible_rows
    from public.workshop_administrations
   where semester = 'fall-2026';
  if visible_rows <> 0 then
    raise exception 'spring student could read fall-term workshop rows';
  end if;

  select count(*) into visible_rows from public.workshop_attendance;
  if visible_rows <> 1 then
    raise exception 'spring student attendance self-read expected 1 row, got %', visible_rows;
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', true);
do $$
declare
  visible_rows integer;
begin
  select count(*) into visible_rows from public.teaching_assignments;
  if visible_rows <> 2 then
    raise exception 'instructor teaching-assignment read expected 2 own rows, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.enrollments;
  if visible_rows <> 3 then
    raise exception 'instructor enrollment read expected 3 exact-offering rows, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.lesson_progress;
  if visible_rows <> 0 then
    raise exception 'instructor could read lifetime student progress';
  end if;
  select count(*) into visible_rows from public.offering_lesson_progress;
  if visible_rows <> 2 then
    raise exception 'instructor offering progress expected 2 exact rows, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.quiz_attempts;
  if visible_rows <> 2 then
    raise exception 'instructor quiz read expected 2 exact-offering rows, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.workshop_attendance;
  if visible_rows <> 2 then
    raise exception 'instructor attendance read expected 2 exact-offering rows, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.workshop_administrations;
  if visible_rows <> 3 then
    raise exception 'instructor workshop read expected 3 exact-offering rows, got %', visible_rows;
  end if;

  select count(*) into visible_rows
    from public.offering_lesson_progress
   where user_id = '00000000-0000-0000-0000-000000000101'
     and semester = 'spring-2026';
  if visible_rows <> 0 then
    raise exception 'instructor could read progress across a student term boundary';
  end if;

  select count(*) into visible_rows
    from public.quiz_attempts
   where user_id = '00000000-0000-0000-0000-000000000101'
     and semester = 'spring-2026';
  if visible_rows <> 0 then
    raise exception 'instructor could read quiz attempts across a student term boundary';
  end if;

  select count(*) into visible_rows
    from public.offering_lesson_progress
   where instructor_id = '00000000-0000-0000-0000-000000000202';
  if visible_rows <> 0 then
    raise exception 'instructor could read another instructor progress rows';
  end if;

  select count(*) into visible_rows
    from public.quiz_attempts
   where instructor_id = '00000000-0000-0000-0000-000000000202';
  if visible_rows <> 0 then
    raise exception 'instructor could read another instructor quiz rows';
  end if;
end $$;

reset role;
update public.teaching_assignments
   set active = false,
       updated_at = now()
 where instructor_id = '00000000-0000-0000-0000-000000000201'
   and course_slug = 'eco-1002'
   and semester = 'fall-2026';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', true);
do $$
declare
  visible_rows integer;
begin
  select count(*) into visible_rows from public.enrollments;
  if visible_rows <> 1 then
    raise exception 'inactive assignment exposed fall enrollments; expected 1 active spring row, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.lesson_progress;
  if visible_rows <> 0 then
    raise exception 'inactive instructor could read lifetime progress';
  end if;
  select count(*) into visible_rows from public.offering_lesson_progress;
  if visible_rows <> 1 then
    raise exception 'inactive assignment exposed fall offering progress; expected 1 active spring row, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.quiz_attempts;
  if visible_rows <> 1 then
    raise exception 'inactive assignment exposed fall quizzes; expected 1 active spring row, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.workshop_administrations;
  if visible_rows <> 1 then
    raise exception 'inactive assignment exposed fall workshops; expected 1 active spring row, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.workshop_attendance;
  if visible_rows <> 1 then
    raise exception 'inactive assignment exposed fall attendance; expected 1 active spring row, got %', visible_rows;
  end if;
end $$;

reset role;
update public.teaching_assignments
   set active = true,
       updated_at = now()
 where instructor_id = '00000000-0000-0000-0000-000000000201'
   and course_slug = 'eco-1002'
   and semester = 'fall-2026';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000202', true);
do $$
declare
  visible_rows integer;
begin
  select count(*) into visible_rows from public.teaching_assignments;
  if visible_rows <> 2 then
    raise exception 'second instructor teaching-assignment read expected 2 own rows, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.enrollments;
  if visible_rows <> 2 then
    raise exception 'second instructor enrollment read expected 2 own rows, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.lesson_progress;
  if visible_rows <> 0 then
    raise exception 'second instructor could read lifetime progress';
  end if;
  select count(*) into visible_rows from public.offering_lesson_progress;
  if visible_rows <> 2 then
    raise exception 'second instructor offering progress expected 2 own rows, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.quiz_attempts;
  if visible_rows <> 2 then
    raise exception 'second instructor quiz read expected 2 own rows, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.workshop_administrations;
  if visible_rows <> 2 then
    raise exception 'second instructor workshop read expected 2 own rows, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.workshop_attendance;
  if visible_rows <> 1 then
    raise exception 'second instructor attendance read expected 1 own row, got %', visible_rows;
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000205', true);
do $$
declare
  visible_rows integer;
begin
  select count(*) into visible_rows from public.teaching_assignments;
  if visible_rows <> 0 then
    raise exception 'demoted instructor could read a stale teaching assignment';
  end if;

  select count(*) into visible_rows from public.enrollments;
  if visible_rows <> 0 then
    raise exception 'demoted instructor could read former enrollments';
  end if;

  select count(*) into visible_rows from public.offering_lesson_progress;
  if visible_rows <> 0 then
    raise exception 'demoted instructor could read former offering progress';
  end if;

  select count(*) into visible_rows from public.quiz_attempts;
  if visible_rows <> 0 then
    raise exception 'demoted instructor could read former student quizzes';
  end if;

  select count(*) into visible_rows from public.workshop_administrations;
  if visible_rows <> 0 then
    raise exception 'demoted instructor could read former workshop rows';
  end if;

  select count(*) into visible_rows from public.workshop_attendance;
  if visible_rows <> 0 then
    raise exception 'demoted instructor could read former attendance rows';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000203', true);
do $$
declare
  visible_rows integer;
begin
  select count(*) into visible_rows from public.teaching_assignments;
  if visible_rows <> 0 then
    raise exception 'TA teaching-assignment read expected 0 rows, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.enrollments;
  if visible_rows <> 0 then
    raise exception 'TA enrollment read expected 0 rows, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.offering_lesson_progress;
  if visible_rows <> 0 then
    raise exception 'TA offering progress read expected 0 rows, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.quiz_attempts;
  if visible_rows <> 0 then
    raise exception 'TA quiz read expected 0 rows, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.workshop_attendance;
  if visible_rows <> 0 then
    raise exception 'TA attendance read expected 0 rows, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.workshop_administrations;
  if visible_rows <> 0 then
    raise exception 'TA workshop read expected 0 rows, got %', visible_rows;
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000204', true);
do $$
declare
  visible_rows integer;
begin
  select count(*) into visible_rows from public.teaching_assignments;
  if visible_rows <> 5 then
    raise exception 'admin teaching-assignment read expected 5 rows, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.enrollments;
  if visible_rows <> 6 then
    raise exception 'admin enrollment read expected 6 rows, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.lesson_progress;
  if visible_rows <> 6 then
    raise exception 'admin lifetime progress read expected 6 rows, got %', visible_rows;
  end if;
  select count(*) into visible_rows from public.offering_lesson_progress;
  if visible_rows <> 6 then
    raise exception 'admin offering progress read expected 6 rows, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.quiz_attempts;
  if visible_rows <> 6 then
    raise exception 'admin quiz read expected 6 rows, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.workshop_administrations;
  if visible_rows <> 6 then
    raise exception 'admin workshop read expected 6 rows, got %', visible_rows;
  end if;

  select count(*) into visible_rows from public.workshop_attendance;
  if visible_rows <> 4 then
    raise exception 'admin attendance read expected 4 rows, got %', visible_rows;
  end if;
end $$;

reset role;
do $$
declare
  applied boolean;
  mutated boolean;
  item_id uuid;
  administration_id uuid;
begin
  applied := public.apply_roster_import(
    '00000000-0000-0000-0000-000000000999',
    '00000000-0000-0000-0000-000000000201',
    'eco-1002',
    'fall-2026',
    jsonb_build_array(jsonb_build_object(
      'user_id', '00000000-0000-0000-0000-000000000103',
      'student_name', 'Missing Actor',
      'section', 'CTL',
      'expected_existing', true
    ))
  );
  if applied then
    raise exception 'missing actor applied a roster import';
  end if;

  applied := public.apply_roster_import(
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000201',
    'eco-1002',
    'fall-2026',
    jsonb_build_array(jsonb_build_object(
      'user_id', '00000000-0000-0000-0000-000000000103',
      'student_name', 'Roster RPC Student',
      'section', 'CTL',
      'expected_existing', true
    ))
  );
  if not applied then
    raise exception 'valid atomic roster import failed';
  end if;
  applied := public.apply_roster_import(
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000201',
    'eco-1002',
    'fall-2026',
    jsonb_build_array(jsonb_build_object(
      'user_id', '00000000-0000-0000-0000-000000000103',
      'student_name', 'Stale Preview',
      'section', 'CTL',
      'expected_existing', false
    ))
  );
  if applied then
    raise exception 'stale roster preview overwrote an existing enrollment';
  end if;

  mutated := public.mutate_enrollment(
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000103',
    'eco-1002', 'fall-2026',
    '00000000-0000-0000-0000-000000000201',
    'Enrollment RPC Student', 'CTL', 'update'
  );
  if not mutated then
    raise exception 'valid atomic enrollment update failed';
  end if;
  mutated := public.mutate_enrollment(
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000103',
    'eco-1002', 'fall-2026',
    '00000000-0000-0000-0000-000000000201',
    'Unauthorized Update', 'CTL', 'update'
  );
  if mutated then
    raise exception 'student actor mutated an enrollment';
  end if;
  mutated := public.mutate_enrollment(
    '00000000-0000-0000-0000-000000000999',
    '00000000-0000-0000-0000-000000000103',
    'eco-1002', 'fall-2026',
    '00000000-0000-0000-0000-000000000201',
    'Missing Actor', 'CTL', 'update'
  );
  if mutated then
    raise exception 'missing actor mutated an enrollment';
  end if;
  begin
    perform public.mutate_enrollment(
      '00000000-0000-0000-0000-000000000201',
      '00000000-0000-0000-0000-000000000103',
      'eco-1002', 'fall-2026',
      '00000000-0000-0000-0000-000000000201',
      null, null, null
    );
    raise exception 'null enrollment operation was accepted';
  exception when invalid_parameter_value then null;
  end;
  mutated := public.mutate_enrollment(
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000102',
    'eco-1002', 'spring-2026',
    '00000000-0000-0000-0000-000000000201',
    'Temporary Enrollment', 'CML', 'insert'
  );
  if not mutated then
    raise exception 'valid atomic enrollment insert failed';
  end if;
  mutated := public.mutate_enrollment(
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000102',
    'eco-1002', 'spring-2026',
    '00000000-0000-0000-0000-000000000201',
    null, null, 'delete'
  );
  if not mutated then
    raise exception 'atomic enrollment insert cleanup failed';
  end if;

  insert into public.archive_videos (
    course_slug, lesson_slug, semester_term, semester_year, title,
    provider, video_id, created_by
  ) values (
    'eco-1002', 'eco-1002/rpc-fixture', 'fall', 2026, 'RPC Fixture',
    'youtube', 'rpcfixture1', '00000000-0000-0000-0000-000000000201'
  ) returning id into item_id;
  begin
    update public.archive_videos
       set created_by = created_by
     where id = item_id;
    raise exception 'same-value archive scope update was permitted';
  exception when check_violation then null;
  end;
  mutated := public.mutate_archive_item(
    '00000000-0000-0000-0000-000000000999',
    'video', item_id, 'delete', '{}'::jsonb
  );
  if mutated then
    raise exception 'missing actor deleted archive content';
  end if;
  begin
    perform public.mutate_archive_item(
      '00000000-0000-0000-0000-000000000201',
      null, item_id, 'delete', '{}'::jsonb
    );
    raise exception 'null archive resource was accepted';
  exception when invalid_parameter_value then null;
  end;
  mutated := public.mutate_archive_item(
    '00000000-0000-0000-0000-000000000202',
    'video', item_id, 'delete', '{}'::jsonb
  );
  if mutated then
    raise exception 'non-owner instructor deleted archive content';
  end if;
  mutated := public.mutate_archive_item(
    '00000000-0000-0000-0000-000000000201',
    'video', item_id, 'update', jsonb_build_object(
      'lesson_slug', 'eco-1002/rpc-fixture',
      'semester_term', 'fall',
      'semester_year', 2026,
      'title', 'RPC Fixture Updated',
      'provider', 'youtube',
      'video_id', 'rpcfixture2',
      'description', null,
      'duration_minutes', null,
      'published', true
    )
  );
  if not mutated then
    raise exception 'owning instructor could not update archive content';
  end if;
  mutated := public.mutate_archive_item(
    '00000000-0000-0000-0000-000000000204',
    'video', item_id, 'delete', '{}'::jsonb
  );
  if not mutated then
    raise exception 'admin could not delete archive content';
  end if;
  delete from public.archive_videos where id = item_id;

  insert into public.workshop_administrations (
    workshop_slug, course_slug, semester, section, week_of, instructor_id,
    opens_at, closes_at
  ) values (
    'eco-1002-rpc-fixture', 'eco-1002', 'fall-2026', 'CTL',
    date_trunc('week', now() at time zone 'America/New_York')::date,
    '00000000-0000-0000-0000-000000000201',
    now() - interval '1 hour', now() + interval '1 hour'
  ) returning id into administration_id;
  begin
    update public.workshop_administrations
       set course_slug = course_slug
     where id = administration_id;
    raise exception 'same-value workshop scope update was permitted';
  exception when check_violation then null;
  end;
  mutated := public.mutate_workshop(
    '00000000-0000-0000-0000-000000000999',
    administration_id, 'reveal', null, null
  );
  if mutated then
    raise exception 'missing actor mutated a workshop';
  end if;
  begin
    perform public.mutate_workshop(
      '00000000-0000-0000-0000-000000000201',
      administration_id, null,
      '00000000-0000-0000-0000-000000000103', 'Null operation'
    );
    raise exception 'null workshop operation was accepted';
  exception when invalid_parameter_value then null;
  end;
  mutated := public.mutate_workshop(
    '00000000-0000-0000-0000-000000000202',
    administration_id, 'reveal', null, null
  );
  if mutated then
    raise exception 'non-owner instructor mutated a workshop';
  end if;
  mutated := public.mutate_workshop(
    '00000000-0000-0000-0000-000000000201',
    administration_id, 'manual_add',
    '00000000-0000-0000-0000-000000000103', 'RPC fixture correction'
  );
  if not mutated then
    raise exception 'valid manual attendance mutation failed';
  end if;
  mutated := public.mutate_workshop(
    '00000000-0000-0000-0000-000000000201',
    administration_id, 'manual_remove',
    '00000000-0000-0000-0000-000000000103', 'RPC fixture cleanup'
  );
  if not mutated then
    raise exception 'valid manual attendance removal failed';
  end if;
  mutated := public.record_workshop_stamp(
    '00000000-0000-0000-0000-000000000101',
    administration_id, repeat('f', 64), 'window'
  );
  if mutated then
    raise exception 'wrong-section student recorded a workshop stamp';
  end if;
  insert into public.enrollments (
    user_id, course_slug, instructor_id, semester, section
  ) values (
    '00000000-0000-0000-0000-000000000201', 'eco-1002',
    '00000000-0000-0000-0000-000000000201', 'fall-2026', 'CTL'
  );
  mutated := public.record_workshop_stamp(
    '00000000-0000-0000-0000-000000000201',
    administration_id, repeat('1', 64), 'window'
  );
  if mutated then
    raise exception 'instructor profile recorded a student workshop stamp';
  end if;
  delete from public.enrollments
   where user_id = '00000000-0000-0000-0000-000000000201'
     and course_slug = 'eco-1002' and semester = 'fall-2026';
  mutated := public.record_workshop_stamp(
    '00000000-0000-0000-0000-000000000103',
    administration_id, repeat('e', 64), 'window'
  );
  if not mutated then
    raise exception 'eligible student could not record a workshop stamp';
  end if;
  mutated := public.mutate_workshop(
    '00000000-0000-0000-0000-000000000201',
    administration_id, 'reveal', null, null
  );
  if not mutated then
    raise exception 'owning instructor could not reveal workshop questions';
  end if;
  delete from public.workshop_administrations where id = administration_id;
end $$;

reset role;
do $$
declare
  scope_count integer;
  transferred boolean;
  enrolled_at_before timestamptz;
  enrolled_at_after timestamptz;
begin
  select count(*) into scope_count
    from public.resolve_current_enrollment_scope(
      '00000000-0000-0000-0000-000000000101', 'eco-1002'
    );
  if scope_count <> 1 then
    raise exception 'one active enrollment did not resolve to one write scope';
  end if;

  insert into public.enrollments (
    user_id, course_slug, instructor_id, semester, section
  ) values (
    '00000000-0000-0000-0000-000000000101', 'eco-1002',
    '00000000-0000-0000-0000-000000000201', 'spring-2026', 'CML'
  );
  select count(*) into scope_count
    from public.resolve_current_enrollment_scope(
      '00000000-0000-0000-0000-000000000101', 'eco-1002'
    );
  if scope_count <> 0 then
    raise exception 'ambiguous active enrollments resolved to a write scope';
  end if;
  delete from public.enrollments
   where user_id = '00000000-0000-0000-0000-000000000101'
     and course_slug = 'eco-1002'
     and semester = 'spring-2026';

  begin
    update public.enrollments
       set user_id = user_id
     where user_id = '00000000-0000-0000-0000-000000000101'
       and course_slug = 'eco-1002'
       and semester = 'fall-2026';
    raise exception 'same-value enrollment identity update was permitted';
  exception when check_violation then null;
  end;

  begin
    update public.enrollments
       set instructor_id = instructor_id
     where user_id = '00000000-0000-0000-0000-000000000101'
       and course_slug = 'eco-1002'
       and semester = 'fall-2026';
    raise exception 'same-value enrollment scope update was permitted';
  exception when check_violation then null;
  end;

  begin
    update public.teaching_assignments
       set semester = semester
     where instructor_id = '00000000-0000-0000-0000-000000000207'
       and course_slug = 'fin-3610'
       and semester = 'fall-1970';
    raise exception 'same-value teaching assignment identity update was permitted';
  exception when check_violation then null;
  end;

  select enrolled_at into enrolled_at_before
    from public.enrollments
   where user_id = '00000000-0000-0000-0000-000000000101'
     and course_slug = 'eco-1002'
     and semester = 'fall-2026';

  transferred := public.transfer_enrollment_scope(
    '00000000-0000-0000-0000-000000000204',
    '00000000-0000-0000-0000-000000000101', 'eco-1002', 'fall-2026',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000202', null, 'CTL'
  );
  if not transferred then
    raise exception 'valid enrollment transfer failed';
  end if;
  select enrolled_at into enrolled_at_after
    from public.enrollments
   where user_id = '00000000-0000-0000-0000-000000000101'
     and course_slug = 'eco-1002'
     and semester = 'fall-2026';
  if enrolled_at_after is distinct from enrolled_at_before then
    raise exception 'enrollment transfer changed the original enrollment time';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000202', true);
do $$
declare
  visible_rows integer;
begin
  select count(*) into visible_rows
    from public.workshop_attendance
   where user_id = '00000000-0000-0000-0000-000000000101';
  if visible_rows <> 0 then
    raise exception 'destination instructor could read another owner''s historical workshop attendance';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', true);
do $$
declare
  visible_rows integer;
begin
  select count(*) into visible_rows
    from public.workshop_attendance
   where user_id = '00000000-0000-0000-0000-000000000101';
  if visible_rows <> 0 then
    raise exception 'former instructor retained attendance access after transfer';
  end if;
end $$;

reset role;
do $$
declare
  reserved boolean;
  claimed_rows integer;
begin
  begin
    update public.profiles
       set role = 'student'
     where id = '00000000-0000-0000-0000-000000000201';
    raise exception 'instructor with owned rows was directly demoted';
  exception when check_violation then null;
  end;
  begin
    delete from public.teaching_assignments
     where instructor_id = '00000000-0000-0000-0000-000000000201'
       and course_slug = 'eco-1002'
       and semester = 'spring-2026';
    raise exception 'active teaching assignment was directly deleted';
  exception when check_violation then null;
  end;
  begin
    perform public.reserve_archive_paper_upload_intent(
      '00000000-0000-0000-0000-000000000411',
      '00000000-0000-0000-0000-000000000101',
      'eco-1002', 'exam', 'Unauthorized upload', 'fall', 2026, '{}',
      '00000000-0000-0000-0000-000000000101/eco-1002/411/file.pdf',
      'file.pdf', 'application/pdf', 128, now() + interval '1 hour'
    );
    raise exception 'student reserved an archive upload intent';
  exception when insufficient_privilege then null;
  end;

  reserved := public.reserve_archive_paper_upload_intent(
    '00000000-0000-0000-0000-000000000412',
    '00000000-0000-0000-0000-000000000201',
    'eco-1002', 'exam', 'Cleanup race fixture', 'fall', 2026, '{}',
    '00000000-0000-0000-0000-000000000201/eco-1002/412/file.pdf',
    'file.pdf', 'application/pdf', 128, now() + interval '1 hour'
  );
  if not reserved then raise exception 'authorized upload reservation failed'; end if;
  select count(*) into claimed_rows
    from public.claim_archive_paper_upload_intents(
      '00000000-0000-0000-0000-000000000201', now(), 100
    ) c
   where c.intent_id = '00000000-0000-0000-0000-000000000412'
     and c.action = 'delete';
  if claimed_rows <> 1 then
    raise exception 'pending upload was not atomically claimed for cleanup';
  end if;
  begin
    insert into public.archive_papers (
      id, course_slug, kind, title, semester_term, semester_year, covers,
      storage_path, original_filename, content_type, size_bytes, created_by,
      upload_intent_id, published
    ) values (
      '00000000-0000-0000-0000-000000000412', 'eco-1002', 'exam',
      'Cleanup race fixture', 'fall', 2026, '{}',
      '00000000-0000-0000-0000-000000000201/eco-1002/412/file.pdf',
      'file.pdf', 'application/pdf', 128,
      '00000000-0000-0000-0000-000000000201',
      '00000000-0000-0000-0000-000000000412', false
    );
    raise exception 'cleanup-claimed upload was finalized';
  exception when check_violation then null;
  end;
  delete from public.archive_paper_upload_intents
   where id = '00000000-0000-0000-0000-000000000412';

  reserved := public.reserve_archive_paper_upload_intent(
    '00000000-0000-0000-0000-000000000413',
    '00000000-0000-0000-0000-000000000201',
    'eco-1002', 'exam', 'Finalize race fixture', 'fall', 2026, '{}',
    '00000000-0000-0000-0000-000000000201/eco-1002/413/file.pdf',
    'file.pdf', 'application/pdf', 128, now() + interval '1 hour'
  );
  if not reserved then raise exception 'second upload reservation failed'; end if;
  insert into public.archive_papers (
    id, course_slug, kind, title, semester_term, semester_year, covers,
    storage_path, original_filename, content_type, size_bytes, created_by,
    upload_intent_id, published
  ) values (
    '00000000-0000-0000-0000-000000000413', 'eco-1002', 'exam',
    'Finalize race fixture', 'fall', 2026, '{}',
    '00000000-0000-0000-0000-000000000201/eco-1002/413/file.pdf',
    'file.pdf', 'application/pdf', 128,
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000413', false
  );
  if not exists (
    select 1 from public.archive_paper_upload_intents
     where id = '00000000-0000-0000-0000-000000000413'
       and state = 'finalized' and finalized_at is not null
  ) then
    raise exception 'paper insert did not atomically finalize its intent';
  end if;
  select count(*) into claimed_rows
    from public.claim_archive_paper_upload_intents(
      '00000000-0000-0000-0000-000000000201', now(), 100
    ) c
   where c.intent_id = '00000000-0000-0000-0000-000000000413';
  if claimed_rows <> 0 then
    raise exception 'cleanup claimed finalized paper bytes';
  end if;
  delete from public.archive_papers
   where id = '00000000-0000-0000-0000-000000000413';
  delete from public.archive_paper_upload_intents
   where id = '00000000-0000-0000-0000-000000000413';

  begin
    insert into public.archive_paper_upload_intents (
      id, actor_id, course_slug, kind, title, semester_term, semester_year,
      covers, storage_path, original_filename, content_type, file_size,
      published, state, expires_at
    ) values (
      '00000000-0000-0000-0000-000000000414',
      '00000000-0000-0000-0000-000000000201',
      'eco-1002', 'exam', 'Legacy publish fixture', 'fall', 2026, '{}',
      '00000000-0000-0000-0000-000000000201/eco-1002/414/file.pdf',
      'file.pdf', 'application/pdf', 128, true, 'pending',
      now() + interval '1 hour'
    );
    raise exception 'non-finalized upload retained published=true';
  exception when check_violation then null;
  end;

  insert into public.archive_paper_upload_intents (
    id, actor_id, course_slug, kind, title, semester_term, semester_year,
    covers, storage_path, original_filename, content_type, file_size,
    published, state, expires_at
  ) values (
    '00000000-0000-0000-0000-000000000415',
    '00000000-0000-0000-0000-000000000203',
    'eco-1002', 'exam', 'TA lifecycle fixture', 'fall', 2026, '{}',
    '00000000-0000-0000-0000-000000000203/eco-1002/415/file.pdf',
    'file.pdf', 'application/pdf', 128, false, 'pending',
    now() + interval '1 hour'
  );
  begin
    update public.profiles
       set role = 'student'
     where id = '00000000-0000-0000-0000-000000000203';
    raise exception 'TA with owned rows was directly demoted';
  exception when check_violation then null;
  end;
  delete from public.archive_paper_upload_intents
   where id = '00000000-0000-0000-0000-000000000415';
end $$;

insert into auth.users (
  id, email, email_confirmed_at, aud, role, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000301', 'offboard-target@example.test', now(), 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000302', 'offboard-successor@example.test', now(), 'authenticated', 'authenticated', now(), now());
insert into public.profiles (id, role) values
  ('00000000-0000-0000-0000-000000000301', 'instructor'),
  ('00000000-0000-0000-0000-000000000302', 'instructor')
on conflict (id) do update set role = excluded.role;
insert into public.teaching_assignments (
  instructor_id, course_slug, semester, active, assigned_by
) values (
  '00000000-0000-0000-0000-000000000301',
  'eco-1002', 'fall-2027', true,
  '00000000-0000-0000-0000-000000000204'
);
insert into public.enrollments (
  user_id, course_slug, semester, instructor_id, section
) values (
  '00000000-0000-0000-0000-000000000103',
  'eco-1002', 'fall-2027',
  '00000000-0000-0000-0000-000000000301', 'CTL'
);
insert into public.offering_lesson_progress (
  user_id, course_slug, semester, instructor_id, lesson_slug, status
) values (
  '00000000-0000-0000-0000-000000000103',
  'eco-1002', 'fall-2027',
  '00000000-0000-0000-0000-000000000301',
  'eco-1002/offboard-fixture', 'started'
);
insert into public.archive_videos (
  course_slug, lesson_slug, semester_term, semester_year, title,
  provider, video_id, created_by
) values (
  'eco-1002', 'eco-1002/offboard-fixture', 'fall', 2027,
  'Offboarding fixture', 'youtube', 'offboard001',
  '00000000-0000-0000-0000-000000000301'
);
insert into public.archive_paper_upload_intents (
  id, actor_id, course_slug, kind, title, semester_term, semester_year,
  covers, storage_path, original_filename, content_type, file_size,
  published, state, expires_at
) values
  (
    '00000000-0000-0000-0000-000000000421',
    '00000000-0000-0000-0000-000000000301',
    'eco-1002', 'exam', 'Offboard pending', 'fall', 2027, '{}',
    '00000000-0000-0000-0000-000000000301/eco-1002/421/file.pdf',
    'file.pdf', 'application/pdf', 128, false, 'pending',
    now() + interval '1 hour'
  ),
  (
    '00000000-0000-0000-0000-000000000422',
    '00000000-0000-0000-0000-000000000301',
    'eco-1002', 'exam', 'Offboard expired', 'fall', 2027, '{}',
    '00000000-0000-0000-0000-000000000301/eco-1002/422/file.pdf',
    'file.pdf', 'application/pdf', 128, false, 'expired',
    now() + interval '1 hour'
  ),
  (
    '00000000-0000-0000-0000-000000000423',
    '00000000-0000-0000-0000-000000000301',
    'eco-1002', 'exam', 'Offboard finalized', 'fall', 2027, '{}',
    '00000000-0000-0000-0000-000000000301/eco-1002/423/file.pdf',
    'file.pdf', 'application/pdf', 128, false, 'pending',
    now() + interval '1 hour'
  );
insert into public.archive_papers (
  id, course_slug, kind, title, semester_term, semester_year, covers,
  storage_path, original_filename, content_type, size_bytes, created_by,
  upload_intent_id, published
) values (
  '00000000-0000-0000-0000-000000000423',
  'eco-1002', 'exam', 'Offboard finalized', 'fall', 2027, '{}',
  '00000000-0000-0000-0000-000000000301/eco-1002/423/file.pdf',
  'file.pdf', 'application/pdf', 128,
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000423', false
);
do $$
declare
  outcome text;
begin
  outcome := public.offboard_staff(
    '00000000-0000-0000-0000-000000000204',
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000302'
  );
  if outcome <> 'offboarded'
     or exists (
       select 1 from public.teaching_assignments
        where instructor_id = '00000000-0000-0000-0000-000000000301'
     )
     or exists (
       select 1 from public.enrollments
        where instructor_id = '00000000-0000-0000-0000-000000000301'
     )
     or exists (
       select 1 from public.offering_lesson_progress
        where instructor_id = '00000000-0000-0000-0000-000000000301'
     )
     or exists (
       select 1 from public.archive_videos
        where created_by = '00000000-0000-0000-0000-000000000301'
     )
     or not exists (
       select 1 from public.profiles
        where id = '00000000-0000-0000-0000-000000000301'
          and role = 'student'
     )
     or (
       select count(*) from public.archive_paper_upload_intents
        where actor_id = '00000000-0000-0000-0000-000000000301'
          and state in ('pending', 'expired')
     ) <> 2
     or not exists (
       select 1 from public.archive_paper_upload_intents
        where id = '00000000-0000-0000-0000-000000000423'
          and actor_id = '00000000-0000-0000-0000-000000000302'
          and state = 'finalized'
     ) then
    raise exception 'staff ownership was not transferred atomically';
  end if;
  outcome := public.offboard_staff(
    '00000000-0000-0000-0000-000000000204',
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000302'
  );
  if outcome <> 'already_offboarded' then
    raise exception 'staff offboarding retry returned %', outcome;
  end if;
end $$;
do $$
begin
  begin
    insert into public.archive_papers (
      id, course_slug, kind, title, semester_term, semester_year, covers,
      storage_path, original_filename, content_type, size_bytes, created_by,
      upload_intent_id, published
    ) values (
      '00000000-0000-0000-0000-000000000421',
      'eco-1002', 'exam', 'Offboard pending', 'fall', 2027, '{}',
      '00000000-0000-0000-0000-000000000301/eco-1002/421/file.pdf',
      'file.pdf', 'application/pdf', 128,
      '00000000-0000-0000-0000-000000000301',
      '00000000-0000-0000-0000-000000000421', false
    );
    raise exception 'offboarded actor finalized a pending upload';
  exception when check_violation then null;
  end;
  if not exists (
    select 1 from public.archive_paper_upload_intents
     where id = '00000000-0000-0000-0000-000000000421'
       and actor_id = '00000000-0000-0000-0000-000000000301'
       and state = 'pending'
  ) then
    raise exception 'rejected post-offboard finalization mutated its intent';
  end if;
end $$;
delete from auth.users
 where id = '00000000-0000-0000-0000-000000000301';
delete from public.archive_papers
 where id = '00000000-0000-0000-0000-000000000423';
delete from public.archive_paper_upload_intents
 where id = '00000000-0000-0000-0000-000000000423';
delete from public.archive_videos
 where created_by = '00000000-0000-0000-0000-000000000302'
   and lesson_slug = 'eco-1002/offboard-fixture';
delete from public.offering_lesson_progress
 where instructor_id = '00000000-0000-0000-0000-000000000302'
   and lesson_slug = 'eco-1002/offboard-fixture';
delete from public.enrollments
 where instructor_id = '00000000-0000-0000-0000-000000000302'
   and semester = 'fall-2027';
update public.teaching_assignments
   set active = false,
       updated_at = now()
 where instructor_id = '00000000-0000-0000-0000-000000000302'
   and semester = 'fall-2027';
delete from public.teaching_assignments
 where instructor_id = '00000000-0000-0000-0000-000000000302'
   and semester = 'fall-2027';
delete from auth.users
 where id = '00000000-0000-0000-0000-000000000302';

do $$
declare
  roster_definition text;
  mutation_definition text;
begin
  select p.prosrc into roster_definition
    from pg_catalog.pg_proc p
   where p.oid = 'public.apply_roster_import(uuid,uuid,text,text,jsonb)'::regprocedure;
  select p.prosrc into mutation_definition
    from pg_catalog.pg_proc p
   where p.oid = 'public.mutate_enrollment(uuid,uuid,text,text,uuid,text,text,text)'::regprocedure;
  if strpos(roster_definition, 'enrollment-scope:') = 0
     or strpos(roster_definition, 'enrollment:') = 0
     or strpos(roster_definition, 'enrollment-scope:')
        > strpos(roster_definition, 'enrollment:') then
    raise exception 'roster import does not acquire enrollment scope first';
  end if;
  if strpos(mutation_definition, 'enrollment-scope:') = 0
     or strpos(mutation_definition, 'enrollment:') = 0
     or strpos(mutation_definition, 'enrollment-scope:')
        > strpos(mutation_definition, 'enrollment:') then
    raise exception 'enrollment mutation does not acquire enrollment scope first';
  end if;
end $$;

do $$
begin
  if has_function_privilege('anon', 'public.handle_new_user()', 'execute')
     or has_function_privilege('authenticated', 'public.handle_new_user()', 'execute')
     or has_function_privilege('anon', 'public.backfill_email_hmac()', 'execute')
     or has_function_privilege('authenticated', 'public.backfill_email_hmac()', 'execute')
     or has_function_privilege('anon', 'public.log_disclosure(text,uuid,text,jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.log_disclosure(text,uuid,text,jsonb)', 'execute')
     or has_function_privilege('anon', 'public.purge_inactive_accounts(integer)', 'execute')
     or has_function_privilege('authenticated', 'public.purge_inactive_accounts(integer)', 'execute')
     or has_function_privilege('anon', 'public.purge_old_quiz_attempts(integer)', 'execute')
     or has_function_privilege('authenticated', 'public.purge_old_quiz_attempts(integer)', 'execute')
     or has_function_privilege('anon', 'public.accept_terms(uuid,text,text)', 'execute')
     or has_function_privilege('authenticated', 'public.accept_terms(uuid,text,text)', 'execute')
     or has_function_privilege('anon', 'public.record_lesson_progress(uuid,text,text,text)', 'execute')
     or has_function_privilege('authenticated', 'public.record_lesson_progress(uuid,text,text,text)', 'execute')
     or has_function_privilege('anon', 'public.record_quiz_attempt(uuid,text,text,numeric,numeric,jsonb,uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.record_quiz_attempt(uuid,text,text,numeric,numeric,jsonb,uuid)', 'execute')
     or has_function_privilege('anon', 'public.offboard_staff(uuid,uuid,uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.offboard_staff(uuid,uuid,uuid)', 'execute')
     or has_function_privilege('anon', 'public.reserve_archive_paper_upload_intent(uuid,uuid,text,text,text,text,integer,text[],text,text,text,bigint,timestamptz)', 'execute')
     or has_function_privilege('authenticated', 'public.reserve_archive_paper_upload_intent(uuid,uuid,text,text,text,text,integer,text[],text,text,text,bigint,timestamptz)', 'execute')
     or has_function_privilege('anon', 'public.claim_archive_paper_upload_intents(uuid,timestamptz,integer)', 'execute')
     or has_function_privilege('authenticated', 'public.claim_archive_paper_upload_intents(uuid,timestamptz,integer)', 'execute')
     or has_function_privilege('anon', 'public.transfer_enrollment_scope(uuid,uuid,text,text,uuid,uuid,text,text)', 'execute')
     or has_function_privilege('authenticated', 'public.transfer_enrollment_scope(uuid,uuid,text,text,uuid,uuid,text,text)', 'execute')
     or has_function_privilege('anon', 'public.apply_roster_import(uuid,uuid,text,text,jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.apply_roster_import(uuid,uuid,text,text,jsonb)', 'execute')
     or has_function_privilege('anon', 'public.mutate_enrollment(uuid,uuid,text,text,uuid,text,text,text)', 'execute')
     or has_function_privilege('authenticated', 'public.mutate_enrollment(uuid,uuid,text,text,uuid,text,text,text)', 'execute')
     or has_function_privilege('anon', 'public.mutate_archive_item(uuid,text,uuid,text,jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.mutate_archive_item(uuid,text,uuid,text,jsonb)', 'execute')
     or has_function_privilege('anon', 'public.mutate_workshop(uuid,uuid,text,uuid,text)', 'execute')
     or has_function_privilege('authenticated', 'public.mutate_workshop(uuid,uuid,text,uuid,text)', 'execute')
     or has_function_privilege('anon', 'public.record_workshop_stamp(uuid,uuid,text,text)', 'execute')
     or has_function_privilege('authenticated', 'public.record_workshop_stamp(uuid,uuid,text,text)', 'execute')
     or has_function_privilege('anon', 'public.resolve_current_enrollment_scope(uuid,text)', 'execute')
     or has_function_privilege('authenticated', 'public.resolve_current_enrollment_scope(uuid,text)', 'execute')
     or has_function_privilege('anon', 'public.validate_manual_workshop_attendance_insert()', 'execute')
     or has_function_privilege('authenticated', 'public.validate_manual_workshop_attendance_insert()', 'execute')
     or has_function_privilege('anon', 'public.guard_active_assignment_reference()', 'execute')
     or has_function_privilege('authenticated', 'public.guard_active_assignment_reference()', 'execute')
     or has_function_privilege('anon', 'public.guard_teaching_assignment_state()', 'execute')
     or has_function_privilege('authenticated', 'public.guard_teaching_assignment_state()', 'execute')
     or has_function_privilege('anon', 'public.guard_instructor_role_change()', 'execute')
     or has_function_privilege('authenticated', 'public.guard_instructor_role_change()', 'execute')
     or has_function_privilege('anon', 'public.guard_archive_creator_course()', 'execute')
     or has_function_privilege('authenticated', 'public.guard_archive_creator_course()', 'execute')
     or has_function_privilege('anon', 'public.guard_archive_paper_upload_link()', 'execute')
     or has_function_privilege('authenticated', 'public.guard_archive_paper_upload_link()', 'execute')
     or has_function_privilege('anon', 'public.finalize_archive_paper_upload_link()', 'execute')
     or has_function_privilege('authenticated', 'public.finalize_archive_paper_upload_link()', 'execute')
     or has_function_privilege('anon', 'public.reject_immutable_scope_update()', 'execute')
     or has_function_privilege('authenticated', 'public.reject_immutable_scope_update()', 'execute')
     or has_function_privilege('anon', 'public.lock_enrollment_scope()', 'execute')
     or has_function_privilege('authenticated', 'public.lock_enrollment_scope()', 'execute')
     or has_function_privilege('anon', 'public.guard_workshop_attendee_role()', 'execute')
     or has_function_privilege('authenticated', 'public.guard_workshop_attendee_role()', 'execute') then
    raise exception 'untrusted role can execute a protected function';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.accept_terms(uuid,text,text)',
    'execute'
  ) or not has_function_privilege(
    'service_role',
    'public.record_lesson_progress(uuid,text,text,text)',
    'execute'
  ) or not has_function_privilege(
    'service_role',
    'public.record_quiz_attempt(uuid,text,text,numeric,numeric,jsonb,uuid)',
    'execute'
  ) or not has_function_privilege(
    'service_role',
    'public.offboard_staff(uuid,uuid,uuid)',
    'execute'
  ) then
    raise exception 'service role cannot execute feature integrity RPCs';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.reserve_archive_paper_upload_intent(uuid,uuid,text,text,text,text,integer,text[],text,text,text,bigint,timestamptz)',
    'execute'
  ) or not has_function_privilege(
    'service_role',
    'public.claim_archive_paper_upload_intents(uuid,timestamptz,integer)',
    'execute'
  ) then
    raise exception 'service role cannot reserve archive upload intents';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.resolve_current_enrollment_scope(uuid,text)',
    'execute'
  ) or not has_function_privilege(
    'service_role',
    'public.transfer_enrollment_scope(uuid,uuid,text,text,uuid,uuid,text,text)',
    'execute'
  ) then
    raise exception 'service role cannot resolve or transfer enrollment scope';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.apply_roster_import(uuid,uuid,text,text,jsonb)',
    'execute'
  ) or not has_function_privilege(
    'service_role',
    'public.mutate_enrollment(uuid,uuid,text,text,uuid,text,text,text)',
    'execute'
  ) or not has_function_privilege(
    'service_role',
    'public.mutate_archive_item(uuid,text,uuid,text,jsonb)',
    'execute'
  ) or not has_function_privilege(
    'service_role',
    'public.mutate_workshop(uuid,uuid,text,uuid,text)',
    'execute'
  ) or not has_function_privilege(
    'service_role',
    'public.record_workshop_stamp(uuid,uuid,text,text)',
    'execute'
  ) then
    raise exception 'service role cannot execute actor-aware mutations';
  end if;
  if to_regprocedure(
    'public.instructor_can_read_workshop_attendance(uuid,uuid)'
  ) is not null then
    raise exception 'attendance policy helper remains exposed in public';
  end if;
  if has_function_privilege(
    'anon',
    'private.instructor_can_read_workshop_attendance(uuid,uuid)',
    'execute'
  ) or not has_function_privilege(
    'authenticated',
    'private.instructor_can_read_workshop_attendance(uuid,uuid)',
    'execute'
  ) then
    raise exception 'attendance policy helper has incorrect execute grants';
  end if;
  if not exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private'
       and p.proname = 'instructor_can_read_workshop_attendance'
       and p.prosecdef
       and p.proconfig @> array['search_path=""']::text[]
  ) then
    raise exception 'private attendance policy helper is not hardened SECURITY DEFINER';
  end if;
end $$;

rollback;
