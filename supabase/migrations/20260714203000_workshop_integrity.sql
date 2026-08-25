revoke all on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke all on function public.backfill_email_hmac() from public;
revoke execute on function public.backfill_email_hmac() from anon, authenticated;
revoke all on function public.log_disclosure(text, uuid, text, jsonb) from public;
revoke execute on function public.log_disclosure(text, uuid, text, jsonb)
  from anon, authenticated;
revoke all on function public.purge_inactive_accounts(integer) from public;
revoke execute on function public.purge_inactive_accounts(integer)
  from anon, authenticated;
revoke all on function public.purge_old_quiz_attempts(integer) from public;
revoke execute on function public.purge_old_quiz_attempts(integer)
  from anon, authenticated;

create table if not exists public.teaching_assignments (
  instructor_id uuid not null references public.profiles(id) on delete restrict,
  course_slug text not null,
  semester text not null,
  active boolean not null default true,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (instructor_id, course_slug, semester),
  check (course_slug in ('eco-1002', 'fin-3610')),
  check (char_length(semester) between 1 and 64)
);
create index if not exists teaching_assignments_course_term_idx
  on public.teaching_assignments (course_slug, semester, active);
alter table public.teaching_assignments enable row level security;
drop policy if exists "teaching_assignments_authenticated_read"
  on public.teaching_assignments;
create policy "teaching_assignments_authenticated_read"
  on public.teaching_assignments for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'instructor'
        and teaching_assignments.instructor_id = (select auth.uid())
    )
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

do $$
declare
  invalid_count integer;
  invalid_summary jsonb;
begin
  select
    count(*) filter (where
      course_slug not in ('eco-1002', 'fin-3610')
      or char_length(semester) not between 1 and 64
      or (student_name is not null and char_length(student_name) not between 1 and 120)
    ),
    jsonb_build_object(
      'invalid_course', count(*) filter (where course_slug not in ('eco-1002', 'fin-3610')),
      'invalid_semester', count(*) filter (where char_length(semester) not between 1 and 64),
      'invalid_student_name', count(*) filter (where student_name is not null and char_length(student_name) not between 1 and 120)
    )
    into invalid_count, invalid_summary
    from public.enrollments;

  if invalid_count > 0 then
    raise exception '% enrollment row(s) cannot be mapped to a teaching assignment: %. Correct these rows before retrying',
      invalid_count, invalid_summary;
  end if;
end $$;

insert into public.teaching_assignments (
  instructor_id, course_slug, semester, active
)
select distinct
  e.instructor_id,
  e.course_slug,
  e.semester,
  p.role = 'instructor'
from public.enrollments e
join public.profiles p on p.id = e.instructor_id
where e.course_slug in ('eco-1002', 'fin-3610')
  and char_length(e.semester) between 1 and 64
on conflict (instructor_id, course_slug, semester) do nothing;

alter table public.enrollments
  drop constraint if exists enrollments_teaching_assignment_fkey;
alter table public.enrollments
  add constraint enrollments_teaching_assignment_fkey
  foreign key (instructor_id, course_slug, semester)
  references public.teaching_assignments (instructor_id, course_slug, semester)
  on update restrict on delete restrict;
alter table public.enrollments
  drop constraint if exists enrollments_course_check,
  drop constraint if exists enrollments_semester_check,
  drop constraint if exists enrollments_student_name_check;
alter table public.enrollments
  add constraint enrollments_course_check
    check (course_slug in ('eco-1002', 'fin-3610')),
  add constraint enrollments_semester_check
    check (char_length(semester) between 1 and 64),
  add constraint enrollments_student_name_check
    check (student_name is null or char_length(student_name) between 1 and 120);

drop function if exists public.transfer_enrollment_scope(
  uuid, text, text, uuid, uuid, text, text
);
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
  select p.role into actor_role
    from public.profiles p
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
        'instructor:' || lock_instructor_id::text,
        0
      )
    );
  end loop;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'assignment:' || p_new_instructor_id::text || ':' ||
      p_course_slug || ':' || p_semester,
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
  -- Recreate the row because scope columns are trigger-immutable. The
  -- transaction restores the original row if the guarded insert fails.
  delete from public.enrollments
   where user_id = p_user_id
     and course_slug = p_course_slug
     and semester = p_semester
     and instructor_id = p_current_instructor_id
  returning enrolled_at into existing_enrolled_at;
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then return false; end if;

  insert into public.enrollments (
    user_id,
    course_slug,
    instructor_id,
    semester,
    enrolled_at,
    student_name,
    section
  ) values (
    p_user_id,
    p_course_slug,
    p_new_instructor_id,
    p_semester,
    existing_enrolled_at,
    p_student_name,
    p_section
  );
  update public.lesson_progress
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

create or replace function public.resolve_current_enrollment_scope(
  p_user_id uuid,
  p_course_slug text
)
returns table (semester text, instructor_id uuid)
language sql
stable
set search_path = ''
as $$
  with candidates as (
    select e.semester, e.instructor_id
      from public.enrollments e
      join public.teaching_assignments ta
        on ta.instructor_id = e.instructor_id
       and ta.course_slug = e.course_slug
       and ta.semester = e.semester
       and ta.active
      join public.profiles p
        on p.id = e.instructor_id
       and p.role = 'instructor'
     where e.user_id = p_user_id
       and e.course_slug = p_course_slug
  )
  select min(c.semester), min(c.instructor_id::text)::uuid
    from candidates c
  having count(*) = 1
