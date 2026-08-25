import type { APIRoute } from 'astro';
import { getAdminClient } from '@lib/supabase/admin';
import { isAdmin, isInstructor } from '@lib/roles';
import { logDisclosure, logDisclosureSafe } from '@lib/audit';
import {
  canUseStudentWorkshopAttendance,
  isUuid,
  matchWorkshopEnrollment,
} from '@lib/workshop-policy';
import { isCourseSlug } from '@lib/courses';
import { hasActiveTeachingAssignment } from '@lib/instructor/class-access';

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  const role = locals.profile?.role ?? 'student';
  if (!user) return redirect(null, 'unauthenticated', false);
  if (!isInstructor(role)) {
    return redirect(null, 'forbidden', false);
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return redirect(null, 'invalid_input', false);
  }
  const workshopSlugHint = safeWorkshopSlug(
    String(form.get('workshop_slug') ?? ''),
  );
  const operation = String(form.get('operation') ?? 'add');
  const administrationId = String(form.get('administration_id') ?? '');
  const targetUserId = String(form.get('user_id') ?? '');
  const reason = String(form.get('reason') ?? '').trim();
  if (
    !['add', 'remove'].includes(operation) ||
    !isUuid(administrationId) ||
    !isUuid(targetUserId) ||
    reason.length < 1 ||
    reason.length > 200
  ) {
    return redirect(workshopSlugHint, 'invalid_input', false);
  }

  const admin = getAdminClient();
  const { data: administration, error: lookupError } = await admin
    .from('workshop_administrations')
    .select(
      'id, workshop_slug, course_slug, semester, section, instructor_id, opens_at, cancelled_at',
    )
    .eq('id', administrationId)
    .maybeSingle();
  if (lookupError) return redirect(workshopSlugHint, 'lookup_failed', false);
  if (!administration) return redirect(workshopSlugHint, 'not_found', false);
  if (!isAdmin(role) && administration.instructor_id !== user.id) {
    return redirect(workshopSlugHint, 'forbidden', false);
  }
  if (
    !isAdmin(role) &&
    (!isCourseSlug(administration.course_slug) ||
      !(await hasActiveTeachingAssignment(
        user.id,
        administration.course_slug,
        administration.semester,
      )))
  ) {
    return redirect(
      administration.workshop_slug,
      'not_course_instructor',
      false,
    );
  }
  if (administration.cancelled_at) {
    return redirect(administration.workshop_slug, 'window_cancelled', false);
  }
  if (Date.now() < Date.parse(administration.opens_at)) {
    return redirect(administration.workshop_slug, 'window_not_open', false);
  }

  if (operation === 'remove') {
    const { data: attendance, error: attendanceError } = await admin
      .from('workshop_attendance')
      .select(
        'id, stamped_at, verification_method, recorded_by, correction_reason',
      )
      .eq('administration_id', administrationId)
      .eq('user_id', targetUserId)
      .eq('verification_method', 'manual')
      .maybeSingle();
    if (attendanceError) {
      return redirect(
        administration.workshop_slug,
        'attendance_lookup_failed',
        false,
      );
    }
    if (!attendance) {
      return redirect(
        administration.workshop_slug,
        'manual_attendance_not_found',
        false,
      );
    }

    try {
      await logDisclosure({
        actorId: user.id,
        actorRole: role as 'instructor' | 'admin',
        action: 'manage_workshop',
        targetUserId,
        targetResource: administrationId,
        metadata: {
          op: 'request_remove_manual_attendance',
          course: administration.course_slug,
          semester: administration.semester,
          workshop: administration.workshop_slug,
          section: administration.section,
          original_stamped_at: attendance.stamped_at,
          original_recorded_by: attendance.recorded_by,
          original_reason: attendance.correction_reason,
          removal_reason: reason,
        },
        request,
      });
    } catch {
      return redirect(administration.workshop_slug, 'audit_unavailable', false);
    }

    const { data: removed, error: removeError } = await admin.rpc(
      'mutate_workshop',
      {
        p_actor_id: user.id,
        p_administration_id: administrationId,
        p_operation: 'manual_remove',
        p_target_user_id: targetUserId,
        p_reason: reason,
      },
    );
    if (removeError) {
      console.error(
        '[instructor/workshops/attendance] remove_failed',
        removeError,
      );
      return redirect(administration.workshop_slug, 'remove_failed', false);
    }
    if (!removed) {
      return redirect(
        administration.workshop_slug,
        'manual_attendance_not_found',
        false,
      );
    }
    return redirect(administration.workshop_slug, 'attendance_removed', true);
  }

  const { data: targetProfile, error: profileError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', targetUserId)
    .maybeSingle();
  if (profileError) {
    return redirect(
      administration.workshop_slug,
      'profile_lookup_failed',
      false,
    );
  }
  if (!canUseStudentWorkshopAttendance(targetProfile?.role)) {
    return redirect(administration.workshop_slug, 'role_not_student', false);
  }

  const { data: enrollment, error: enrollmentError } = await admin
    .from('enrollments')
    .select('course_slug, semester, section, instructor_id')
    .eq('user_id', targetUserId)
    .eq('course_slug', administration.course_slug)
    .eq('semester', administration.semester)
    .maybeSingle();
  if (enrollmentError) {
    return redirect(
      administration.workshop_slug,
      'enrollment_lookup_failed',
      false,
    );
  }

  const enrollmentMatch = matchWorkshopEnrollment(
    enrollment
      ? {
          courseSlug: enrollment.course_slug,
          semester: enrollment.semester,
          section: enrollment.section,
          instructorId: enrollment.instructor_id,
        }
      : null,
    {
      courseSlug: administration.course_slug,
      semester: administration.semester,
      section: administration.section,
      instructorId: administration.instructor_id,
    },
  );
  if (enrollmentMatch !== 'ok') {
    return redirect(administration.workshop_slug, enrollmentMatch, false);
  }

  const { data: recorded, error } = await admin.rpc('mutate_workshop', {
    p_actor_id: user.id,
    p_administration_id: administrationId,
    p_operation: 'manual_add',
    p_target_user_id: targetUserId,
    p_reason: reason,
  });
  if (error) {
    const result =
      error.code === '23505' ? 'already_recorded' : 'attendance_insert_failed';
    if (result === 'attendance_insert_failed') {
      console.error('[instructor/workshops/attendance] insert_failed', error);
    }
    return redirect(
      administration.workshop_slug,
      result,
      result === 'already_recorded',
    );
  }
  if (!recorded) {
    return redirect(
      administration.workshop_slug,
      'attendance_insert_failed',
      false,
    );
  }

  await logDisclosureSafe({
    actorId: user.id,
    actorRole: role as 'instructor' | 'admin',
    action: 'manage_workshop',
    targetUserId,
    targetResource: administrationId,
    metadata: {
      op: 'manual_attendance',
      course: administration.course_slug,
      semester: administration.semester,
      workshop: administration.workshop_slug,
      section: administration.section,
      reason,
    },
    request,
  });

  return redirect(administration.workshop_slug, 'attendance_recorded', true);
};

function redirect(
  workshopSlug: string | null,
  result: string,
  ok: boolean,
): Response {
  const target = workshopSlug
    ? `/instructor/workshops/${workshopSlug}`
    : '/instructor/workshops';
  return new Response(null, {
    status: 303,
    headers: {
      Location: `${target}?${ok ? 'ok' : 'error'}=${encodeURIComponent(result)}`,
    },
  });
}

function safeWorkshopSlug(value: string): string | null {
  return /^[a-z0-9-]+$/.test(value) ? value : null;
}
