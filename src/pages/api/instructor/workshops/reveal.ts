import type { APIRoute } from 'astro';
import { getAdminClient } from '@lib/supabase/admin';
import { isAdmin, isInstructor } from '@lib/roles';
import { logDisclosureSafe } from '@lib/audit';
import { isUuid } from '@lib/workshop-policy';
import { isCourseSlug } from '@lib/courses';
import { hasActiveTeachingAssignment } from '@lib/instructor/class-access';

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  const role = locals.profile?.role ?? 'student';
  if (!user) return redirect(null, 'unauthenticated');
  if (!isInstructor(role)) return redirect(null, 'forbidden');
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return redirect(null, 'invalid_input');
  }
  const administrationId = String(form.get('administration_id') ?? '');
  const workshopSlugHint = safeWorkshopSlug(
    String(form.get('workshop_slug') ?? ''),
  );
  if (!isUuid(administrationId)) {
    return redirect(workshopSlugHint, 'invalid_input');
  }

  const admin = getAdminClient();
  const { data: row, error: lookupError } = await admin
    .from('workshop_administrations')
    .select(
      'id, workshop_slug, course_slug, semester, section, instructor_id, opens_at, cancelled_at, questions_revealed_at',
    )
    .eq('id', administrationId)
    .maybeSingle();
  if (lookupError) return redirect(workshopSlugHint, 'lookup_failed');
  if (!row) return redirect(workshopSlugHint, 'not_found');
  if (!isAdmin(role) && row.instructor_id !== user.id) {
    return redirect(workshopSlugHint, 'forbidden');
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
    return redirect(row.workshop_slug, 'not_course_instructor');
  }
  if (row.cancelled_at) return redirect(row.workshop_slug, 'window_cancelled');
  if (Date.now() < Date.parse(row.opens_at)) {
    return redirect(row.workshop_slug, 'window_not_open');
  }

  if (row.questions_revealed_at == null) {
    const { data: revealed, error } = await admin.rpc('mutate_workshop', {
      p_actor_id: user.id,
      p_administration_id: administrationId,
      p_operation: 'reveal',
      p_target_user_id: null,
      p_reason: null,
    });
    if (error || !revealed) return redirect(row.workshop_slug, 'update_failed');

    await logDisclosureSafe({
      actorId: user.id,
      actorRole: role as 'instructor' | 'admin',
      action: 'manage_workshop',
      targetResource: administrationId,
      metadata: {
        op: 'reveal_questions',
        course: row.course_slug,
        semester: row.semester,
        workshop: row.workshop_slug,
        section: row.section,
      },
      request,
    });
  }

  return new Response(null, {
    status: 303,
    headers: {
      Location: `/instructor/workshops/${row.workshop_slug}?ok=revealed`,
    },
  });
};

function redirect(workshopSlug: string | null, error: string): Response {
  const target = workshopSlug
    ? `/instructor/workshops/${workshopSlug}`
    : '/instructor/workshops';
  return new Response(null, {
    status: 303,
    headers: {
      Location: `${target}?error=${encodeURIComponent(error)}`,
    },
  });
}

function safeWorkshopSlug(value: string): string | null {
  return /^[a-z0-9-]+$/.test(value) ? value : null;
}