$$;
revoke all on function public.resolve_current_enrollment_scope(uuid, text)
  from public, anon, authenticated;
grant execute on function public.resolve_current_enrollment_scope(uuid, text)
  to service_role;

alter table public.lesson_progress
  add column if not exists semester text,
  add column if not exists instructor_id uuid references public.profiles(id) on delete set null;
with unambiguous_enrollment as (
  select
    user_id,
    course_slug,
    min(semester) as semester,
    min(instructor_id::text)::uuid as instructor_id
  from public.enrollments
  group by user_id, course_slug
  having count(*) = 1
)
update public.lesson_progress p
   set semester = e.semester,
       instructor_id = e.instructor_id
  from unambiguous_enrollment e
 where p.user_id = e.user_id
   and p.course_slug = e.course_slug
   and p.semester is null
   and p.instructor_id is null;
alter table public.lesson_progress
  drop constraint if exists lesson_progress_scope_chk;
alter table public.lesson_progress
  add constraint lesson_progress_scope_chk
  check ((semester is null) = (instructor_id is null));
create index if not exists lesson_progress_offering_idx
  on public.lesson_progress (instructor_id, course_slug, semester, updated_at desc);

alter table public.quiz_attempts
  add column if not exists semester text,
  add column if not exists instructor_id uuid references public.profiles(id) on delete set null;
with unambiguous_enrollment as (
  select
    user_id,
    course_slug,
    min(semester) as semester,
    min(instructor_id::text)::uuid as instructor_id
  from public.enrollments
  group by user_id, course_slug
  having count(*) = 1
)
update public.quiz_attempts q
   set semester = e.semester,
       instructor_id = e.instructor_id
  from unambiguous_enrollment e
 where q.user_id = e.user_id
   and q.course_slug = e.course_slug
   and q.semester is null
   and q.instructor_id is null;
alter table public.quiz_attempts
  drop constraint if exists quiz_attempts_scope_chk;
alter table public.quiz_attempts
  add constraint quiz_attempts_scope_chk
  check ((semester is null) = (instructor_id is null));
create index if not exists quiz_attempts_offering_idx
  on public.quiz_attempts (instructor_id, course_slug, semester, submitted_at desc);

do $$
declare
  unscoped_progress bigint;
  unscoped_attempts bigint;
begin
  select count(*) into unscoped_progress
    from public.lesson_progress
   where semester is null and instructor_id is null;
  select count(*) into unscoped_attempts
    from public.quiz_attempts
   where semester is null and instructor_id is null;
  if unscoped_progress > 0 or unscoped_attempts > 0 then
    raise notice '% progress row(s) and % quiz attempt row(s) remain unscoped because their enrollment history is ambiguous; students and admins retain access',
      unscoped_progress, unscoped_attempts;
  end if;
end $$;

create table if not exists public.archive_paper_upload_intents (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete cascade,
  course_slug text not null,
  kind text not null,
  title text not null,
  semester_term text not null,
  semester_year integer not null,
  covers text[] not null default '{}',
  storage_path text not null unique,
  original_filename text not null,
  content_type text not null,
  file_size bigint not null,
  published boolean not null default true,
  state text not null default 'pending',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  finalized_at timestamptz,
  check (course_slug in ('eco-1002', 'fin-3610')),
  check (kind in ('exam', 'assignment')),
  check (char_length(title) between 1 and 200),
  check (semester_term in ('spring', 'summer', 'fall')),
  check (semester_year between 2020 and 2100),
  check (cardinality(covers) <= 100),
  check (char_length(storage_path) between 1 and 500),
  check (char_length(original_filename) between 1 and 160),
  check (content_type in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )),
  check (file_size between 1 and 26214400),
  check (state in ('pending', 'finalized', 'expired')),
  check (expires_at > created_at),
  check ((state = 'finalized') = (finalized_at is not null))
);
create index if not exists archive_paper_upload_intents_expiry_idx
  on public.archive_paper_upload_intents (state, expires_at);
alter table public.archive_paper_upload_intents enable row level security;

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
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_actor_id::text, 0));
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
    p_content_type, p_file_size, true, 'pending', p_expires_at
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

alter table public.archive_papers
  add column if not exists upload_intent_id uuid;
do $$ begin
  alter table public.archive_papers
    add constraint archive_papers_upload_intent_fkey
    foreign key (upload_intent_id)
    references public.archive_paper_upload_intents(id) on delete set null;
exception when duplicate_object then null; end $$;
create unique index if not exists archive_papers_upload_intent_uidx
  on public.archive_papers (upload_intent_id)
  where upload_intent_id is not null;

