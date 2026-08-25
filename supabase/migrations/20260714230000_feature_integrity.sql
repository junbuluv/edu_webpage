-- Separate lifetime mastery from offering reporting, make progress writes
-- atomic and idempotent, and close the remaining consent/workshop/offboarding
-- integrity gaps. Safe to rerun.

alter table public.profiles add column if not exists tos_version text;
do $$ begin
  alter table public.profiles
    add constraint profiles_tos_version_check
    check (tos_version is null or char_length(tos_version) between 1 and 64)
    not valid;
exception when duplicate_object then null; end $$;

create table if not exists public.terms_acceptances (
  user_id uuid not null references public.profiles(id) on delete cascade,
  policy_version text not null,
  accepted_at timestamptz not null default now(),
  source text not null,
  primary key (user_id, policy_version),
  check (char_length(policy_version) between 1 and 64),
  check (char_length(source) between 1 and 64)
);
insert into public.terms_acceptances (
  user_id, policy_version, accepted_at, source
)
select id, 'legacy-unversioned', tos_accepted_at, 'legacy-profile'
  from public.profiles
 where tos_accepted_at is not null
on conflict (user_id, policy_version) do nothing;
update public.profiles
   set tos_version = 'legacy-unversioned'
 where tos_accepted_at is not null and tos_version is null;
alter table public.terms_acceptances enable row level security;
drop policy if exists "terms_acceptances_authenticated_read"
  on public.terms_acceptances;
create policy "terms_acceptances_authenticated_read"
  on public.terms_acceptances for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.profiles p
       where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );
revoke all privileges on table public.terms_acceptances
  from anon, authenticated, service_role;
grant select, insert on table public.terms_acceptances to service_role;
grant select on table public.terms_acceptances to authenticated;

create or replace function public.accept_terms(
  p_user_id uuid,
  p_policy_version text,
  p_source text
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_accepted_at timestamptz := pg_catalog.clock_timestamp();
begin
  if p_user_id is null
     or p_policy_version is null
     or p_source is null
     or char_length(p_policy_version) not between 1 and 64
     or char_length(p_source) not between 1 and 64 then
    raise exception 'invalid terms acceptance input' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('terms:' || p_user_id::text, 0)
  );
  if not exists (
    select 1 from public.profiles p where p.id = p_user_id
  ) then
    return 'missing_user';
  end if;
  insert into public.terms_acceptances (
    user_id, policy_version, accepted_at, source
  ) values (
    p_user_id, p_policy_version, v_accepted_at, p_source
  ) on conflict (user_id, policy_version) do nothing;
  select t.accepted_at into v_accepted_at
    from public.terms_acceptances t
   where t.user_id = p_user_id and t.policy_version = p_policy_version;
  update public.profiles
     set tos_accepted_at = greatest(
           coalesce(tos_accepted_at, '-infinity'::timestamptz),
           v_accepted_at
         ),
         tos_version = p_policy_version
   where id = p_user_id;
  return 'accepted';
end;
$$;
revoke all on function public.accept_terms(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.accept_terms(uuid, text, text)
  to service_role;

do $$ begin
  alter table public.enrollments
    add constraint enrollments_eco_section_required_check
    check (course_slug <> 'eco-1002' or section is not null) not valid;
exception when duplicate_object then null; end $$;

create table if not exists public.offering_lesson_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_slug text not null,
  semester text not null,
  instructor_id uuid not null references public.profiles(id) on delete restrict,
  lesson_slug text not null,
  status progress_status not null default 'started',
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, course_slug, semester, lesson_slug),
  check (course_slug in ('eco-1002', 'fin-3610')),
  check (char_length(semester) between 1 and 64),
  foreign key (instructor_id, course_slug, semester)
    references public.teaching_assignments (
      instructor_id, course_slug, semester
    ) on update restrict on delete restrict
);
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'lesson_progress'
       and column_name = 'semester'
  ) and exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'lesson_progress'
       and column_name = 'instructor_id'
  ) then
    execute $backfill$
      insert into public.offering_lesson_progress (
        user_id, course_slug, semester, instructor_id, lesson_slug,
        status, completed_at, updated_at
      )
      select
        user_id, course_slug, semester, instructor_id, lesson_slug,
        status, completed_at, updated_at
      from public.lesson_progress
      where course_slug is not null
        and semester is not null
        and instructor_id is not null
      on conflict (user_id, course_slug, semester, lesson_slug) do update
        set status = case
              when excluded.status = 'completed'::public.progress_status
                or public.offering_lesson_progress.status =
                  'completed'::public.progress_status
              then 'completed'::public.progress_status
              else 'started'::public.progress_status
            end,
            completed_at = coalesce(
              public.offering_lesson_progress.completed_at,
              excluded.completed_at
            ),
            updated_at = greatest(
              public.offering_lesson_progress.updated_at,
              excluded.updated_at
            )
    $backfill$;
  end if;
end $$;
drop policy if exists "lesson_progress_self_read" on public.lesson_progress;
drop policy if exists "lesson_progress_instructor_read_scoped"
  on public.lesson_progress;
drop policy if exists "lesson_progress_authenticated_read"
  on public.lesson_progress;
drop index if exists public.lesson_progress_offering_idx;
alter table public.lesson_progress
  drop constraint if exists lesson_progress_scope_chk,
  drop column if exists semester,
  drop column if exists instructor_id;
create index if not exists offering_lesson_progress_user_course_idx
  on public.offering_lesson_progress (
    user_id, course_slug, semester, updated_at desc
  );
create index if not exists offering_lesson_progress_instructor_idx
  on public.offering_lesson_progress (
    instructor_id, course_slug, semester, updated_at desc
  );
alter table public.offering_lesson_progress enable row level security;
drop policy if exists "offering_lesson_progress_authenticated_read"
  on public.offering_lesson_progress;
create policy "offering_lesson_progress_authenticated_read"
  on public.offering_lesson_progress for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1
        from public.enrollments e
        join public.teaching_assignments ta
          on ta.instructor_id = e.instructor_id
         and ta.course_slug = e.course_slug
         and ta.semester = e.semester
        join public.profiles p on p.id = ta.instructor_id
       where e.user_id = offering_lesson_progress.user_id
         and e.instructor_id = (select auth.uid())
         and e.instructor_id = offering_lesson_progress.instructor_id
         and e.course_slug = offering_lesson_progress.course_slug
         and e.semester = offering_lesson_progress.semester
         and ta.active
         and p.role = 'instructor'
    )
    or exists (
      select 1 from public.profiles p
       where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );
revoke all privileges on table public.offering_lesson_progress
  from anon, authenticated, service_role;
grant select, insert, update, delete
  on table public.offering_lesson_progress to service_role;
grant select on table public.offering_lesson_progress to authenticated;

