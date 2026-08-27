import type { APIRoute } from 'astro';
import { getAdminClient } from '@lib/supabase/admin';
import { isAdmin } from '@lib/roles';
import { logDisclosureSafe } from '@lib/audit';
import { classifyRoleDecision } from '@lib/admin/role-decision';
import { isUuid } from '@lib/workshop-policy';

// Approve or deny a staff-access request made at signup. This is the only
// path (besides SQL) that turns a requested role into a real one, so it is
// admin-gated here as well as by the /admin middleware prefix — /api/admin/*
// is not covered by that gate (convention: see assign-role.ts).
//
// Redirects to the page, never the API URL (convention #16).
function redirect(qs: string): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: `/admin?${qs}` },
  });
}
const err = (reason: string) =>
  redirect(`request_error=${encodeURIComponent(reason)}`);
const ok = (reason: string) =>
  redirect(`request_ok=${encodeURIComponent(reason)}`);

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  const actorRole = locals.profile?.role ?? 'student';

  if (!user) return err('unauthenticated');
  if (!isAdmin(actorRole)) return err('forbidden');

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return err('invalid_input');
  }
  const targetId = String(form.get('user_id') ?? '').trim();
  const decision = String(form.get('decision') ?? '').trim();
  if (!isUuid(targetId)) return err('invalid_input');

  const admin = getAdminClient();

  // Read the request and the target's current role together; both feed the
  // decision classifier.
  const [requestRes, profileRes] = await Promise.all([
    admin
      .from('role_requests')
      .select('requested_role, status')
      .eq('user_id', targetId)
      .maybeSingle(),
    admin.from('profiles').select('role').eq('id', targetId).maybeSingle(),
  ]);
  if (requestRes.error || profileRes.error) return err('lookup_failed');

  const outcome = classifyRoleDecision({
    decision,
    exists: Boolean(requestRes.data && profileRes.data),
    status: requestRes.data?.status ?? '',
    currentRole: profileRes.data?.role ?? '',
  });
  if (outcome !== 'ok') return err(outcome);

  const requestedRole = requestRes.data!.requested_role;
  const approving = decision === 'approve';

  // Apply the role first: if the status write below fails, the request stays
  // pending and can be retried, which is safer than a granted role with no
  // record of who granted it.
  if (approving) {
    const { error: roleError } = await admin
      .from('profiles')
      .update({ role: requestedRole })
      .eq('id', targetId);
    if (roleError) return err('update_failed');
  }

  const { error: statusError } = await admin
    .from('role_requests')
    .update({
      status: approving ? 'approved' : 'denied',
      decided_by: user.id,
      decided_at: new Date().toISOString(),
    })
    .eq('user_id', targetId);
  if (statusError) return err('update_failed');

  await logDisclosureSafe({
    actorId: user.id,
    actorRole: actorRole as 'instructor' | 'ta' | 'admin',
    action: 'promote_role',
    targetUserId: targetId,
    metadata: {
      via: 'signup_request',
      requested_role: requestedRole,
      decision: approving ? 'approved' : 'denied',
    },
    request,
  });

  return ok(approving ? 'approved' : 'denied');
};