create or replace function public.purge_inactive_accounts(p_months integer default 24)
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
    from auth.users
   where coalesce(last_sign_in_at, created_at) < v_cutoff;

  with deleted as (
    delete from auth.users u
     where coalesce(u.last_sign_in_at, u.created_at) < v_cutoff
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
          where i.actor_id = u.id and i.state = 'pending'
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

alter table public.workshop_administrations
  add column if not exists semester text,
  add column if not exists schedule_version smallint,
  add column if not exists location_label text,
  add column if not exists questions_revealed_at timestamptz;
alter table public.workshop_administrations
  add column if not exists cancelled_at timestamptz;
alter table public.workshop_administrations
  add column if not exists geofence_required boolean generated always as (
    required_lat is not null and required_lng is not null
  ) stored;

do $$
declare unmapped_count integer;
begin
  select count(*) into unmapped_count
    from public.workshop_administrations
   where semester is null;
  if unmapped_count > 0 then
    raise exception '% workshop administration row(s) need an owner-confirmed semester before migration', unmapped_count;
  end if;
end $$;
update public.workshop_administrations
   set schedule_version = 1
 where schedule_version is null;
update public.workshop_administrations
   set location_label = '55 Lexington Ave'
 where location_label is null;

do $$
declare
  invalid_count integer;
  invalid_summary jsonb;
begin
  select
    count(*) filter (where
      char_length(semester) not between 1 and 64
      or course_slug not in ('eco-1002', 'fin-3610')
      or (required_lat is null) <> (required_lng is null)
      or (required_lat is not null and required_lat not between -90 and 90)
      or (required_lng is not null and required_lng not between -180 and 180)
      or required_radius_meters not between 10 and 50000
      or closes_at <= opens_at
      or (cancelled_at is not null and cancelled_at > opens_at)
      or char_length(location_label) not between 1 and 120
      or (notes is not null and char_length(notes) > 200)
    ),
    jsonb_build_object(
      'invalid_semester', count(*) filter (where char_length(semester) not between 1 and 64),
      'invalid_course', count(*) filter (where course_slug not in ('eco-1002', 'fin-3610')),
      'invalid_coordinate_pair', count(*) filter (where (required_lat is null) <> (required_lng is null)),
      'invalid_coordinate_range', count(*) filter (where
        (required_lat is not null and required_lat not between -90 and 90)
        or (required_lng is not null and required_lng not between -180 and 180)
      ),
      'invalid_radius', count(*) filter (where required_radius_meters not between 10 and 50000),
      'invalid_window', count(*) filter (where closes_at <= opens_at),
      'invalid_cancellation', count(*) filter (where cancelled_at is not null and cancelled_at > opens_at),
      'invalid_location_label', count(*) filter (where char_length(location_label) not between 1 and 120),
      'oversized_notes', count(*) filter (where notes is not null and char_length(notes) > 200)
    )
    into invalid_count, invalid_summary
    from public.workshop_administrations;

  if invalid_count > 0 then
    raise exception '% workshop administration row(s) violate the hardened schedule constraints: %. Run the legacy preflight query in CONTRIBUTING.md before retrying',
      invalid_count, invalid_summary;
  end if;
end $$;

alter table public.workshop_administrations
  alter column semester set not null,
  alter column schedule_version set default 2,
  alter column schedule_version set not null,
  alter column location_label set default '55 Lexington Ave',
  alter column location_label set not null;

alter table public.workshop_administrations
  alter column section drop not null;

do $$
declare con_name text;
begin
  for con_name in
    select conname from pg_constraint
     where conrelid = 'public.workshop_administrations'::regclass
       and contype = 'u'
       and pg_get_constraintdef(oid)
           = 'UNIQUE (workshop_slug, section, week_of)'
  loop
    execute format(
      'alter table public.workshop_administrations drop constraint %I',
      con_name
    );
  end loop;
end $$;

drop index if exists public.workshop_admins_section_week_unique;
create unique index workshop_admins_section_week_unique
  on public.workshop_administrations (
    workshop_slug, semester, section, week_of, instructor_id
  )
  where section is not null and cancelled_at is null;

drop index if exists public.workshop_admins_nosection_week_unique;
create unique index workshop_admins_nosection_week_unique
  on public.workshop_administrations (
    workshop_slug, semester, week_of, instructor_id
  )
  where section is null and cancelled_at is null;

drop index if exists public.workshop_admins_course_window_idx;
create index workshop_admins_course_window_idx
  on public.workshop_administrations (course_slug, semester, opens_at, closes_at);
create index if not exists workshop_admins_instructor_idx
  on public.workshop_administrations (instructor_id);

alter table public.workshop_administrations
  drop constraint if exists workshop_admins_semester_check,
  drop constraint if exists workshop_admins_schedule_version_check,
  drop constraint if exists workshop_admins_schedule_check,
  drop constraint if exists workshop_admins_course_section_day_check,
  drop constraint if exists workshop_admins_location_check,
  drop constraint if exists workshop_admins_radius_check,
  drop constraint if exists workshop_admins_duration_check,
  drop constraint if exists workshop_admins_cancellation_check,
  drop constraint if exists workshop_admins_text_length_check;
alter table public.workshop_administrations
  add constraint workshop_admins_semester_check
    check (char_length(semester) between 1 and 64),
  add constraint workshop_admins_schedule_version_check
    check (schedule_version in (1, 2)),
  add constraint workshop_admins_schedule_check
    check (
      schedule_version = 1
      or week_of = date_trunc(
        'week', opens_at at time zone 'America/New_York'
      )::date
    ),
  add constraint workshop_admins_course_section_day_check
    check (
      schedule_version = 1
      or (
        course_slug = 'eco-1002'
        and section is not null
        and extract(isodow from opens_at at time zone 'America/New_York') =
          case section::text
            when 'CML' then 1
            when 'CTL' then 2
            when 'CWL' then 3
            when 'CRL' then 4
          end
      )
      or (course_slug = 'fin-3610' and section is null)
    ),
  add constraint workshop_admins_location_check
    check (
      (required_lat is null) = (required_lng is null)
      and (required_lat is null or required_lat between -90 and 90)
      and (required_lng is null or required_lng between -180 and 180)
    ),
  add constraint workshop_admins_radius_check
    check (required_radius_meters between 10 and 50000),
  add constraint workshop_admins_duration_check
    check (
      closes_at > opens_at
      and (schedule_version = 1 or closes_at <= opens_at + interval '24 hours')
    ),
  add constraint workshop_admins_cancellation_check
    check (cancelled_at is null or cancelled_at <= opens_at),
  add constraint workshop_admins_text_length_check
    check (
      char_length(location_label) between 1 and 120
      and (notes is null or char_length(notes) <= 200)
    );

insert into public.teaching_assignments (
  instructor_id, course_slug, semester, active
)
select distinct
  a.instructor_id,
  a.course_slug,
  a.semester,
  p.role = 'instructor'
from public.workshop_administrations a
join public.profiles p on p.id = a.instructor_id
where a.course_slug in ('eco-1002', 'fin-3610')
  and char_length(a.semester) between 1 and 64
on conflict (instructor_id, course_slug, semester) do nothing;

alter table public.workshop_administrations
  drop constraint if exists workshop_admins_teaching_assignment_fkey;
alter table public.workshop_administrations
  add constraint workshop_admins_teaching_assignment_fkey
  foreign key (instructor_id, course_slug, semester)
  references public.teaching_assignments (instructor_id, course_slug, semester)
  on update restrict on delete restrict;

drop policy if exists "workshop_admins_authenticated_read" on public.workshop_administrations;
drop policy if exists "workshop_admins_course_read" on public.workshop_administrations;
create policy "workshop_admins_course_read"
  on public.workshop_administrations for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      join public.teaching_assignments ta
        on ta.instructor_id = p.id
      where p.id = (select auth.uid())
        and p.role = 'instructor'
        and workshop_administrations.instructor_id = (select auth.uid())
        and ta.course_slug = workshop_administrations.course_slug
        and ta.semester = workshop_administrations.semester
        and ta.active
    )
    or exists (
      select 1 from public.enrollments e
      where e.user_id = (select auth.uid())
        and e.course_slug = workshop_administrations.course_slug
        and e.semester = workshop_administrations.semester
        and e.instructor_id = workshop_administrations.instructor_id
        and (
          workshop_administrations.section is null
          or e.section = workshop_administrations.section::text
        )
    )
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