create policy "lesson_progress_authenticated_read"
  on public.lesson_progress for select
  to authenticated
  using (
    (select auth.uid()) = lesson_progress.user_id
    or exists (
      select 1 from public.profiles p
       where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

alter table public.quiz_attempts
  add column if not exists client_attempt_id uuid;
update public.quiz_attempts set client_attempt_id = id
 where client_attempt_id is null;
alter table public.quiz_attempts
  alter column client_attempt_id set default gen_random_uuid(),
  alter column client_attempt_id set not null;
do $$ begin
  alter table public.quiz_attempts
    add constraint quiz_attempts_answers_size_chk
    check (octet_length(answers::text) <= 32768) not valid;
exception when duplicate_object then null; end $$;
create unique index if not exists quiz_attempts_user_client_attempt_uq
  on public.quiz_attempts (user_id, client_attempt_id);

create or replace function public.record_lesson_progress(
  p_user_id uuid,
  p_lesson_slug text,
  p_course_slug text,
  p_operation text
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_scope_count integer;
  v_semester text;
  v_instructor_id uuid;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_result_status public.progress_status;
begin
  if p_user_id is null
     or p_lesson_slug is null
     or p_course_slug is null
     or p_operation is null
     or p_course_slug not in ('eco-1002', 'fin-3610')
     or char_length(p_lesson_slug) not between 1 and 200
     or p_lesson_slug not like p_course_slug || '/%'
     or p_operation not in ('start', 'complete', 'reset') then
    raise exception 'invalid lesson progress input' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.profiles p where p.id = p_user_id
  ) then
    raise exception 'unknown progress user' using errcode = '23503';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'enrollment-scope:' || p_user_id::text || ':' || p_course_slug,
      0
    )
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'lesson-progress:' || p_user_id::text || ':' || p_lesson_slug,
      0
    )
  );
  select count(*), min(e.semester), min(e.instructor_id::text)::uuid
    into v_scope_count, v_semester, v_instructor_id
    from public.enrollments e
    join public.teaching_assignments ta
      on ta.instructor_id = e.instructor_id
     and ta.course_slug = e.course_slug
     and ta.semester = e.semester
     and ta.active
    join public.profiles p
      on p.id = e.instructor_id and p.role = 'instructor'
   where e.user_id = p_user_id and e.course_slug = p_course_slug;
  if v_scope_count > 1 then return 'ambiguous'; end if;

  if p_operation = 'start' then
    insert into public.lesson_progress (
      user_id, lesson_slug, course_slug, status, updated_at
    ) values (
      p_user_id, p_lesson_slug, p_course_slug,
      'started'::public.progress_status, v_now
    ) on conflict (user_id, lesson_slug) do nothing;
    if v_scope_count = 1 then
      insert into public.offering_lesson_progress (
        user_id, course_slug, semester, instructor_id, lesson_slug,
        status, updated_at
      ) values (
        p_user_id, p_course_slug, v_semester, v_instructor_id, p_lesson_slug,
        'started'::public.progress_status, v_now
      ) on conflict (
        user_id, course_slug, semester, lesson_slug
      ) do nothing;
    end if;
    select p.status into v_result_status
      from public.lesson_progress p
     where p.user_id = p_user_id and p.lesson_slug = p_lesson_slug;
    return v_result_status::text;
  end if;

  if p_operation = 'complete' then
    insert into public.lesson_progress (
      user_id, lesson_slug, course_slug, status, completed_at, updated_at
    ) values (
      p_user_id, p_lesson_slug, p_course_slug,
      'completed'::public.progress_status, v_now, v_now
    ) on conflict (user_id, lesson_slug) do update
      set course_slug = excluded.course_slug,
          status = 'completed'::public.progress_status,
          completed_at = coalesce(
            public.lesson_progress.completed_at, excluded.completed_at
          ),
          updated_at = excluded.updated_at;
    if v_scope_count = 1 then
      insert into public.offering_lesson_progress (
        user_id, course_slug, semester, instructor_id, lesson_slug,
        status, completed_at, updated_at
      ) values (
        p_user_id, p_course_slug, v_semester, v_instructor_id, p_lesson_slug,
        'completed'::public.progress_status, v_now, v_now
      ) on conflict (
        user_id, course_slug, semester, lesson_slug
      ) do update
        set instructor_id = excluded.instructor_id,
            status = 'completed'::public.progress_status,
            completed_at = coalesce(
              public.offering_lesson_progress.completed_at,
              excluded.completed_at
            ),
            updated_at = excluded.updated_at;
    end if;
    return 'completed';
  end if;

  insert into public.lesson_progress (
    user_id, lesson_slug, course_slug, status, completed_at, updated_at
  ) values (
    p_user_id, p_lesson_slug, p_course_slug,
    'started'::public.progress_status, null, v_now
  ) on conflict (user_id, lesson_slug) do update
    set course_slug = excluded.course_slug,
        status = 'started'::public.progress_status,
        completed_at = null,
        updated_at = excluded.updated_at;
  if v_scope_count = 1 then
    insert into public.offering_lesson_progress (
      user_id, course_slug, semester, instructor_id, lesson_slug,
      status, completed_at, updated_at
    ) values (
      p_user_id, p_course_slug, v_semester, v_instructor_id, p_lesson_slug,
      'started'::public.progress_status, null, v_now
    ) on conflict (
      user_id, course_slug, semester, lesson_slug
    ) do update
      set instructor_id = excluded.instructor_id,
          status = 'started'::public.progress_status,
          completed_at = null,
          updated_at = excluded.updated_at;
  end if;
  return 'reset';
