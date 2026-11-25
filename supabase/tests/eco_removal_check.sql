-- ECO 1002 removal (2026-11-25), step 2 of the rehearsal: runs after
-- eco_removal_setup.sql and a schema.sql run on the pre-removal database.
do $$
declare
  v_count integer;
  v_names text;
begin
  -- Every ECO 1002 row is gone, including the legacy lesson-progress row
  -- and the quiz attempt that had no course_slug.
  select
    (select count(*) from public.workshop_administrations
      where course_slug <> 'fin-3610' or workshop_slug like 'eco-1002-%')
    + (select count(*) from public.enrollments where course_slug <> 'fin-3610')
    + (select count(*) from public.offering_lesson_progress
        where course_slug <> 'fin-3610')
    + (select count(*) from public.quiz_attempts
        where course_slug is distinct from 'fin-3610')
    + (select count(*) from public.lesson_progress
        where course_slug is distinct from 'fin-3610')
    + (select count(*) from public.tutor_messages where course_slug <> 'fin-3610')
    + (select count(*) from public.archive_papers where course_slug <> 'fin-3610')
    + (select count(*) from public.archive_paper_upload_intents
        where course_slug <> 'fin-3610')
    + (select count(*) from public.archive_quizzes where course_slug <> 'fin-3610')
    + (select count(*) from public.teaching_assignments
        where course_slug <> 'fin-3610')
    + (select count(*) from public.profiles where active_course_slug = 'eco-1002')
    into v_count;
  if v_count <> 0 then
    raise exception '% ECO 1002 row(s) survived the removal', v_count;
  end if;

  -- Every FIN 3610 row seeded by the setup file is still there.
  if (select count(*) from public.enrollments
       where user_id = '00000000-0000-0000-0000-000000000961') <> 1
     or (select count(*) from public.lesson_progress
          where user_id = '00000000-0000-0000-0000-000000000961') <> 1
     or (select count(*) from public.offering_lesson_progress
          where user_id = '00000000-0000-0000-0000-000000000961') <> 1
     or (select count(*) from public.quiz_attempts
          where user_id = '00000000-0000-0000-0000-000000000961') <> 2
     or (select count(*) from public.tutor_messages
          where user_id = '00000000-0000-0000-0000-000000000961') <> 1
     or (select count(*) from public.workshop_administrations
          where instructor_id = '00000000-0000-0000-0000-000000000972') <> 1
     or (select count(*) from public.workshop_attendance
          where user_id = '00000000-0000-0000-0000-000000000961') <> 1
     or (select count(*) from public.archive_papers
          where created_by = '00000000-0000-0000-0000-000000000972') <> 1
     or (select count(*) from public.archive_paper_upload_intents
          where actor_id = '00000000-0000-0000-0000-000000000972') <> 1
     or (select count(*) from public.archive_quizzes
          where created_by = '00000000-0000-0000-0000-000000000972') <> 1
     or (select count(*) from public.teaching_assignments
          where instructor_id = '00000000-0000-0000-0000-000000000972'
            and active) <> 1 then
    raise exception 'the removal deleted or changed FIN 3610 rows';
  end if;
  if (
    select active_course_slug from public.profiles
     where id = '00000000-0000-0000-0000-000000000961'
  ) is distinct from 'fin-3610' then
    raise exception 'a FIN 3610 active-course preference was cleared';
  end if;

  -- Per-day sections and lecture videos are gone.
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and column_name = 'section'
  ) then
    raise exception 'a section column is still present';
  end if;
  if pg_catalog.to_regtype('public.workshop_section') is not null then
    raise exception 'the workshop_section type is still present';
  end if;
  if pg_catalog.to_regclass('public.archive_videos') is not null then
    raise exception 'archive_videos is still present';
  end if;

  -- No rule names the retired course, and every course table has its
  -- one-course check back.
  select string_agg(c.conname, ', ') into v_names
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_namespace n on n.oid = c.connamespace
   where n.nspname = 'public'
     and pg_catalog.pg_get_constraintdef(c.oid) like '%eco-1002%';
  if v_names is not null then
    raise exception 'checks still name eco-1002: %', v_names;
  end if;
  select string_agg(expected.name, ', ') into v_names
    from unnest(array[
      'teaching_assignments_course_slug_check',
      'lesson_progress_course_chk',
      'quiz_attempts_course_chk',
      'enrollments_course_check',
      'offering_lesson_progress_course_slug_check',
      'workshop_admins_course_check',
      'archive_paper_upload_intents_course_slug_check',
      'archive_papers_course_chk',
      'archive_quizzes_course_chk',
      'tutor_messages_course_slug_check'
    ]) as expected(name)
   where not exists (
     select 1 from pg_catalog.pg_constraint c
      where c.conname = expected.name
        and c.convalidated
        and pg_catalog.pg_get_constraintdef(c.oid) like '%fin-3610%'
   );
  if v_names is not null then
    raise exception 'missing one-course checks: %', v_names;
  end if;

  -- What the removal dropped on the way and must have recreated.
  if not exists (
    select 1 from pg_catalog.pg_policies
     where schemaname = 'public'
       and tablename = 'workshop_administrations'
       and policyname = 'workshop_admins_course_read'
  ) then
    raise exception 'the workshop read policy did not come back';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_trigger
     where tgrelid = 'public.workshop_administrations'::regclass
       and tgname = 'workshop_admins_scope_update_reject'
  ) then
    raise exception 'the workshop scope trigger did not come back';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_indexes
     where schemaname = 'public'
       and indexname = 'workshop_admins_week_unique'
  ) or exists (
    select 1 from pg_catalog.pg_indexes
     where schemaname = 'public'
       and indexname in (
         'workshop_admins_section_week_unique',
         'workshop_admins_nosection_week_unique'
       )
  ) then
    raise exception 'the one-window-per-week index is wrong';
  end if;
end $$;

-- Remove the surviving FIN 3610 fixtures so the RLS suites, which count
-- rows, can run on this database afterwards.
delete from public.workshop_administrations
 where instructor_id = '00000000-0000-0000-0000-000000000972';
delete from public.tutor_messages
 where user_id = '00000000-0000-0000-0000-000000000961';
delete from public.quiz_attempts
 where user_id in (
   '00000000-0000-0000-0000-000000000961',
   '00000000-0000-0000-0000-000000000962'
 );
delete from public.offering_lesson_progress
 where user_id = '00000000-0000-0000-0000-000000000961';
delete from public.lesson_progress
 where user_id = '00000000-0000-0000-0000-000000000961';
delete from public.enrollments
 where user_id = '00000000-0000-0000-0000-000000000961';
delete from public.archive_papers
 where created_by = '00000000-0000-0000-0000-000000000972';
delete from public.archive_paper_upload_intents
 where actor_id = '00000000-0000-0000-0000-000000000972';
delete from public.archive_quizzes
 where created_by = '00000000-0000-0000-0000-000000000972';
update public.teaching_assignments
   set active = false
 where instructor_id = '00000000-0000-0000-0000-000000000972';
delete from public.teaching_assignments
 where instructor_id = '00000000-0000-0000-0000-000000000972';
delete from auth.users
 where id in (
   '00000000-0000-0000-0000-000000000961',
   '00000000-0000-0000-0000-000000000962',
   '00000000-0000-0000-0000-000000000971',
   '00000000-0000-0000-0000-000000000972',
   '00000000-0000-0000-0000-000000000974'
 );