revoke select on table public.workshop_administrations from anon, authenticated;
revoke select (required_lat, required_lng, required_radius_meters, notes)
  on public.workshop_administrations from anon, authenticated;
grant select (
  id, workshop_slug, course_slug, semester, section, week_of,
  schedule_version, instructor_id, opens_at, closes_at, geofence_required,
  location_label, questions_revealed_at, cancelled_at, created_at
) on public.workshop_administrations to authenticated;
revoke insert, update, delete on table public.workshop_administrations
  from anon, authenticated;

alter table public.workshop_attendance
  add column if not exists device_hmac text,
  add column if not exists verification_method text,
  add column if not exists recorded_by uuid,
  add column if not exists correction_reason text;

update public.workshop_attendance
   set verification_method = 'legacy'
 where verification_method is null;

alter table public.workshop_attendance
  alter column verification_method drop default,
  alter column verification_method set not null;

do $$ begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'workshop_attendance'
       and column_name = 'device_id'
  ) then
    alter table public.workshop_attendance alter column device_id drop not null;
  end if;
end $$;

alter table public.workshop_attendance
  drop constraint if exists workshop_attendance_recorded_by_fkey,
  drop constraint if exists workshop_attendance_verification_check;
alter table public.workshop_attendance
  add constraint workshop_attendance_recorded_by_fkey
    foreign key (recorded_by) references public.profiles(id) on delete set null,
  add constraint workshop_attendance_verification_check
    check (
      (
        verification_method = 'legacy'
        and device_hmac is null
        and recorded_by is null
        and correction_reason is null
      )
      or (
        verification_method in ('geofence', 'window')
        and device_hmac ~ '^[0-9a-f]{64}$'
        and recorded_by is null
        and correction_reason is null
      )
      or (
        verification_method = 'manual'
        and device_hmac is null
        and char_length(correction_reason) between 1 and 200
      )
    );

create or replace function public.validate_manual_workshop_attendance_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role public.user_role;
begin
  select p.role into actor_role
    from public.profiles p
   where p.id = new.recorded_by;

  if actor_role = 'admin' then
    return new;
  end if;

  if actor_role = 'instructor' and exists (
    select 1
      from public.workshop_administrations a
      join public.teaching_assignments ta
        on ta.instructor_id = a.instructor_id
       and ta.course_slug = a.course_slug
       and ta.semester = a.semester
       and ta.active
     where a.id = new.administration_id
       and a.instructor_id = new.recorded_by
  ) then
    return new;
  end if;

  raise exception 'manual attendance requires the owning instructor or an admin'
    using errcode = '23514';
end;
$$;

revoke all on function public.validate_manual_workshop_attendance_insert()
  from public, anon, authenticated, service_role;
drop trigger if exists workshop_attendance_manual_actor_check
  on public.workshop_attendance;
create trigger workshop_attendance_manual_actor_check
  before insert on public.workshop_attendance
  for each row
  when (new.verification_method = 'manual')
  execute function public.validate_manual_workshop_attendance_insert();

create unique index if not exists workshop_attendance_device_unique
  on public.workshop_attendance (administration_id, device_hmac)
  where device_hmac is not null;

create or replace function public.instructor_can_read_workshop_attendance(
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
       and e.instructor_id = (select auth.uid())
  )
$$;
revoke all on function public.instructor_can_read_workshop_attendance(uuid, uuid)
  from public, anon, service_role;
grant execute on function public.instructor_can_read_workshop_attendance(uuid, uuid)
  to authenticated;