end;
$$;
revoke all on function public.record_lesson_progress(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_lesson_progress(
  uuid, text, text, text
) to service_role;

create or replace function public.record_quiz_attempt(
  p_user_id uuid,
  p_quiz_slug text,
  p_course_slug text,
  p_score numeric,
  p_max_score numeric,
  p_answers jsonb,
  p_client_attempt_id uuid
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_scope_count integer;
  v_semester text;
  v_instructor_id uuid;
begin
  if p_user_id is null
     or p_quiz_slug is null
     or p_course_slug is null
     or p_score is null
     or p_max_score is null
     or p_answers is null
     or p_client_attempt_id is null
     or p_course_slug not in ('eco-1002', 'fin-3610')
     or char_length(p_quiz_slug) not between 1 and 200
     or p_max_score <= 0
     or p_score < 0
     or p_score > p_max_score
     or p_score = 'NaN'::numeric
     or p_max_score = 'NaN'::numeric
     or jsonb_typeof(p_answers) is distinct from 'object'
     or octet_length(p_answers::text) > 32768 then
    raise exception 'invalid quiz attempt input' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.profiles p where p.id = p_user_id
  ) then
    raise exception 'unknown quiz user' using errcode = '23503';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'quiz-attempt:' || p_user_id::text || ':' ||
      p_client_attempt_id::text, 0
    )
  );
  if exists (
    select 1 from public.quiz_attempts q
     where q.user_id = p_user_id
       and q.client_attempt_id = p_client_attempt_id
  ) then
    return 'duplicate';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'enrollment-scope:' || p_user_id::text || ':' || p_course_slug, 0
    )
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'quiz-rate:' || p_user_id::text || ':' || p_quiz_slug, 0
    )
  );
  select count(*), min(e.semester), min(e.instructor_id::text)::uuid
    into v_scope_count, v_semester, v_instructor_id
    from public.enrollments e
    join public.teaching_assignments ta
      on ta.instructor_id = e.instructor_id
     and ta.course_slug = e.course_slug
     and ta.semester = e.semester
     and ta.active
    join public.profiles p
      on p.id = e.instructor_id and p.role = 'instructor'
   where e.user_id = p_user_id and e.course_slug = p_course_slug;
  if v_scope_count > 1 then return 'ambiguous'; end if;
  if (
    select count(*) >= 20
      from public.quiz_attempts q
     where q.user_id = p_user_id
       and q.quiz_slug = p_quiz_slug
       and q.submitted_at >= pg_catalog.clock_timestamp() - interval '1 hour'
  ) then
    return 'rate_limited';
  end if;
  insert into public.quiz_attempts (
    client_attempt_id, user_id, quiz_slug, course_slug, semester,
    instructor_id, score, max_score, answers
  ) values (
    p_client_attempt_id, p_user_id, p_quiz_slug, p_course_slug,
    case when v_scope_count = 1 then v_semester end,
    case when v_scope_count = 1 then v_instructor_id end,
    p_score, p_max_score, p_answers
  );
  return 'recorded';
end;
$$;
revoke all on function public.record_quiz_attempt(
  uuid, text, text, numeric, numeric, jsonb, uuid
) from public, anon, authenticated;
grant execute on function public.record_quiz_attempt(
  uuid, text, text, numeric, numeric, jsonb, uuid
) to service_role;

create or replace function public.transfer_enrollment_scope(
  p_actor_id uuid,
  p_user_id uuid,
  p_course_slug text,
  p_semester text,
  p_current_instructor_id uuid,
  p_new_instructor_id uuid,
  p_student_name text,
  p_section text
)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  actor_role public.user_role;
  lock_instructor_id uuid;
  existing_enrolled_at timestamptz;
  changed_rows integer;
begin
  if p_actor_id is null
     or p_user_id is null
     or p_current_instructor_id is null
     or p_new_instructor_id is null
     or p_course_slug is null
     or p_semester is null
     or p_course_slug not in ('eco-1002', 'fin-3610')
     or char_length(p_semester) not between 1 and 64
     or (
       p_student_name is not null
       and char_length(p_student_name) not between 1 and 120
     )
     or (
       p_course_slug = 'eco-1002'
       and (
         p_section is null
         or not (p_section = any (array['CML', 'CTL', 'CWL', 'CRL']))
       )
     )
     or (p_course_slug = 'fin-3610' and p_section is not null) then
    raise exception 'invalid enrollment transfer input' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('instructor:' || p_actor_id::text, 0)
  );
  select p.role into actor_role from public.profiles p
   where p.id = p_actor_id;
  if actor_role is distinct from 'admin'::public.user_role then
    return false;
  end if;
  for lock_instructor_id in
    select distinct v.id
      from (values (p_current_instructor_id), (p_new_instructor_id)) v(id)
     order by v.id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'instructor:' || lock_instructor_id::text, 0
      )
    );
  end loop;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'assignment:' || p_new_instructor_id::text || ':' ||
      p_course_slug || ':' || p_semester, 0
    )
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'enrollment-scope:' || p_user_id::text || ':' || p_course_slug, 0
    )
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'enrollment:' || p_user_id::text || ':' ||
      p_course_slug || ':' || p_semester, 0
    )
  );
  if not exists (
    select 1
      from public.teaching_assignments ta
      join public.profiles p on p.id = ta.instructor_id
     where ta.instructor_id = p_new_instructor_id
       and ta.course_slug = p_course_slug
       and ta.semester = p_semester
       and ta.active
       and p.role = 'instructor'
  ) then
    return false;
  end if;
  delete from public.enrollments
   where user_id = p_user_id
     and course_slug = p_course_slug
     and semester = p_semester
     and instructor_id = p_current_instructor_id
  returning enrolled_at into existing_enrolled_at;
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then return false; end if;
  insert into public.enrollments (
    user_id, course_slug, instructor_id, semester, enrolled_at,
    student_name, section
  ) values (
    p_user_id, p_course_slug, p_new_instructor_id, p_semester,
    existing_enrolled_at, p_student_name, p_section
  );
  update public.offering_lesson_progress
     set instructor_id = p_new_instructor_id
   where user_id = p_user_id
     and course_slug = p_course_slug
     and semester = p_semester
     and instructor_id = p_current_instructor_id;
  update public.quiz_attempts
     set instructor_id = p_new_instructor_id
   where user_id = p_user_id
     and course_slug = p_course_slug
     and semester = p_semester
     and instructor_id = p_current_instructor_id;
  return true;
end;
$$;
revoke all on function public.transfer_enrollment_scope(
  uuid, uuid, text, text, uuid, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.transfer_enrollment_scope(
  uuid, uuid, text, text, uuid, uuid, text, text
) to service_role;

create or replace function public.lock_enrollment_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_course_slug text;
begin
  if tg_op = 'DELETE' then
    v_user_id := old.user_id;
    v_course_slug := old.course_slug;
  else
    v_user_id := new.user_id;
    v_course_slug := new.course_slug;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'enrollment-scope:' || v_user_id::text || ':' || v_course_slug,
      0
    )
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
revoke all on function public.lock_enrollment_scope()
  from public, anon, authenticated, service_role;
drop trigger if exists enrollments_scope_lock on public.enrollments;
create trigger enrollments_scope_lock
  before insert or update or delete on public.enrollments
  for each row execute function public.lock_enrollment_scope();

