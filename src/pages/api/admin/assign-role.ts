import type { APIRoute } from 'astro';
import { getAdminClient, listAllAuthUsers } from '@lib/supabase/admin';
import { isAdmin } from '@lib/roles';
import { logDisclosureSafe } from '@lib/audit';
import { classifyRoleAssign, isAssignableRole } from '@lib/admin/role-assign';

// Redirect back to the page that originated the form, never the API URL
// (convention #16). /api/admin/* is NOT covered by the middleware admin gate
// (it matches '/admin' only), so this handler self-gates on isAdmin.
function redirect(qs: string): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: `/admin?${qs}` },
  });
}
const err = (reason: string) => redirect(`error=${encodeURIComponent(reason)}`);
const ok = (reason: string) => redirect(`ok=${encodeURIComponent(reason)}`);

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  const role = locals.profile?.role ?? 'student';

  if (!user) return err('unauthenticated');
  if (!isAdmin(role)) return err('forbidden');

  const form = await request.formData();
  const email = String(form.get('email') ?? '')
    .trim()
    .toLowerCase();
  const requestedRole = String(form.get('role') ?? '').trim();

  if (!email || !requestedRole) return err('invalid_input');
  // Reject anything outside student/instructor/ta up front (e.g. a forged
  // 'admin' value) before touching the auth user list.
  if (!isAssignableRole(requestedRole)) return err('invalid_role');

  // The target must already have an account. Email lookup can throw on a
  // missing service-role env or transient auth-API failure; degrade to a
  // banner rather than a raw 500.
  let admin: ReturnType<typeof getAdminClient>;
  let targetId: string | null;
  try {
    admin = getAdminClient();
    const users = await listAllAuthUsers();
    targetId = users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
  } catch {
    return err('lookup_failed');
  }
  if (!targetId) return err('no_account');

  // Read the current role; never modify an existing admin (anti-phishing).
  // Keyed on the profiles PK (id), so maybeSingle matches at most one row.
  const { data: targetProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', targetId)
    .maybeSingle();
  if (!targetProfile) return err('no_account');
  const currentRole = targetProfile.role ?? 'student';

  const outcome = classifyRoleAssign({
    requestedRole,
    emailFound: true,
    currentRole,
  });
  // A no-op (target already has this role) is benign: skip the redundant
  // UPDATE and the misleading 'set role X -> X' audit entry it would write.
  if (outcome === 'no_change') return ok('role_unchanged');
  if (outcome !== 'ok') return err(outcome);

  const { error } = await admin
    .from('profiles')
    .update({ role: requestedRole })
    .eq('id', targetId);
  if (error) return err('update_failed');

  // The role change has already committed. Record it — but a privilege change
  // must not land with no audit trail and no signal. logDisclosureSafe returns
  // false when the audit write fails (convention #10 fail-open), so surface
  // that to the admin instead of silently reporting plain success.
  const audited = await logDisclosureSafe({
    actorId: user.id,
    actorRole: role as 'instructor' | 'ta' | 'admin',
    action: 'promote_role',
    targetUserId: targetId,
    // No email here — target_resource is human-readable, not for PII.
    targetResource: `set role ${currentRole} -> ${requestedRole}`,
    metadata: { from: currentRole, to: requestedRole },
    request,
  });

  return audited ? ok('role_set') : err('role_set_unaudited');
};