drop policy if exists "workshop_attendance_self_read" on public.workshop_attendance;
drop policy if exists "workshop_attendance_instructor_read_scoped" on public.workshop_attendance;
drop policy if exists "workshop_attendance_authenticated_read" on public.workshop_attendance;
create policy "workshop_attendance_authenticated_read"
  on public.workshop_attendance for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
    or (select public.instructor_can_read_workshop_attendance(
      workshop_attendance.administration_id,
      workshop_attendance.user_id
    ))
  );

revoke select on table public.workshop_attendance from anon, authenticated;
revoke select (device_hmac, recorded_by, correction_reason)
  on public.workshop_attendance from anon, authenticated;
grant select (
  id, administration_id, user_id, stamped_at, verification_method
) on public.workshop_attendance to authenticated;

-- Serialize authorization changes with writes that depend on them. App-level
-- checks still provide friendly errors; these triggers close revocation races.
create or replace function public.guard_active_assignment_reference()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('instructor:' || new.instructor_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'assignment:' || new.instructor_id::text || ':' ||
      new.course_slug || ':' || new.semester,
      0
    )
  );

  if tg_table_name = 'enrollments' then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'enrollment:' || (pg_catalog.to_jsonb(new)->>'user_id') || ':' ||
        new.course_slug || ':' || new.semester,
        0
      )
    );
  end if;

  if not exists (
    select 1
      from public.teaching_assignments ta
      join public.profiles p on p.id = ta.instructor_id
     where ta.instructor_id = new.instructor_id
       and ta.course_slug = new.course_slug
       and ta.semester = new.semester
       and ta.active
       and p.role = 'instructor'
  ) then
    raise exception 'an active instructor teaching assignment is required'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_active_assignment_reference()
  from public, anon, authenticated, service_role;

create or replace function public.guard_teaching_assignment_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('instructor:' || new.instructor_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'assignment:' || new.instructor_id::text || ':' ||
      new.course_slug || ':' || new.semester,
      0
    )
  );

  if new.active and not exists (
    select 1 from public.profiles p
     where p.id = new.instructor_id and p.role = 'instructor'
  ) then
    raise exception 'teaching assignments require an instructor profile'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and old.active and not new.active and exists (
    select 1
      from public.workshop_administrations w
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

create or replace function public.guard_instructor_role_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.role is distinct from new.role then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('instructor:' || new.id::text, 0)
    );
  end if;
  if old.role = 'instructor' and new.role <> 'instructor' then
    if exists (
      select 1 from public.teaching_assignments ta
       where ta.instructor_id = new.id and ta.active
    ) then
      raise exception 'deactivate teaching assignments before changing instructor role'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_instructor_role_change()
  from public, anon, authenticated, service_role;

create or replace function public.guard_archive_creator_course()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  creator_role public.user_role;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('instructor:' || new.created_by::text, 0)
  );
  select p.role into creator_role
    from public.profiles p
   where p.id = new.created_by;

  if creator_role = 'admin' then
    return new;
  end if;
  if creator_role = 'instructor' and exists (
    select 1 from public.teaching_assignments ta
     where ta.instructor_id = new.created_by
       and ta.course_slug = new.course_slug
       and ta.active
  ) then
    return new;
  end if;
  raise exception 'archive creation requires an admin or active course instructor'
    using errcode = '23514';
end;
$$;
revoke all on function public.guard_archive_creator_course()
  from public, anon, authenticated, service_role;

-- Identity and authorization-scope changes use dedicated workflows. Reject
-- them before any advisory lock so row locks cannot invert the workflow order.
create or replace function public.reject_immutable_scope_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% identity or authorization scope is immutable', tg_table_name
    using errcode = '23514';
end;
$$;
revoke all on function public.reject_immutable_scope_update()
  from public, anon, authenticated, service_role;

drop trigger if exists teaching_assignments_state_insert
  on public.teaching_assignments;
create trigger teaching_assignments_state_insert
  before insert on public.teaching_assignments
  for each row execute function public.guard_teaching_assignment_state();
drop trigger if exists teaching_assignments_state_update
  on public.teaching_assignments;
create trigger teaching_assignments_state_update
  before update of active
  on public.teaching_assignments
  for each row execute function public.guard_teaching_assignment_state();
drop trigger if exists teaching_assignments_identity_update
  on public.teaching_assignments;
create trigger teaching_assignments_identity_update
  before update of instructor_id, course_slug, semester
  on public.teaching_assignments
  for each row execute function public.reject_immutable_scope_update();

drop trigger if exists profiles_instructor_role_change on public.profiles;
create trigger profiles_instructor_role_change
  before update of role on public.profiles
  for each row execute function public.guard_instructor_role_change();

drop trigger if exists enrollments_active_assignment_insert
  on public.enrollments;
create trigger enrollments_active_assignment_insert
  before insert on public.enrollments
  for each row execute function public.guard_active_assignment_reference();
drop trigger if exists enrollments_active_assignment_update
  on public.enrollments;
drop trigger if exists enrollments_scope_update_reject
  on public.enrollments;
create trigger enrollments_scope_update_reject
  before update of user_id, instructor_id, course_slug, semester
  on public.enrollments
  for each row execute function public.reject_immutable_scope_update();

drop trigger if exists workshop_admins_active_assignment_insert
  on public.workshop_administrations;
create trigger workshop_admins_active_assignment_insert
  before insert on public.workshop_administrations
  for each row execute function public.guard_active_assignment_reference();
drop trigger if exists workshop_admins_active_assignment_update
  on public.workshop_administrations;