-- Keep all roster mutation paths on the same scope-before-row lock order as
-- transfers and the enrollment trigger so upgraded projects match fresh ones.
create or replace function public.apply_roster_import(
  p_actor_id uuid,
  p_instructor_id uuid,
  p_course_slug text,
  p_semester text,
  p_rows jsonb
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  actor_role public.user_role;
  lock_user_id uuid;
  changed_rows integer;
  expected_rows integer;
begin
  if p_actor_id is null
     or p_instructor_id is null
     or p_course_slug is null
     or p_semester is null
     or p_course_slug not in ('eco-1002', 'fin-3610')
     or char_length(p_semester) not between 1 and 64
     or jsonb_typeof(p_rows) is distinct from 'array'
     or jsonb_array_length(p_rows) not between 1 and 5000 then
    raise exception 'invalid roster import input' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('instructor:' || p_actor_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('instructor:' || p_instructor_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'assignment:' || p_instructor_id::text || ':' ||
      p_course_slug || ':' || p_semester,
      0
    )
  );

  select p.role into actor_role
    from public.profiles p
   where p.id = p_actor_id;
  if not coalesce(
    actor_role = 'admin'::public.user_role
      or (
        actor_role = 'instructor'::public.user_role
        and p_actor_id = p_instructor_id
      ),
    false
  ) then
    return false;
  end if;
  if not exists (
    select 1
      from public.teaching_assignments ta
      join public.profiles p on p.id = ta.instructor_id
     where ta.instructor_id = p_instructor_id
       and ta.course_slug = p_course_slug
       and ta.semester = p_semester
       and ta.active
       and p.role = 'instructor'
  ) then
    return false;
  end if;

  if exists (
    select 1
      from jsonb_to_recordset(p_rows) as r(
        user_id uuid,
        student_name text,
        section text,
        expected_existing boolean
      )
     where r.user_id is null
        or r.expected_existing is null
        or (
          r.student_name is not null
          and char_length(r.student_name) not between 1 and 120
        )
        or (
          p_course_slug = 'eco-1002'
          and (
            r.section is null
            or not (r.section = any (array['CML', 'CTL', 'CWL', 'CRL']))
          )
        )
        or (p_course_slug = 'fin-3610' and r.section is not null)
  ) then
    raise exception 'invalid roster row' using errcode = '22023';
  end if;
  if (
    select count(*) <> count(distinct r.user_id)
      from jsonb_to_recordset(p_rows) as r(user_id uuid)
  ) then
    raise exception 'duplicate roster user' using errcode = '22023';
  end if;

  for lock_user_id in
    select r.user_id
      from jsonb_to_recordset(p_rows) as r(user_id uuid)
     order by r.user_id::text
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'enrollment-scope:' || lock_user_id::text || ':' || p_course_slug,
        0
      )
    );
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'enrollment:' || lock_user_id::text || ':' ||
        p_course_slug || ':' || p_semester,
        0
      )
    );
  end loop;

  if exists (
    select 1
      from jsonb_to_recordset(p_rows) as r(
        user_id uuid,
        expected_existing boolean
      )
      left join public.enrollments e
        on e.user_id = r.user_id
       and e.course_slug = p_course_slug
       and e.semester = p_semester
     where (
       r.expected_existing
       and (e.user_id is null or e.instructor_id <> p_instructor_id)
     ) or (
       not r.expected_existing and e.user_id is not null
     )
  ) then
    return false;
  end if;

  with input_rows as (
    select *
      from jsonb_to_recordset(p_rows) as r(
        user_id uuid,
        student_name text,
        section text,
        expected_existing boolean
      )
  )
  update public.enrollments e
     set student_name = r.student_name,
         section = r.section
    from input_rows r
   where r.expected_existing
     and e.user_id = r.user_id
     and e.course_slug = p_course_slug
     and e.semester = p_semester
     and e.instructor_id = p_instructor_id;
  get diagnostics changed_rows = row_count;
  select count(*) into expected_rows
    from jsonb_to_recordset(p_rows) as r(expected_existing boolean)
   where r.expected_existing;
  if changed_rows <> expected_rows then
    raise exception 'roster changed during import' using errcode = '40001';
  end if;

  insert into public.enrollments (
    user_id,
    course_slug,
    instructor_id,
    semester,
    student_name,
    section
  )
  select
    r.user_id,
    p_course_slug,
    p_instructor_id,
    p_semester,
    r.student_name,
    r.section
  from jsonb_to_recordset(p_rows) as r(
    user_id uuid,
    student_name text,
    section text,
    expected_existing boolean
  )
  where not r.expected_existing;

  return true;
end;
$$;
revoke all on function public.apply_roster_import(
  uuid, uuid, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.apply_roster_import(
  uuid, uuid, text, text, jsonb
) to service_role;

create or replace function public.mutate_enrollment(
  p_actor_id uuid,
  p_user_id uuid,
  p_course_slug text,
  p_semester text,
  p_instructor_id uuid,
  p_student_name text,
  p_section text,
  p_operation text
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  actor_role public.user_role;
  changed_rows integer;
begin
  if p_actor_id is null
     or p_user_id is null
     or p_instructor_id is null
     or p_course_slug is null
     or p_semester is null
     or p_operation is null
     or p_course_slug not in ('eco-1002', 'fin-3610')
     or char_length(p_semester) not between 1 and 64
     or p_operation not in ('insert', 'update', 'delete') then
    raise exception 'invalid enrollment mutation input' using errcode = '22023';
  end if;
  if p_operation in ('insert', 'update') and (
    (p_student_name is not null and char_length(p_student_name) not between 1 and 120)
    or (
      p_course_slug = 'eco-1002'
      and (
        p_section is null
        or not (p_section = any (array['CML', 'CTL', 'CWL', 'CRL']))
      )
    )
    or (p_course_slug = 'fin-3610' and p_section is not null)
  ) then
    raise exception 'invalid enrollment update' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('instructor:' || p_actor_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('instructor:' || p_instructor_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'assignment:' || p_instructor_id::text || ':' ||
      p_course_slug || ':' || p_semester,
      0
    )
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'enrollment-scope:' || p_user_id::text || ':' || p_course_slug,
      0
    )
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'enrollment:' || p_user_id::text || ':' ||
      p_course_slug || ':' || p_semester,
      0
    )
  );

  select p.role into actor_role
    from public.profiles p
   where p.id = p_actor_id;
  if not coalesce(
    actor_role = 'admin'::public.user_role
      or (
        actor_role = 'instructor'::public.user_role
        and p_actor_id = p_instructor_id
        and exists (
          select 1 from public.teaching_assignments ta
           where ta.instructor_id = p_actor_id
             and ta.course_slug = p_course_slug
             and ta.semester = p_semester
             and ta.active
        )
      ),
    false
  ) then
    return false;
  end if;
  if p_operation = 'insert' and not exists (
    select 1
      from public.teaching_assignments ta
      join public.profiles p on p.id = ta.instructor_id
     where ta.instructor_id = p_instructor_id
       and ta.course_slug = p_course_slug
       and ta.semester = p_semester
       and ta.active
       and p.role = 'instructor'
  ) then
    return false;
  end if;

  if p_operation = 'insert' then
    insert into public.enrollments (
      user_id,
      course_slug,
      instructor_id,
      semester,
      student_name,
      section
    ) values (
      p_user_id,
      p_course_slug,
      p_instructor_id,
      p_semester,
      p_student_name,
      p_section
    );
  elsif p_operation = 'update' then
    update public.enrollments
       set student_name = p_student_name,
           section = p_section
     where user_id = p_user_id
       and course_slug = p_course_slug
       and semester = p_semester
       and instructor_id = p_instructor_id;
  else
    delete from public.enrollments
     where user_id = p_user_id
       and course_slug = p_course_slug
       and semester = p_semester
       and instructor_id = p_instructor_id;
  end if;
  get diagnostics changed_rows = row_count;
  return changed_rows = 1;
