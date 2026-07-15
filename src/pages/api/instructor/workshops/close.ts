import type { APIRoute } from 'astro';
import { getAdminClient } from '@lib/supabase/admin';
import { isAdmin, isInstructor } from '@lib/roles';
import { logDisclosureSafe } from '@lib/audit';
import { isUuid } from '@lib/workshop-policy';
import { isCourseSlug } from '@lib/courses';
import { hasActiveTeachingAssignment } from '@lib/instructor/class-access';

// Close an active workshop early or preserve an upcoming row as cancelled.
// Instructor only and only for their own administrations.

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
  const administrationId = String(form.get('administration_id') ?? '');
  const workshopSlugHint = safeWorkshopSlug(
    String(form.get('workshop_slug') ?? ''),
  );

  if (!isUuid(administrationId)) {
    return redirect(workshopSlugHint, 'invalid_input', false);
  }

  const admin = getAdminClient();
  const { data: row, error: lookupError } = await admin
    .from('workshop_administrations')
    .select(
      'id, workshop_slug, course_slug, semester, instructor_id, opens_at, closes_at, cancelled_at',
    )
    .eq('id', administrationId)
    .maybeSingle();
  if (lookupError) return redirect(workshopSlugHint, 'lookup_failed', false);
  if (!row) return redirect(workshopSlugHint, 'not_found', false);
  if (!isAdmin(role) && row.instructor_id !== user.id) {
    return redirect(workshopSlugHint, 'forbidden', false);
  }
  if (
    !isAdmin(role) &&
    (!isCourseSlug(row.course_slug) ||
      !(await hasActiveTeachingAssignment(
        user.id,
        row.course_slug,
        row.semester,
      )))
  ) {
    return redirect(row.workshop_slug, 'not_course_instructor', false);
  }

  const now = Date.now();
  const isUpcoming = now < Date.parse(row.opens_at);
  const isClosed = row.cancelled_at != null || now > Date.parse(row.closes_at);
  if (isClosed) {
    return redirect(
      row.workshop_slug,
      row.cancelled_at ? 'cancelled' : 'closed',
    );
  }

  const result = await admin.rpc('mutate_workshop', {
    p_actor_id: user.id,
    p_administration_id: administrationId,
    p_operation: isUpcoming ? 'cancel' : 'close',
    p_target_user_id: null,
    p_reason: null,
  });

  if (result.error || !result.data) {
    return redirect(row.workshop_slug, 'update_failed', false);
  }

  await logDisclosureSafe({
    actorId: user.id,
    actorRole: role as 'instructor' | 'admin',
    action: 'manage_workshop',
    targetResource: administrationId,
    metadata: {
      op: isUpcoming ? 'cancel' : 'close',
      course: row.course_slug,
      semester: row.semester,
      workshop: row.workshop_slug,
    },
    request,
  });

  return redirect(row.workshop_slug, isUpcoming ? 'cancelled' : 'closed');
};

function redirect(
  workshopSlug: string | null,
  result: string,
  ok = true,
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