drop trigger if exists workshop_admins_scope_update_reject
  on public.workshop_administrations;
create trigger workshop_admins_scope_update_reject
  before update of workshop_slug, instructor_id, course_slug, semester,
    section, week_of
  on public.workshop_administrations
  for each row execute function public.reject_immutable_scope_update();

drop trigger if exists archive_videos_creator_course_insert
  on public.archive_videos;
create trigger archive_videos_creator_course_insert
  before insert on public.archive_videos
  for each row execute function public.guard_archive_creator_course();
drop trigger if exists archive_videos_creator_course_update
  on public.archive_videos;
drop trigger if exists archive_videos_scope_update_reject
  on public.archive_videos;
create trigger archive_videos_scope_update_reject
  before update of created_by, course_slug on public.archive_videos
  for each row execute function public.reject_immutable_scope_update();

drop trigger if exists archive_papers_creator_course_insert
  on public.archive_papers;
create trigger archive_papers_creator_course_insert
  before insert on public.archive_papers
  for each row execute function public.guard_archive_creator_course();
drop trigger if exists archive_papers_creator_course_update
  on public.archive_papers;
drop trigger if exists archive_papers_scope_update_reject
  on public.archive_papers;
create trigger archive_papers_scope_update_reject
  before update of created_by, course_slug on public.archive_papers
  for each row execute function public.reject_immutable_scope_update();

drop trigger if exists archive_quizzes_creator_course_insert
  on public.archive_quizzes;
create trigger archive_quizzes_creator_course_insert
  before insert on public.archive_quizzes
  for each row execute function public.guard_archive_creator_course();
drop trigger if exists archive_quizzes_creator_course_update
  on public.archive_quizzes;
drop trigger if exists archive_quizzes_scope_update_reject
  on public.archive_quizzes;
create trigger archive_quizzes_scope_update_reject
  before update of created_by, course_slug on public.archive_quizzes
  for each row execute function public.reject_immutable_scope_update();
revoke insert, update, delete on table public.workshop_attendance
  from anon, authenticated;

-- Scope all read policies explicitly to authenticated users and cache the JWT
-- subject once per query. Consolidating equivalent permissive policies keeps
-- the final policy objects aligned with the canonical schema and avoids the
-- hosted database advisor's per-row auth and duplicate-policy warnings.
drop policy if exists "profiles_self_read" on public.profiles;
create policy "profiles_self_read"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "enrollments_self_read" on public.enrollments;
drop policy if exists "enrollments_instructor_read" on public.enrollments;
drop policy if exists "enrollments_admin_read" on public.enrollments;
drop policy if exists "enrollments_authenticated_read" on public.enrollments;
create policy "enrollments_authenticated_read"
  on public.enrollments for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1
      from public.teaching_assignments ta
      join public.profiles p on p.id = (select auth.uid())
      where ta.instructor_id = (select auth.uid())
        and ta.instructor_id = enrollments.instructor_id
        and ta.course_slug = enrollments.course_slug
        and ta.semester = enrollments.semester
        and ta.active
        and p.role = 'instructor'
    )
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