end;
$$;
revoke all on function public.mutate_enrollment(
  uuid, uuid, text, text, uuid, text, text, text
) from public, anon, authenticated;
grant execute on function public.mutate_enrollment(
  uuid, uuid, text, text, uuid, text, text, text
) to service_role;

create or replace function public.purge_inactive_accounts(
  p_months integer default 24
)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_count integer;
  v_candidate_count integer;
  v_cutoff timestamptz := now() - (p_months || ' months')::interval;
begin
  select count(*) into v_candidate_count
    from auth.users u
    join public.profiles p on p.id = u.id and p.role = 'student'
   where coalesce(u.last_sign_in_at, u.created_at) < v_cutoff;
  with deleted as (
    delete from auth.users u
     where coalesce(u.last_sign_in_at, u.created_at) < v_cutoff
       and exists (
         select 1 from public.profiles profile
          where profile.id = u.id and profile.role = 'student'
       )
       and not exists (
         select 1 from public.enrollments e where e.instructor_id = u.id
       )
       and not exists (
         select 1 from public.teaching_assignments ta
          where ta.instructor_id = u.id
       )
       and not exists (
         select 1 from public.workshop_administrations w
          where w.instructor_id = u.id
       )
       and not exists (
         select 1 from public.archive_videos v where v.created_by = u.id
       )
       and not exists (
         select 1 from public.archive_papers p where p.created_by = u.id
       )
       and not exists (
         select 1 from public.archive_paper_upload_intents i
          where i.actor_id = u.id
       )
       and not exists (
         select 1 from public.archive_quizzes q where q.created_by = u.id
       )
    returning u.id
  )
  select count(*) into v_count from deleted;
  insert into public.audit_log (
    actor_id, actor_role, action, target_resource, metadata
  ) values (
    null, null, 'system_retention_purge_inactive', 'auth.users',
    jsonb_build_object(
      'cutoff_months', p_months,
      'count', v_count,
      'skipped_owned_records', v_candidate_count - v_count
    )
  );
  return v_count;
end;
$$;
revoke all on function public.purge_inactive_accounts(integer)
  from public, anon, authenticated;

alter table public.archive_videos alter column published set default false;
alter table public.archive_paper_upload_intents
  alter column published set default false;
alter table public.archive_papers alter column published set default false;
alter table public.archive_quizzes alter column published set default false;
update public.archive_paper_upload_intents
   set published = false
 where state <> 'finalized' and published;
do $$ begin
  alter table public.archive_paper_upload_intents
    add constraint archive_paper_upload_intents_published_state_check
    check (not published or state = 'finalized');
exception when duplicate_object then null; end $$;
alter table public.archive_paper_upload_intents
  validate constraint archive_paper_upload_intents_published_state_check;

create or replace function public.reserve_archive_paper_upload_intent(
  p_id uuid,
  p_actor_id uuid,
  p_course_slug text,
  p_kind text,
  p_title text,
  p_semester_term text,
  p_semester_year integer,
  p_covers text[],
  p_storage_path text,
  p_original_filename text,
  p_content_type text,
  p_file_size bigint,
  p_expires_at timestamptz
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_actor_role public.user_role;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('instructor:' || p_actor_id::text, 0)
  );
  select p.role into v_actor_role
    from public.profiles p
   where p.id = p_actor_id;
  if not coalesce(
    v_actor_role = 'admin'::public.user_role
      or (
        v_actor_role = 'instructor'::public.user_role
        and exists (
          select 1 from public.teaching_assignments ta
           where ta.instructor_id = p_actor_id
             and ta.course_slug = p_course_slug
             and ta.active
        )
      ),
    false
  ) then
    raise exception 'archive upload requires active course authority'
      using errcode = '42501';
  end if;
  if (
    select count(*) >= 3
      from public.archive_paper_upload_intents
     where actor_id = p_actor_id
       and state = 'pending'
       and expires_at > now()
  ) then
    return false;
  end if;
  insert into public.archive_paper_upload_intents (
    id, actor_id, course_slug, kind, title, semester_term, semester_year,
    covers, storage_path, original_filename, content_type, file_size,
    published, state, expires_at
  ) values (
    p_id, p_actor_id, p_course_slug, p_kind, p_title, p_semester_term,
    p_semester_year, p_covers, p_storage_path, p_original_filename,
    p_content_type, p_file_size, false, 'pending', p_expires_at
  );
  return true;
end;
$$;
revoke all on function public.reserve_archive_paper_upload_intent(
  uuid, uuid, text, text, text, text, integer, text[], text, text, text,
  bigint, timestamptz
) from public, anon, authenticated;
grant execute on function public.reserve_archive_paper_upload_intent(
  uuid, uuid, text, text, text, text, integer, text[], text, text, text,
  bigint, timestamptz
) to service_role;

create or replace function public.reject_immutable_scope_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_target uuid;
  v_successor uuid;
begin
  if current_setting('app.offboard_scope_transfer', true) = 'on' then
    v_target := nullif(
      current_setting('app.offboard_target_id', true), ''
    )::uuid;
    v_successor := nullif(
      current_setting('app.offboard_successor_id', true), ''
    )::uuid;
    if tg_table_name = 'enrollments' then
      if old.user_id = new.user_id
         and old.course_slug = new.course_slug
         and old.semester = new.semester
         and old.instructor_id = v_target
         and new.instructor_id = v_successor then
        return new;
      end if;
    elsif tg_table_name = 'workshop_administrations' then
      if old.workshop_slug = new.workshop_slug
         and old.course_slug = new.course_slug
         and old.semester = new.semester
         and old.section is not distinct from new.section
         and old.week_of = new.week_of
         and old.instructor_id = v_target
         and new.instructor_id = v_successor then
        return new;
      end if;
    elsif tg_table_name in (
      'archive_videos', 'archive_papers', 'archive_quizzes'
    ) then
      if old.course_slug = new.course_slug
         and old.created_by = v_target
         and new.created_by = v_successor then
        return new;
      end if;
    end if;
  end if;
  raise exception '% identity or authorization scope is immutable', tg_table_name
    using errcode = '23514';
end;
$$;
revoke all on function public.reject_immutable_scope_update()
  from public, anon, authenticated, service_role;

create or replace function public.guard_workshop_attendee_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
     where p.id = new.user_id and p.role = 'student'
  ) then
    raise exception 'workshop attendance requires a student profile'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_workshop_attendee_role()
  from public, anon, authenticated, service_role;
drop trigger if exists workshop_attendance_student_check
  on public.workshop_attendance;
create trigger workshop_attendance_student_check
  before insert on public.workshop_attendance
  for each row execute function public.guard_workshop_attendee_role();

