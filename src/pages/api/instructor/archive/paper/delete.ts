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
  const form = await request.formData();
  const id = String(form.get('id') ?? '');

  if (!user) return err('unauthenticated');
  if (!isContentManager(role)) return err('forbidden');
  if (!id) return err('invalid_input');

  const admin = getAdminClient();
  const { data: row } = await admin
    .from('archive_papers')
    .select('course_slug, created_by, title')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!row) return err('not_found');
  if (!(await instructorOwnsCourse(user.id, row.course_slug, role)))
    return err('not_course_instructor');
  if (!isAdmin(role) && row.created_by !== user.id) return err('not_owner');

  const { error } = await admin
    .from('archive_papers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null);
  if (error) return err('delete_failed');

  await logDisclosureSafe({
    actorId: user.id,
    actorRole: role as 'instructor' | 'admin',
    action: 'manage_archive',
    request,
    targetResource: `paper delete: ${row.title} (${row.course_slug})`,
    metadata: {
      resource: 'paper',
      op: 'delete',
      id,
      course: row.course_slug,
    },
  });

  return new Response(null, {
    status: 303,
    headers: { Location: `/instructor/archive?ok=paper_deleted` },
  });
};
