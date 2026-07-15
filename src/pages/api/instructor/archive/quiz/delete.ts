import type { APIRoute } from 'astro';
import { getAdminClient } from '@lib/supabase/admin';
import { isContentManager, isAdmin } from '@lib/roles';
import { instructorOwnsCourse } from '@lib/archive/access';
import { logDisclosureSafe } from '@lib/audit';

function err(reason: string): Response {
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/instructor/archive?error=${encodeURIComponent(reason)}`,
    },
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  const role = locals.profile?.role ?? 'student';

  if (!user) return err('unauthenticated');
  if (!isContentManager(role)) return err('forbidden');
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return err('invalid_input');
  }
  const id = String(form.get('id') ?? '');
  if (!id) return err('invalid_input');

  const admin = getAdminClient();
  const { data: row, error: lookupError } = await admin
    .from('archive_quizzes')
    .select('course_slug, created_by, title')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (lookupError) return err('delete_failed');
  if (!row) return err('not_found');
  if (!(await instructorOwnsCourse(user.id, row.course_slug, role)))
    return err('not_course_instructor');
  if (!isAdmin(role) && row.created_by !== user.id) return err('not_owner');

  const { data: deleted, error } = await admin.rpc('mutate_archive_item', {
    p_actor_id: user.id,
    p_resource: 'quiz',
    p_id: id,
    p_operation: 'delete',
    p_patch: {},
  });
  if (error) return err('delete_failed');
  if (!deleted) return err('not_found');

  await logDisclosureSafe({
    actorId: user.id,
    actorRole: role as 'instructor' | 'admin',
    action: 'manage_archive',
    request,
    targetResource: `quiz delete: ${row.title} (${row.course_slug})`,
    metadata: {
      resource: 'quiz',
      op: 'delete',
      id,
      course: row.course_slug,
    },
  });

  return new Response(null, {
    status: 303,
    headers: { Location: `/instructor/archive?ok=quiz_deleted` },
  });
};