create or replace function public.mutate_workshop(
  p_actor_id uuid,
  p_administration_id uuid,
  p_operation text,
  p_target_user_id uuid default null,
  p_reason text default null
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  actor_role public.user_role;
  administration public.workshop_administrations%rowtype;
  changed_rows integer;
begin
  if p_actor_id is null
     or p_administration_id is null
     or p_operation is null
     or p_operation not in (
       'cancel', 'close', 'reveal', 'manual_add', 'manual_remove'
     ) then
    raise exception 'invalid workshop mutation input' using errcode = '22023';
  end if;
  if p_operation in ('manual_add', 'manual_remove') and (
    p_target_user_id is null
    or p_reason is null
    or char_length(p_reason) not between 1 and 200
  ) then
    raise exception 'invalid manual attendance input' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('instructor:' || p_actor_id::text, 0)
  );
  select p.role into actor_role from public.profiles p
   where p.id = p_actor_id;
  select a.* into administration
    from public.workshop_administrations a
   where a.id = p_administration_id
   for update;
  if not found then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'assignment:' || administration.instructor_id::text || ':' ||
      administration.course_slug || ':' || administration.semester, 0
    )
  );
  if not coalesce(
    actor_role = 'admin'::public.user_role
      or (
        actor_role = 'instructor'::public.user_role
        and administration.instructor_id = p_actor_id
        and exists (
          select 1 from public.teaching_assignments ta
           where ta.instructor_id = p_actor_id
             and ta.course_slug = administration.course_slug
             and ta.semester = administration.semester
             and ta.active
        )
      ), false
  ) then
    return false;
  end if;
  if p_operation = 'cancel' then
    if administration.cancelled_at is not null
       or pg_catalog.clock_timestamp() >= administration.opens_at then
      return false;
    end if;
    update public.workshop_administrations
       set cancelled_at = pg_catalog.clock_timestamp()
     where id = p_administration_id and cancelled_at is null;
    return found;
  elsif p_operation = 'close' then
    if administration.cancelled_at is not null
       or pg_catalog.clock_timestamp() < administration.opens_at
       or pg_catalog.clock_timestamp() >= administration.closes_at then
      return false;
    end if;
    update public.workshop_administrations
       set closes_at = greatest(
         pg_catalog.clock_timestamp(),
         administration.opens_at + interval '1 microsecond'
       )
     where id = p_administration_id;
    return found;
  elsif p_operation = 'reveal' then
    if administration.cancelled_at is not null
       or pg_catalog.clock_timestamp() < administration.opens_at then
      return false;
    end if;
    update public.workshop_administrations
       set questions_revealed_at = coalesce(
         questions_revealed_at, pg_catalog.clock_timestamp()
       )
     where id = p_administration_id;
    return found;
  end if;
  if administration.cancelled_at is not null
     or pg_catalog.clock_timestamp() < administration.opens_at then
    return false;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'enrollment:' || p_target_user_id::text || ':' ||
      administration.course_slug || ':' || administration.semester, 0
    )
  );
  if p_operation = 'manual_add' then
    if not exists (
      select 1
        from public.enrollments e
        join public.profiles p
          on p.id = e.user_id and p.role = 'student'
       where e.user_id = p_target_user_id
         and e.course_slug = administration.course_slug
         and e.semester = administration.semester
         and e.instructor_id = administration.instructor_id
         and e.section is not distinct from administration.section::text
    ) then
      return false;
    end if;
    insert into public.workshop_attendance (
      administration_id, user_id, verification_method, recorded_by,
      correction_reason
    ) values (
      p_administration_id, p_target_user_id, 'manual', p_actor_id, p_reason
    );
    return true;
  end if;
  delete from public.workshop_attendance
   where administration_id = p_administration_id
     and user_id = p_target_user_id
     and verification_method = 'manual';
  get diagnostics changed_rows = row_count;
  return changed_rows = 1;
end;
$$;
revoke all on function public.mutate_workshop(
  uuid, uuid, text, uuid, text
) from public, anon, authenticated;
grant execute on function public.mutate_workshop(
  uuid, uuid, text, uuid, text
) to service_role;

create or replace function public.record_workshop_stamp(
  p_user_id uuid,
  p_administration_id uuid,
  p_device_hmac text,
  p_verification_method text
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  administration public.workshop_administrations%rowtype;
begin
  if p_user_id is null
     or p_administration_id is null
     or p_device_hmac is null
     or p_verification_method is null
     or p_device_hmac !~ '^[0-9a-f]{64}$'
     or p_verification_method not in ('geofence', 'window') then
    raise exception 'invalid workshop stamp input' using errcode = '22023';
  end if;
  select a.* into administration
    from public.workshop_administrations a
   where a.id = p_administration_id
   for update;
  if not found
     or administration.cancelled_at is not null
     or pg_catalog.clock_timestamp() < administration.opens_at
     or pg_catalog.clock_timestamp() > administration.closes_at
     or (
       administration.geofence_required
       and p_verification_method <> 'geofence'
     )
     or (
       not administration.geofence_required
       and p_verification_method <> 'window'
     ) then
    return false;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'enrollment:' || p_user_id::text || ':' ||
      administration.course_slug || ':' || administration.semester, 0
    )
  );
  if not exists (
    select 1
      from public.enrollments e
      join public.profiles p
        on p.id = e.user_id and p.role = 'student'
     where e.user_id = p_user_id
       and e.course_slug = administration.course_slug
       and e.semester = administration.semester
       and e.instructor_id = administration.instructor_id
       and e.section is not distinct from administration.section::text
  ) then
    return false;
  end if;
  insert into public.workshop_attendance (
    administration_id, user_id, device_hmac, verification_method
  ) values (
    p_administration_id, p_user_id, p_device_hmac, p_verification_method
  );
  return true;
