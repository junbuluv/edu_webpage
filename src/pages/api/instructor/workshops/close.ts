import type { APIRoute } from 'astro';
import { getAdminClient } from '@lib/supabase/admin';
import { isStaff } from '@lib/roles';

// Close a workshop_administrations window early by setting closes_at to
// now. Instructor only and only for their own administrations.

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  const role = locals.profile?.role ?? 'student';
  if (!user) return new Response(null, { status: 401 });
  if (!isStaff(role)) {
    return new Response(null, { status: 403 });
  }

  const form = await request.formData();
  const administrationId = String(form.get('administration_id') ?? '');
  if (!administrationId)
    return new Response('missing administration_id', { status: 400 });

  const admin = getAdminClient();
  const { data: row } = await admin
    .from('workshop_administrations')
    .select('id, workshop_slug, instructor_id')
    .eq('id', administrationId)
    .maybeSingle();
  if (!row) return new Response('not found', { status: 404 });
  // Admins and TAs can close any window; instructors only their own.
  if (role === 'instructor' && row.instructor_id !== user.id) {
    return new Response('not owner', { status: 403 });
  }

  const { error } = await admin
    .from('workshop_administrations')
    .update({ closes_at: new Date().toISOString() })
    .eq('id', administrationId);

  if (error)
    return new Response(`update_failed: ${error.message}`, { status: 500 });

  return new Response(null, {
    status: 303,
    headers: {
      Location: `/instructor/workshops/${row.workshop_slug}?ok=closed`,
    },
  });
};