drop policy if exists "quiz_attempts_self_read" on public.quiz_attempts;
drop policy if exists "quiz_attempts_instructor_read" on public.quiz_attempts;
drop policy if exists "quiz_attempts_instructor_read_scoped" on public.quiz_attempts;
drop policy if exists "quiz_attempts_authenticated_read" on public.quiz_attempts;
create policy "quiz_attempts_authenticated_read"
  on public.quiz_attempts for select
  to authenticated
  using (
    (select auth.uid()) = quiz_attempts.user_id
    or exists (
      select 1
      from public.enrollments e
      join public.teaching_assignments ta
        on ta.instructor_id = e.instructor_id
       and ta.course_slug = e.course_slug
       and ta.semester = e.semester
      join public.profiles p on p.id = ta.instructor_id
      where e.user_id = quiz_attempts.user_id
        and e.instructor_id = (select auth.uid())
        and e.course_slug = quiz_attempts.course_slug
        and e.semester = quiz_attempts.semester
        and quiz_attempts.instructor_id = (select auth.uid())
        and ta.active
        and p.role = 'instructor'
    )
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

drop policy if exists "lesson_progress_self_read" on public.lesson_progress;
drop policy if exists "lesson_progress_instructor_read_scoped" on public.lesson_progress;
drop policy if exists "lesson_progress_authenticated_read" on public.lesson_progress;
create policy "lesson_progress_authenticated_read"
  on public.lesson_progress for select
  to authenticated
  using (
    (select auth.uid()) = lesson_progress.user_id
    or exists (
      select 1
      from public.enrollments e
      join public.teaching_assignments ta
        on ta.instructor_id = e.instructor_id
       and ta.course_slug = e.course_slug
       and ta.semester = e.semester
      join public.profiles p on p.id = ta.instructor_id
      where e.user_id = lesson_progress.user_id
        and e.instructor_id = (select auth.uid())
        and e.course_slug = lesson_progress.course_slug
        and e.semester = lesson_progress.semester
        and lesson_progress.instructor_id = (select auth.uid())
        and ta.active
        and p.role = 'instructor'
    )
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

drop policy if exists "audit_log_actor_self_read" on public.audit_log;
drop policy if exists "audit_log_admin_read" on public.audit_log;
drop policy if exists "audit_log_authenticated_read" on public.audit_log;
create policy "audit_log_authenticated_read"
  on public.audit_log for select
  to authenticated
  using (
    (select auth.uid()) = actor_id
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

do $$ begin
  insert into storage.buckets (
    id, name, public, file_size_limit, allowed_mime_types
  ) values (
    'archive-papers',
    'archive-papers',
    false,
    26214400,
    array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  )
  on conflict (id) do update
    set public = false,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
exception when invalid_schema_name or undefined_table then null;
end $$;

alter table public.archive_videos
  drop constraint if exists archive_videos_input_check;
alter table public.archive_videos
  add constraint archive_videos_input_check check (
    char_length(title) between 1 and 200
    and char_length(lesson_slug) between 1 and 200
    and char_length(video_id) between 1 and 64
    and (description is null or char_length(description) <= 2000)
    and (duration_minutes is null or duration_minutes between 1 and 1440)
  ) not valid;
alter table public.archive_videos
  validate constraint archive_videos_input_check;

alter table public.archive_papers
  drop constraint if exists archive_papers_input_check;
alter table public.archive_papers
  add constraint archive_papers_input_check check (
    char_length(title) between 1 and 200
    and cardinality(covers) <= 100
    and char_length(storage_path) between 1 and 500
    and char_length(original_filename) between 1 and 160
    and content_type in (
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
    and size_bytes between 1 and 26214400
  ) not valid;
alter table public.archive_papers
  validate constraint archive_papers_input_check;

alter table public.archive_quizzes
  drop constraint if exists archive_quizzes_input_check;
alter table public.archive_quizzes
  add constraint archive_quizzes_input_check check (
    char_length(title) between 1 and 200
    and cardinality(covers) <= 100
    and jsonb_typeof(questions) = 'array'
    and jsonb_array_length(questions) between 1 and 100
  ) not valid;
alter table public.archive_quizzes
  validate constraint archive_quizzes_input_check;

-- Actor-aware mutation functions serialize the final authorization check with
-- the write. Server routes still preflight for useful errors, but a concurrent
-- role or teaching-assignment revocation cannot slip between check and write.
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

create or replace function public.mutate_archive_item(
  p_actor_id uuid,
  p_resource text,
  p_id uuid,
  p_operation text,
  p_patch jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  actor_role public.user_role;
  item_course text;
  item_creator uuid;
begin
  if p_actor_id is null
     or p_id is null
     or p_resource is null
     or p_operation is null
     or p_resource not in ('video', 'paper', 'quiz')
     or p_operation not in ('update', 'delete') then
    raise exception 'invalid archive mutation input' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('instructor:' || p_actor_id::text, 0)
  );
  select p.role into actor_role
    from public.profiles p
   where p.id = p_actor_id;

  if p_resource = 'video' then
    select v.course_slug, v.created_by
      into item_course, item_creator
      from public.archive_videos v
     where v.id = p_id and v.deleted_at is null
     for update;
  elsif p_resource = 'paper' then
    select p.course_slug, p.created_by
      into item_course, item_creator
      from public.archive_papers p
     where p.id = p_id and p.deleted_at is null
     for update;
  else
    select q.course_slug, q.created_by
      into item_course, item_creator
      from public.archive_quizzes q
     where q.id = p_id and q.deleted_at is null
     for update;
  end if;
  if not found then
    return false;
  end if;
  if not coalesce(
    actor_role = 'admin'::public.user_role
      or (
        actor_role = 'instructor'::public.user_role
        and item_creator = p_actor_id
        and exists (
          select 1 from public.teaching_assignments ta
           where ta.instructor_id = p_actor_id
             and ta.course_slug = item_course
             and ta.active
        )
      ),
    false
  ) then
    return false;
  end if;

  if p_operation = 'delete' then
    if p_resource = 'video' then
      update public.archive_videos
         set deleted_at = pg_catalog.clock_timestamp(),
             updated_at = pg_catalog.clock_timestamp()
       where id = p_id and deleted_at is null;
    elsif p_resource = 'paper' then
      update public.archive_papers
         set deleted_at = pg_catalog.clock_timestamp(),
             updated_at = pg_catalog.clock_timestamp()
       where id = p_id and deleted_at is null;
    else
      update public.archive_quizzes
         set deleted_at = pg_catalog.clock_timestamp(),
             updated_at = pg_catalog.clock_timestamp()
       where id = p_id and deleted_at is null;
    end if;
    return found;
  end if;

  if jsonb_typeof(p_patch) is distinct from 'object' then
    raise exception 'invalid archive patch' using errcode = '22023';
  end if;
  if p_resource = 'video' then
    if not (p_patch ?& array[
      'lesson_slug', 'semester_term', 'semester_year', 'title', 'provider',
      'video_id', 'description', 'duration_minutes', 'published'
    ]) or p_patch - array[
      'lesson_slug', 'semester_term', 'semester_year', 'title', 'provider',
      'video_id', 'description', 'duration_minutes', 'published'
    ] <> '{}'::jsonb then
      raise exception 'invalid video patch' using errcode = '22023';
    end if;
    update public.archive_videos
       set lesson_slug = p_patch->>'lesson_slug',
           semester_term = p_patch->>'semester_term',
           semester_year = (p_patch->>'semester_year')::integer,
           title = p_patch->>'title',
           provider = p_patch->>'provider',
           video_id = p_patch->>'video_id',
           description = p_patch->>'description',
           duration_minutes = (p_patch->>'duration_minutes')::integer,
           published = (p_patch->>'published')::boolean,
           updated_at = pg_catalog.clock_timestamp()
     where id = p_id and deleted_at is null;
  elsif p_resource = 'paper' then
    if not (p_patch ?& array[
      'kind', 'title', 'semester_term', 'semester_year', 'covers', 'published'
    ]) or p_patch - array[
      'kind', 'title', 'semester_term', 'semester_year', 'covers', 'published'
    ] <> '{}'::jsonb then
      raise exception 'invalid paper patch' using errcode = '22023';
    end if;
    update public.archive_papers
       set kind = p_patch->>'kind',
           title = p_patch->>'title',
           semester_term = p_patch->>'semester_term',
           semester_year = (p_patch->>'semester_year')::integer,
           covers = array(
             select jsonb_array_elements_text(p_patch->'covers')
           ),
           published = (p_patch->>'published')::boolean,
           updated_at = pg_catalog.clock_timestamp()
     where id = p_id and deleted_at is null;
  else
    if not (p_patch ?& array[
      'kind', 'title', 'semester_term', 'semester_year', 'covers',
      'questions', 'passing_score', 'published'
    ]) or p_patch - array[
      'kind', 'title', 'semester_term', 'semester_year', 'covers',
      'questions', 'passing_score', 'published'
    ] <> '{}'::jsonb then
      raise exception 'invalid quiz patch' using errcode = '22023';
    end if;
    update public.archive_quizzes
       set kind = p_patch->>'kind',
           title = p_patch->>'title',
           semester_term = p_patch->>'semester_term',
           semester_year = (p_patch->>'semester_year')::integer,
           covers = array(
             select jsonb_array_elements_text(p_patch->'covers')
           ),
           questions = p_patch->'questions',
           passing_score = (p_patch->>'passing_score')::numeric,
           published = (p_patch->>'published')::boolean,
           updated_at = pg_catalog.clock_timestamp()
     where id = p_id and deleted_at is null;
  end if;
  return found;
end;
$$;
revoke all on function public.mutate_archive_item(
  uuid, text, uuid, text, jsonb
) from public, anon, authenticated;
grant execute on function public.mutate_archive_item(
  uuid, text, uuid, text, jsonb
) to service_role;

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
  select p.role into actor_role
    from public.profiles p
   where p.id = p_actor_id;
  select a.* into administration
    from public.workshop_administrations a
   where a.id = p_administration_id
   for update;
  if not found then
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'assignment:' || administration.instructor_id::text || ':' ||
      administration.course_slug || ':' || administration.semester,
      0
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
      ),
    false
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
         questions_revealed_at,
         pg_catalog.clock_timestamp()
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
      administration.course_slug || ':' || administration.semester,
      0
    )
  );
  if p_operation = 'manual_add' then
    if not exists (
      select 1 from public.enrollments e
       where e.user_id = p_target_user_id
         and e.course_slug = administration.course_slug
         and e.semester = administration.semester
         and e.instructor_id = administration.instructor_id
         and e.section is not distinct from administration.section::text
    ) then
      return false;
    end if;
    insert into public.workshop_attendance (
      administration_id,
      user_id,
      verification_method,
      recorded_by,
      correction_reason
    ) values (
      p_administration_id,
      p_target_user_id,
      'manual',
      p_actor_id,
      p_reason
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
      administration.course_slug || ':' || administration.semester,
      0
    )
  );
  if not exists (
    select 1 from public.enrollments e
     where e.user_id = p_user_id
       and e.course_slug = administration.course_slug
       and e.semester = administration.semester
       and e.instructor_id = administration.instructor_id
       and e.section is not distinct from administration.section::text
  ) then
    return false;
  end if;

  insert into public.workshop_attendance (
    administration_id,
    user_id,
    device_hmac,
    verification_method
  ) values (
    p_administration_id,
    p_user_id,
    p_device_hmac,
    p_verification_method
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

-- RLS does not protect TRUNCATE, REFERENCES, or TRIGGER. Replace Supabase's
-- broad defaults with the exact client reads and profile preferences the app
-- uses; archive tables remain service-role only.
revoke all privileges on table
  public.profiles,
  public.teaching_assignments,
  public.lesson_progress,
  public.quiz_attempts,
  public.enrollments,
  public.audit_log,
  public.workshop_administrations,
  public.workshop_attendance,
  public.archive_videos,
  public.archive_paper_upload_intents,
  public.archive_papers,
  public.archive_quizzes
from anon, authenticated, service_role;

grant select, insert, update, delete on table
  public.profiles,
  public.teaching_assignments,
  public.lesson_progress,
  public.quiz_attempts,
  public.enrollments,
  public.audit_log,
  public.workshop_administrations,
  public.workshop_attendance,
  public.archive_videos,
  public.archive_paper_upload_intents,
  public.archive_papers,
  public.archive_quizzes
to service_role;
revoke update on table public.workshop_attendance from service_role;

grant select (
  id, display_name, role, tos_accepted_at, created_at, active_course_slug
) on public.profiles to authenticated;
grant update (display_name, active_course_slug, tos_accepted_at)
  on public.profiles to authenticated;
grant select on table
  public.teaching_assignments,
  public.lesson_progress,
  public.quiz_attempts,
  public.enrollments
to authenticated;
grant select (
  id, ts, actor_id, actor_role, action, target_user_id,
  target_resource, metadata
) on public.audit_log to authenticated;
grant select (
  id, workshop_slug, course_slug, semester, section, week_of,
  schedule_version, instructor_id, opens_at, closes_at, geofence_required,
  location_label, questions_revealed_at, cancelled_at, created_at
) on public.workshop_administrations to authenticated;
grant select (
  id, administration_id, user_id, stamped_at, verification_method
) on public.workshop_attendance to authenticated;
