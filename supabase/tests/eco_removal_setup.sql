-- ECO 1002 removal (2026-11-25), step 1 of the rehearsal. Runs on a database
-- built from fixtures/pre_eco_removal_schema.sql, the schema production had
-- before the removal: it still has both courses, the per-day `section`
-- columns and archive_videos. Seeds ECO 1002 and FIN 3610 rows in every
-- table the removal touches. schema.sql then runs on top, and
-- eco_removal_check.sql confirms what went and what stayed.
insert into auth.users (
  id, email, email_confirmed_at, aud, role, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000961', 'eco-removal-both@example.test', now(), 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000962', 'eco-removal-eco-only@example.test', now(), 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000971', 'eco-removal-eco-instructor@example.test', now(), 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000972', 'eco-removal-fin-instructor@example.test', now(), 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000974', 'eco-removal-admin@example.test', now(), 'authenticated', 'authenticated', now(), now());

insert into public.profiles (id, role) values
  ('00000000-0000-0000-0000-000000000961', 'student'),
  ('00000000-0000-0000-0000-000000000962', 'student'),
  ('00000000-0000-0000-0000-000000000971', 'instructor'),
  ('00000000-0000-0000-0000-000000000972', 'instructor'),
  ('00000000-0000-0000-0000-000000000974', 'admin')
on conflict (id) do update set role = excluded.role;
update public.profiles set active_course_slug = 'fin-3610'
 where id = '00000000-0000-0000-0000-000000000961';
update public.profiles set active_course_slug = 'eco-1002'
 where id = '00000000-0000-0000-0000-000000000962';

-- Instructor 972 teaches both courses; 971 teaches only ECO 1002.
insert into public.teaching_assignments (
  instructor_id, course_slug, semester, active, assigned_by
) values
  ('00000000-0000-0000-0000-000000000971', 'eco-1002', 'fall-2026', true, '00000000-0000-0000-0000-000000000974'),
  ('00000000-0000-0000-0000-000000000972', 'eco-1002', 'spring-2026', true, '00000000-0000-0000-0000-000000000974'),
  ('00000000-0000-0000-0000-000000000972', 'fin-3610', 'fall-2026', true, '00000000-0000-0000-0000-000000000974');

insert into public.enrollments (
  user_id, course_slug, instructor_id, semester, section
) values
  ('00000000-0000-0000-0000-000000000961', 'eco-1002', '00000000-0000-0000-0000-000000000971', 'fall-2026', 'CML'),
  ('00000000-0000-0000-0000-000000000961', 'fin-3610', '00000000-0000-0000-0000-000000000972', 'fall-2026', null),
  ('00000000-0000-0000-0000-000000000962', 'eco-1002', '00000000-0000-0000-0000-000000000971', 'fall-2026', 'CTL'),
  ('00000000-0000-0000-0000-000000000962', 'eco-1002', '00000000-0000-0000-0000-000000000972', 'spring-2026', 'CWL');

-- The third row is a legacy one with no course_slug: only its slug prefix
-- says it is ECO 1002.
insert into public.lesson_progress (user_id, lesson_slug, course_slug, status)
values
  ('00000000-0000-0000-0000-000000000961', 'eco-1002/solow', 'eco-1002', 'completed'),
  ('00000000-0000-0000-0000-000000000961', 'fin-3610/npv-decision-rule', 'fin-3610', 'completed'),
  ('00000000-0000-0000-0000-000000000962', 'eco-1002/ad-as', null, 'started');

insert into public.offering_lesson_progress (
  user_id, lesson_slug, course_slug, semester, instructor_id, status
) values
  ('00000000-0000-0000-0000-000000000961', 'eco-1002/solow', 'eco-1002', 'fall-2026', '00000000-0000-0000-0000-000000000971', 'completed'),
  ('00000000-0000-0000-0000-000000000961', 'fin-3610/npv-decision-rule', 'fin-3610', 'fall-2026', '00000000-0000-0000-0000-000000000972', 'completed');

insert into public.archive_quizzes (
  id, course_slug, kind, title, semester_term, semester_year, covers,
  questions, created_by, published
) values
  ('00000000-0000-0000-0000-0000000009e1', 'eco-1002', 'exam', 'ECO midterm', 'fall', 2026, '{}',
   '[{"type":"numeric","id":"q1","prompt":"1+1","answer":2,"explanation":"2"}]'::jsonb,
   '00000000-0000-0000-0000-000000000971', true),
  ('00000000-0000-0000-0000-0000000009f1', 'fin-3610', 'exam', 'FIN midterm', 'fall', 2026, '{}',
   '[{"type":"numeric","id":"q1","prompt":"1+1","answer":2,"explanation":"2"}]'::jsonb,
   '00000000-0000-0000-0000-000000000972', true);

-- Attempts on instructor-authored quizzes are stored under the quiz id.
insert into public.quiz_attempts (
  user_id, quiz_slug, course_slug, semester, instructor_id,
  score, max_score, answers
) values
  ('00000000-0000-0000-0000-000000000961', 'eco-1002-solow', 'eco-1002', 'fall-2026', '00000000-0000-0000-0000-000000000971', 1, 1, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000961', 'fin-3610-npv-decision-rule', 'fin-3610', 'fall-2026', '00000000-0000-0000-0000-000000000972', 1, 1, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000962', '00000000-0000-0000-0000-0000000009e1', 'eco-1002', 'fall-2026', '00000000-0000-0000-0000-000000000971', 1, 1, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000962', '00000000-0000-0000-0000-0000000009e1', null, null, null, 1, 1, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000961', '00000000-0000-0000-0000-0000000009f1', 'fin-3610', 'fall-2026', '00000000-0000-0000-0000-000000000972', 1, 1, '{}'::jsonb);

-- An ECO section window on its weekday (2026-07-13 is a Monday), a legacy
-- (schedule_version 1) ECO window that is open right now, which the
-- assignment trigger would refuse to orphan, and a FIN window.
insert into public.workshop_administrations (
  workshop_slug, course_slug, semester, section, week_of, schedule_version,
  instructor_id, opens_at, closes_at
) values
  ('eco-1002-ad-as', 'eco-1002', 'fall-2026', 'CML', '2026-07-13', 2, '00000000-0000-0000-0000-000000000971', '2026-07-13 12:00:00+00', '2026-07-13 14:00:00+00'),
  ('eco-1002-is-lm-intro', 'eco-1002', 'fall-2026', 'CML', '2026-07-20', 1, '00000000-0000-0000-0000-000000000971', now() - interval '1 hour', now() + interval '1 day'),
  ('fin-3610-unit-1-foundations', 'fin-3610', 'fall-2026', null, '2026-07-13', 2, '00000000-0000-0000-0000-000000000972', '2026-07-13 12:00:00+00', '2026-07-13 14:00:00+00');

insert into public.workshop_attendance (
  administration_id, user_id, verification_method, device_hmac
)
select id, '00000000-0000-0000-0000-000000000961'::uuid, 'window',
       repeat(case course_slug when 'eco-1002' then 'e' else 'f' end, 64)
  from public.workshop_administrations
 where workshop_slug in ('eco-1002-ad-as', 'fin-3610-unit-1-foundations');

insert into public.archive_videos (
  course_slug, lesson_slug, semester_term, semester_year, title,
  provider, video_id, created_by
) values (
  'eco-1002', 'eco-1002/solow', 'fall', 2026, 'Solow lecture',
  'youtube', 'abcdefghijk', '00000000-0000-0000-0000-000000000971'
);

insert into public.archive_paper_upload_intents (
  id, actor_id, course_slug, kind, title, semester_term, semester_year,
  covers, storage_path, original_filename, content_type, file_size,
  published, state, expires_at
) values
  ('00000000-0000-0000-0000-0000000009a1', '00000000-0000-0000-0000-000000000971',
   'eco-1002', 'exam', 'ECO final', 'fall', 2026, '{}',
   '00000000-0000-0000-0000-000000000971/eco-1002/9a1/file.pdf',
   'file.pdf', 'application/pdf', 128, false, 'pending', now() + interval '1 hour'),
  ('00000000-0000-0000-0000-0000000009a2', '00000000-0000-0000-0000-000000000971',
   'eco-1002', 'exam', 'ECO pending upload', 'fall', 2026, '{}',
   '00000000-0000-0000-0000-000000000971/eco-1002/9a2/file.pdf',
   'file.pdf', 'application/pdf', 128, false, 'pending', now() + interval '1 hour'),
  ('00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-000000000972',
   'fin-3610', 'exam', 'FIN final', 'fall', 2026, '{}',
   '00000000-0000-0000-0000-000000000972/fin-3610/9b1/file.pdf',
   'file.pdf', 'application/pdf', 128, false, 'pending', now() + interval '1 hour');
insert into public.archive_papers (
  id, course_slug, kind, title, semester_term, semester_year, covers,
  storage_path, original_filename, content_type, size_bytes, created_by,
  upload_intent_id, published
) values
  ('00000000-0000-0000-0000-0000000009a1', 'eco-1002', 'exam', 'ECO final', 'fall', 2026, '{}',
   '00000000-0000-0000-0000-000000000971/eco-1002/9a1/file.pdf',
   'file.pdf', 'application/pdf', 128,
   '00000000-0000-0000-0000-000000000971', '00000000-0000-0000-0000-0000000009a1', false),
  ('00000000-0000-0000-0000-0000000009b1', 'fin-3610', 'exam', 'FIN final', 'fall', 2026, '{}',
   '00000000-0000-0000-0000-000000000972/fin-3610/9b1/file.pdf',
   'file.pdf', 'application/pdf', 128,
   '00000000-0000-0000-0000-000000000972', '00000000-0000-0000-0000-0000000009b1', false);

insert into public.tutor_messages (user_id, course_slug, lesson_slug) values
  ('00000000-0000-0000-0000-000000000961', 'eco-1002', 'eco-1002/solow'),
  ('00000000-0000-0000-0000-000000000961', 'fin-3610', 'fin-3610/npv-decision-rule');
