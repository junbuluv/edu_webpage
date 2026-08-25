-- Security hardening for existing hosted projects.
--
-- This migration is deliberately additive: it preserves existing rows,
-- backfills course scope from known content identifiers, and replaces only
-- the audited RLS policies and client privileges.

-- A row-level policy cannot restrict individual columns. Revoke blanket
-- profile updates so a signed-in user cannot promote their own role.
revoke update on table public.profiles from anon, authenticated;
grant update (display_name, active_course_slug, tos_accepted_at)
  on table public.profiles to authenticated;

-- Progress and quiz records need an explicit course boundary for instructor
-- reads. Existing known identifiers are backfilled without altering scores
-- or completion state.
alter table public.lesson_progress add column if not exists course_slug text;
update public.lesson_progress
  set course_slug = split_part(lesson_slug, '/', 1)
  where course_slug is null
    and split_part(lesson_slug, '/', 1) in ('eco-1002', 'fin-3610');
do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.lesson_progress'::regclass
       and conname = 'lesson_progress_course_chk'
  ) then
    alter table public.lesson_progress
      add constraint lesson_progress_course_chk
      check (course_slug in ('eco-1002', 'fin-3610'));
  end if;
end $$;
create index if not exists lesson_progress_user_course_idx
  on public.lesson_progress (user_id, course_slug, updated_at desc);

alter table public.quiz_attempts add column if not exists course_slug text;
update public.quiz_attempts
  set course_slug = case
    when quiz_slug like 'eco-1002-%' then 'eco-1002'
    when quiz_slug like 'fin-3610-%' then 'fin-3610'
  end
  where course_slug is null;
do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.quiz_attempts'::regclass
       and conname = 'quiz_attempts_course_chk'
  ) then
    alter table public.quiz_attempts
      add constraint quiz_attempts_course_chk
      check (course_slug in ('eco-1002', 'fin-3610'));
  end if;
end $$;
create index if not exists quiz_attempts_user_course_idx
  on public.quiz_attempts (user_id, course_slug, submitted_at desc);

-- Students can read their own authoritative records, but only validated
-- server handlers using the service role may write them.
drop policy if exists "lesson_progress_self_all" on public.lesson_progress;
drop policy if exists "lesson_progress_self_read" on public.lesson_progress;
create policy "lesson_progress_self_read"
  on public.lesson_progress for select
  using (auth.uid() = user_id);
revoke insert, update, delete on table public.lesson_progress
  from anon, authenticated;

drop policy if exists "quiz_attempts_self_insert" on public.quiz_attempts;
revoke insert, update, delete on table public.quiz_attempts
  from anon, authenticated;

-- An instructor sees records only for a student enrolled with that instructor
-- in the matching course. TAs remain read-only and cannot use this boundary.
drop policy if exists "quiz_attempts_instructor_read" on public.quiz_attempts;
drop policy if exists "quiz_attempts_instructor_read_scoped" on public.quiz_attempts;
create policy "quiz_attempts_instructor_read_scoped"
  on public.quiz_attempts for select
  using (
    exists (
      select 1
        from public.enrollments e
        join public.profiles p on p.id = auth.uid()
       where e.user_id = quiz_attempts.user_id
         and e.instructor_id = auth.uid()
         and e.course_slug = quiz_attempts.course_slug
         and p.role in ('instructor', 'admin')
    )
  );

drop policy if exists "lesson_progress_instructor_read_scoped" on public.lesson_progress;
create policy "lesson_progress_instructor_read_scoped"
  on public.lesson_progress for select
  using (
    exists (
      select 1
        from public.enrollments e
        join public.profiles p on p.id = auth.uid()
       where e.user_id = lesson_progress.user_id
         and e.instructor_id = auth.uid()
         and e.course_slug = lesson_progress.course_slug
         and p.role in ('instructor', 'admin')
    )
  );

-- Audit writes are server-only; a browser client must not call the definer
-- function as a general-purpose insert channel.
revoke execute on function public.log_disclosure(text, uuid, text, jsonb)
  from authenticated;

-- Workshop windows are visible only to their instructor, enrolled students,
-- and administrators rather than every authenticated account.
drop policy if exists "workshop_admins_authenticated_read" on public.workshop_administrations;
drop policy if exists "workshop_admins_course_read" on public.workshop_administrations;
create policy "workshop_admins_course_read"
  on public.workshop_administrations for select
  to authenticated
  using (
    instructor_id = auth.uid()
    or exists (
      select 1
        from public.enrollments e
       where e.user_id = auth.uid()
         and e.course_slug = workshop_administrations.course_slug
    )
    or exists (
      select 1
        from public.profiles p
       where p.id = auth.uid()
         and p.role = 'admin'
    )
  );

drop policy if exists "workshop_attendance_instructor_read_scoped" on public.workshop_attendance;
create policy "workshop_attendance_instructor_read_scoped"
  on public.workshop_attendance for select
  using (
    exists (
      select 1
        from public.profiles p
       where p.id = auth.uid()
         and p.role = 'admin'
    )
    or exists (
      select 1
        from public.workshop_administrations a
        join public.enrollments e
          on e.user_id = workshop_attendance.user_id
         and e.course_slug = a.course_slug
         and e.instructor_id = auth.uid()
        join public.profiles p
          on p.id = auth.uid()
         and p.role = 'instructor'
       where a.id = workshop_attendance.administration_id
         and a.instructor_id = auth.uid()
    )
  );