end;
$$;
revoke all on function public.record_workshop_stamp(
  uuid, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.record_workshop_stamp(
  uuid, uuid, text, text
) to service_role;

create or replace function public.offboard_staff(
  p_actor_id uuid,
  p_target_id uuid,
  p_successor_id uuid
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_actor_role public.user_role;
  v_target_role public.user_role;
  v_successor_role public.user_role;
  v_lock_id uuid;
  v_scope record;
begin
  if p_actor_id is null
     or p_target_id is null
     or p_successor_id is null
     or p_actor_id = p_target_id
     or p_target_id = p_successor_id then
    raise exception 'invalid staff offboarding input' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('instructor:' || p_actor_id::text, 0)
  );
  for v_lock_id in
    select distinct v.id
      from (values (p_target_id), (p_successor_id)) v(id)
     order by v.id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('instructor:' || v_lock_id::text, 0)
    );
  end loop;
  select p.role into v_actor_role from public.profiles p
   where p.id = p_actor_id for update;
  select p.role into v_target_role from public.profiles p
   where p.id = p_target_id for update;
  select p.role into v_successor_role from public.profiles p
   where p.id = p_successor_id for update;
  if v_actor_role is distinct from 'admin'::public.user_role then
    return 'forbidden';
  end if;
  if v_successor_role is distinct from 'instructor'::public.user_role then
    return 'invalid_roles';
  end if;
  if v_target_role = 'student'::public.user_role then
    if exists (
      select 1 from public.audit_log a
       where a.action = 'admin_offboard_staff'
         and a.target_user_id = p_target_id
         and a.metadata->>'successor_id' = p_successor_id::text
    ) then
      return 'already_offboarded';
    end if;
    return 'invalid_roles';
  end if;
  if v_target_role is null or v_target_role not in (
    'instructor'::public.user_role, 'ta'::public.user_role
  ) then
    return 'invalid_roles';
  end if;
  if exists (
    select 1
      from public.workshop_administrations old_w
      join public.workshop_administrations new_w
        on new_w.instructor_id = p_successor_id
       and new_w.workshop_slug = old_w.workshop_slug
       and new_w.semester = old_w.semester
       and new_w.section is not distinct from old_w.section
       and new_w.week_of = old_w.week_of
       and new_w.cancelled_at is null
     where old_w.instructor_id = p_target_id
       and old_w.cancelled_at is null
  ) then
    return 'conflict';
  end if;
  for v_scope in
    select ta.course_slug, ta.semester
      from public.teaching_assignments ta
     where ta.instructor_id = p_target_id
     order by ta.course_slug, ta.semester
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'assignment:' || p_target_id::text || ':' ||
        v_scope.course_slug || ':' || v_scope.semester, 0
      )
    );
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'assignment:' || p_successor_id::text || ':' ||
        v_scope.course_slug || ':' || v_scope.semester, 0
      )
    );
  end loop;
  for v_scope in
    select distinct e.user_id, e.course_slug
      from public.enrollments e
     where e.instructor_id = p_target_id
     order by e.user_id, e.course_slug
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'enrollment-scope:' || v_scope.user_id::text || ':' ||
        v_scope.course_slug, 0
      )
    );
  end loop;
  insert into public.teaching_assignments (
    instructor_id, course_slug, semester, active, assigned_by,
    assigned_at, updated_at
  )
  select
    p_successor_id, ta.course_slug, ta.semester, ta.active, p_actor_id,
    pg_catalog.clock_timestamp(), pg_catalog.clock_timestamp()
    from public.teaching_assignments ta
   where ta.instructor_id = p_target_id
  on conflict (instructor_id, course_slug, semester) do update
    set active = public.teaching_assignments.active or excluded.active,
        assigned_by = p_actor_id,
        updated_at = pg_catalog.clock_timestamp();
  perform pg_catalog.set_config('app.offboard_scope_transfer', 'on', true);
  perform pg_catalog.set_config(
    'app.offboard_target_id', p_target_id::text, true
  );
  perform pg_catalog.set_config(
    'app.offboard_successor_id', p_successor_id::text, true
  );
  update public.offering_lesson_progress
     set instructor_id = p_successor_id
   where instructor_id = p_target_id;
  update public.quiz_attempts
     set instructor_id = p_successor_id
   where instructor_id = p_target_id;
  update public.enrollments
     set instructor_id = p_successor_id
   where instructor_id = p_target_id;
  update public.workshop_administrations
     set instructor_id = p_successor_id
   where instructor_id = p_target_id;
  update public.archive_videos
     set created_by = p_successor_id,
         updated_at = pg_catalog.clock_timestamp()
   where created_by = p_target_id;
  update public.archive_papers
     set created_by = p_successor_id,
         updated_at = pg_catalog.clock_timestamp()
   where created_by = p_target_id;
  update public.archive_quizzes
     set created_by = p_successor_id,
         updated_at = pg_catalog.clock_timestamp()
   where created_by = p_target_id;
  update public.archive_paper_upload_intents
     set actor_id = p_successor_id
   where actor_id = p_target_id and state = 'finalized';
  update public.teaching_assignments
     set active = false,
         assigned_by = p_actor_id,
         updated_at = pg_catalog.clock_timestamp()
   where instructor_id = p_target_id and active;
  delete from public.teaching_assignments
   where instructor_id = p_target_id;
  update public.profiles
     set role = 'student'::public.user_role
   where id = p_target_id;
  perform pg_catalog.set_config('app.offboard_scope_transfer', 'off', true);
  perform pg_catalog.set_config('app.offboard_target_id', '', true);
  perform pg_catalog.set_config('app.offboard_successor_id', '', true);
  insert into public.audit_log (
    actor_id, actor_role, action, target_user_id, target_resource, metadata
  ) values (
    p_actor_id, v_actor_role, 'admin_offboard_staff', p_target_id,
    'public.profiles', jsonb_build_object('successor_id', p_successor_id)
  );
  return 'offboarded';
end;
$$;
revoke all on function public.offboard_staff(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.offboard_staff(uuid, uuid, uuid)
  to service_role;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
create or replace function private.instructor_can_read_workshop_attendance(
  p_administration_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.workshop_administrations a
      join public.enrollments e
        on e.user_id = p_user_id
       and e.course_slug = a.course_slug
       and e.semester = a.semester
      join public.teaching_assignments ta
        on ta.instructor_id = e.instructor_id
       and ta.course_slug = e.course_slug
       and ta.semester = e.semester
       and ta.active
      join public.profiles p
        on p.id = (select auth.uid())
       and p.role = 'instructor'
     where a.id = p_administration_id
       and a.instructor_id = (select auth.uid())
       and e.instructor_id = (select auth.uid())
  )
$$;
revoke all on function private.instructor_can_read_workshop_attendance(uuid, uuid)
  from public, anon, service_role;
grant execute on function private.instructor_can_read_workshop_attendance(uuid, uuid)
  to authenticated;
drop policy if exists "workshop_attendance_authenticated_read"
  on public.workshop_attendance;
drop function if exists public.instructor_can_read_workshop_attendance(uuid, uuid);
create policy "workshop_attendance_authenticated_read"
  on public.workshop_attendance for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.profiles p
       where p.id = (select auth.uid()) and p.role = 'admin'
    )
    or (select private.instructor_can_read_workshop_attendance(
      workshop_attendance.administration_id,
      workshop_attendance.user_id
    ))
  );

revoke update on table public.profiles from authenticated;
revoke update (tos_accepted_at) on table public.profiles from authenticated;
grant update (display_name, active_course_slug)
  on table public.profiles to authenticated;
revoke select on table public.profiles from authenticated;
grant select (
  id, display_name, role, tos_accepted_at, tos_version, created_at,
  active_course_slug
) on public.profiles to authenticated;

-- Final lifecycle hardening: assignment deletion participates in the same
-- locks as authorization checks, role demotion cannot strand staff-owned
-- rows, and upload cleanup/finalization serialize on the intent row.
create or replace function public.guard_teaching_assignment_state()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_instructor_id uuid;
  v_course_slug text;
  v_semester text;
