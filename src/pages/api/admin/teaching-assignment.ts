import type { APIRoute } from 'astro';
import { getAdminClient, listAllAuthUsers } from '@lib/supabase/admin';
import { isAdmin } from '@lib/roles';
import { isCourseSlug } from '@lib/courses';
import { isUuid } from '@lib/workshop-policy';
import { logDisclosureSafe } from '@lib/audit';

type AssignmentAction = 'assign' | 'activate' | 'deactivate' | 'remove';

const redirect = (key: 'assignment_ok' | 'assignment_error', value: string) =>
  new Response(null, {
    status: 303,
    headers: { Location: `/admin?${key}=${encodeURIComponent(value)}` },
  });
const ok = (value: string) => redirect('assignment_ok', value);
const error = (value: string) => redirect('assignment_error', value);

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  const role = locals.profile?.role ?? 'student';
  if (!user) return error('unauthenticated');
  if (!isAdmin(role)) return error('forbidden');

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error('invalid_input');
  }

  const action = String(form.get('action') ?? '') as AssignmentAction;
  const course = String(form.get('course_slug') ?? '').trim();
  const semester = String(form.get('semester') ?? '').trim();
  if (
    !['assign', 'activate', 'deactivate', 'remove'].includes(action) ||
    !isCourseSlug(course) ||
    !semester ||
    semester.length > 64
  ) {
    return error('invalid_input');
  }

  const admin = getAdminClient();
  let instructorId = String(form.get('instructor_id') ?? '').trim();

  if (action === 'assign') {
    const email = String(form.get('email') ?? '')
      .trim()
      .toLowerCase();
    if (!email || email.length > 254) return error('invalid_input');
    try {
      const authUsers = await listAllAuthUsers(admin);
      instructorId =
        authUsers.find((candidate) => candidate.email?.toLowerCase() === email)
          ?.id ?? '';
    } catch {
      return error('lookup_failed');
    }
    if (!instructorId) return error('no_account');

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('role')
      .eq('id', instructorId)
      .maybeSingle();
    if (profileError) return error('lookup_failed');
    if (!profile) return error('no_account');
    if (profile.role !== 'instructor') return error('not_instructor');

    const assignment = {
      active: true,
      assigned_by: user.id,
      updated_at: new Date().toISOString(),
    };
    const { data: existing, error: existingError } = await admin
      .from('teaching_assignments')
      .select('instructor_id')
      .eq('instructor_id', instructorId)
      .eq('course_slug', course)
      .eq('semester', semester)
      .maybeSingle();
    if (existingError) return error('lookup_failed');

    const saveExisting = () =>
      admin
        .from('teaching_assignments')
        .update(assignment)
        .eq('instructor_id', instructorId)
        .eq('course_slug', course)
        .eq('semester', semester)
        .select('instructor_id')
        .maybeSingle();
    let saveResult = existing
      ? await saveExisting()
      : await admin
          .from('teaching_assignments')
          .insert({
            instructor_id: instructorId,
            course_slug: course,
            semester,
            ...assignment,
          })
          .select('instructor_id')
          .maybeSingle();
    // A concurrent admin may create the same assignment after our lookup.
    // Retry as an active-state update without rewriting immutable key columns.
    if (saveResult.error?.code === '23505') saveResult = await saveExisting();
    const { data: saved, error: saveError } = saveResult;
    if (saveError?.code === '23514') return error('not_instructor');
    if (saveError || !saved) return error('save_failed');
  } else {
    if (!isUuid(instructorId)) return error('invalid_input');

    const { data: current, error: currentError } = await admin
      .from('teaching_assignments')
      .select('active')
      .eq('instructor_id', instructorId)
      .eq('course_slug', course)
      .eq('semester', semester)
      .maybeSingle();
    if (currentError) return error('lookup_failed');
    if (!current) return error('not_found');
    const nextActive = action === 'activate';
    if (action === 'remove') {
      if (current.active) return error('deactivate_first');
      const [enrollments, workshops] = await Promise.all([
        admin
          .from('enrollments')
          .select('user_id', { count: 'exact', head: true })
          .eq('instructor_id', instructorId)
          .eq('course_slug', course)
          .eq('semester', semester),
        admin
          .from('workshop_administrations')
          .select('id', { count: 'exact', head: true })
          .eq('instructor_id', instructorId)
          .eq('course_slug', course)
          .eq('semester', semester),
      ]);
      if (enrollments.error || workshops.error) return error('lookup_failed');
      if ((enrollments.count ?? 0) > 0 || (workshops.count ?? 0) > 0) {
        return error('assignment_in_use');
      }
      const { data: removed, error: removeError } = await admin
        .from('teaching_assignments')
        .delete()
        .eq('instructor_id', instructorId)
        .eq('course_slug', course)
        .eq('semester', semester)
        .eq('active', false)
        .select('instructor_id')
        .maybeSingle();
      if (removeError || !removed) return error('save_failed');
    } else {
      if (current.active === nextActive) return ok('unchanged');

      if (nextActive) {
        const { data: profile, error: profileError } = await admin
          .from('profiles')
          .select('role')
          .eq('id', instructorId)
          .maybeSingle();
        if (profileError) return error('lookup_failed');
        if (profile?.role !== 'instructor') return error('not_instructor');
      } else {
        const { data: liveWindows, error: liveError } = await admin
          .from('workshop_administrations')
          .select('id')
          .eq('instructor_id', instructorId)
          .eq('course_slug', course)
          .eq('semester', semester)
          .is('cancelled_at', null)
          .gt('closes_at', new Date().toISOString())
          .limit(1);
        if (liveError) return error('lookup_failed');
        if ((liveWindows ?? []).length > 0) return error('live_workshops');
      }

      const { data: saved, error: saveError } = await admin
        .from('teaching_assignments')
        .update({
          active: nextActive,
          assigned_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('instructor_id', instructorId)
        .eq('course_slug', course)
        .eq('semester', semester)
        .eq('active', current.active)
        .select('instructor_id')
        .maybeSingle();
      if (saveError?.code === '23514') {
        return error(nextActive ? 'not_instructor' : 'live_workshops');
      }
      if (saveError || !saved) return error('save_failed');
    }
  }

  const audited = await logDisclosureSafe({
    actorId: user.id,
    actorRole: 'admin',
    action: 'manage_teaching_assignment',
    targetUserId: instructorId,
    targetResource: `${course}:${semester}`,
    metadata: {
      action,
      active: action === 'assign' || action === 'activate',
    },
    request,
  });
  return audited
    ? ok(
        action === 'deactivate'
          ? 'deactivated'
          : action === 'remove'
            ? 'removed'
            : 'saved',
      )
    : ok('saved_unaudited');
};