begin
  v_instructor_id := case when tg_op = 'DELETE'
    then old.instructor_id else new.instructor_id end;
  v_course_slug := case when tg_op = 'DELETE'
    then old.course_slug else new.course_slug end;
  v_semester := case when tg_op = 'DELETE'
    then old.semester else new.semester end;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('instructor:' || v_instructor_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'assignment:' || v_instructor_id::text || ':' ||
      v_course_slug || ':' || v_semester, 0
    )
  );
  if tg_op = 'DELETE' then
    if old.active then
      raise exception 'deactivate teaching assignments before deleting them'
        using errcode = '23514';
    end if;
    return old;
  end if;
  if new.active and not exists (
    select 1 from public.profiles p
     where p.id = new.instructor_id and p.role = 'instructor'
  ) then
    raise exception 'teaching assignments require an instructor profile'
      using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and old.active and not new.active and exists (
    select 1 from public.workshop_administrations w
     where w.instructor_id = old.instructor_id
       and w.course_slug = old.course_slug
       and w.semester = old.semester
       and w.cancelled_at is null
       and w.closes_at >= pg_catalog.clock_timestamp()
  ) then
    raise exception 'close or cancel live and future workshops before deactivation'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_teaching_assignment_state()
  from public, anon, authenticated, service_role;
drop trigger if exists teaching_assignments_state_delete
  on public.teaching_assignments;
create trigger teaching_assignments_state_delete
  before delete on public.teaching_assignments
  for each row execute function public.guard_teaching_assignment_state();

create or replace function public.guard_instructor_role_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_offboard_transfer boolean := false;
begin
  if old.role is distinct from new.role then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('instructor:' || new.id::text, 0)
    );
  end if;
  if old.role in ('instructor', 'ta') and new.role = 'student' then
    v_offboard_transfer :=
      current_setting('app.offboard_scope_transfer', true) = 'on'
      and nullif(
        current_setting('app.offboard_target_id', true), ''
      )::uuid = new.id;
    if exists (
      select 1 from public.teaching_assignments ta
       where ta.instructor_id = new.id
    ) or exists (
      select 1 from public.enrollments e where e.instructor_id = new.id
    ) or exists (
      select 1 from public.offering_lesson_progress p
       where p.instructor_id = new.id
    ) or exists (
      select 1 from public.quiz_attempts q where q.instructor_id = new.id
    ) or exists (
      select 1 from public.workshop_administrations w
       where w.instructor_id = new.id
    ) or exists (
      select 1 from public.archive_videos v where v.created_by = new.id
    ) or exists (
      select 1 from public.archive_papers p where p.created_by = new.id
    ) or exists (
      select 1 from public.archive_quizzes q where q.created_by = new.id
    ) or exists (
      select 1 from public.archive_paper_upload_intents i
       where i.actor_id = new.id
         and (not v_offboard_transfer or i.state = 'finalized')
    ) then
      raise exception 'offboard staff before changing their role to student'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_instructor_role_change()
  from public, anon, authenticated, service_role;

create or replace function public.guard_archive_paper_upload_link()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_intent public.archive_paper_upload_intents%rowtype;
begin
  if new.upload_intent_id is null then return new; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('instructor:' || new.created_by::text, 0)
  );
  if not exists (
    select 1 from public.profiles p
     where p.id = new.created_by
       and (
         p.role = 'admin'
         or (
           p.role = 'instructor'
           and exists (
             select 1 from public.teaching_assignments ta
              where ta.instructor_id = new.created_by
                and ta.course_slug = new.course_slug
                and ta.active
           )
         )
       )
  ) then
    raise exception 'paper finalization requires active course authority'
      using errcode = '23514';
  end if;
  select i.* into v_intent
    from public.archive_paper_upload_intents i
   where i.id = new.upload_intent_id
   for update;
  if not found
     or v_intent.actor_id <> new.created_by
     or v_intent.course_slug <> new.course_slug
     or v_intent.kind <> new.kind
     or v_intent.title <> new.title
     or v_intent.semester_term <> new.semester_term
     or v_intent.semester_year <> new.semester_year
     or v_intent.covers is distinct from new.covers
     or v_intent.storage_path <> new.storage_path
     or v_intent.original_filename <> new.original_filename
     or v_intent.content_type <> new.content_type
     or v_intent.file_size <> new.size_bytes
     or v_intent.published <> new.published
     or v_intent.state <> 'pending'
     or v_intent.expires_at <= pg_catalog.clock_timestamp() then
    raise exception 'paper upload intent is missing, expired, or mismatched'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_archive_paper_upload_link()
  from public, anon, authenticated, service_role;

create or replace function public.finalize_archive_paper_upload_link()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.upload_intent_id is not null then
    update public.archive_paper_upload_intents
       set state = 'finalized', finalized_at = pg_catalog.clock_timestamp()
     where id = new.upload_intent_id and state = 'pending';
    if not found then
      raise exception 'paper upload intent could not be finalized'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.finalize_archive_paper_upload_link()
  from public, anon, authenticated, service_role;
drop trigger if exists archive_papers_upload_link_guard
  on public.archive_papers;
create trigger archive_papers_upload_link_guard
  before insert on public.archive_papers
  for each row execute function public.guard_archive_paper_upload_link();
drop trigger if exists archive_papers_upload_link_finalize
  on public.archive_papers;
create trigger archive_papers_upload_link_finalize
  after insert on public.archive_papers
  for each row execute function public.finalize_archive_paper_upload_link();

create or replace function public.claim_archive_paper_upload_intents(
  p_actor_id uuid,
  p_before timestamptz,
  p_limit integer default 100
)
returns table(intent_id uuid, storage_path text, action text)
language plpgsql
set search_path = ''
as $$
declare
  v_intent record;
begin
  if p_before is null or p_limit not between 1 and 1000 then
    raise exception 'invalid upload cleanup claim input'
      using errcode = '22023';
  end if;
  for v_intent in
    select i.id, i.storage_path
      from public.archive_paper_upload_intents i
     where i.state in ('pending', 'expired')
       and (
         (p_actor_id is not null and i.actor_id = p_actor_id)
         or (p_actor_id is null and i.expires_at < p_before)
       )
     order by i.expires_at, i.id
     for update skip locked
     limit p_limit
  loop
    intent_id := v_intent.id;
    storage_path := v_intent.storage_path;
    if exists (
      select 1 from public.archive_papers p
       where p.upload_intent_id = v_intent.id
    ) then
      update public.archive_paper_upload_intents
         set state = 'finalized',
             finalized_at = coalesce(
               finalized_at, pg_catalog.clock_timestamp()
             )
       where id = v_intent.id;
      action := 'repair';
    else
      update public.archive_paper_upload_intents
         set state = 'expired', finalized_at = null, published = false
       where id = v_intent.id;
      action := 'delete';
    end if;
    return next;
  end loop;
end;
$$;
revoke all on function public.claim_archive_paper_upload_intents(
  uuid, timestamptz, integer
) from public, anon, authenticated;
grant execute on function public.claim_archive_paper_upload_intents(
  uuid, timestamptz, integer
) to service_role;
