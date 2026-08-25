import type { APIRoute } from 'astro';
import { isAdmin } from '@lib/roles';
import { getAdminClient, listAllAuthUsers } from '@lib/supabase/admin';
import { cleanPaperUploadIntentsForActor } from '@lib/archive/upload-intent-cleanup';
import { logDisclosure } from '@lib/audit';

const CONFIRM_PHRASE = 'offboard staff account';

function back(reason: string, ok = false): Response {
  const key = ok ? 'offboard_ok' : 'offboard_error';
  return new Response(null, {
    status: 303,
    headers: { location: `/admin?${key}=${encodeURIComponent(reason)}` },
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return back('unauthenticated');
  if (!isAdmin(locals.profile?.role)) return back('forbidden');

  const form = await request.formData();
  const targetEmail = String(form.get('target_email') ?? '')
    .trim()
    .toLowerCase();
  const successorEmail = String(form.get('successor_email') ?? '')
    .trim()
    .toLowerCase();
  const confirmation = String(form.get('confirm') ?? '')
    .trim()
    .toLowerCase();
  if (
    !targetEmail ||
    !successorEmail ||
    targetEmail === successorEmail ||
    confirmation !== CONFIRM_PHRASE
  ) {
    return back('invalid_input');
  }

  const admin = getAdminClient();
  let accounts: Awaited<ReturnType<typeof listAllAuthUsers>>;
  try {
    accounts = await listAllAuthUsers(admin);
  } catch {
    return back('lookup_failed');
  }
  const targetId = accounts.find(
    (account) => account.email?.toLowerCase() === targetEmail,
  )?.id;
  const successorId = accounts.find(
    (account) => account.email?.toLowerCase() === successorEmail,
  )?.id;
  if (!targetId || !successorId) return back('no_account');
  if (targetId === locals.user.id) return back('cannot_offboard_self');

  const profiles = await admin
    .from('profiles')
    .select('id, role')
    .in('id', [targetId, successorId]);
  if (profiles.error) return back('lookup_failed');
  const targetRole = profiles.data?.find(
    (profile) => profile.id === targetId,
  )?.role;
  const successorRole = profiles.data?.find(
    (profile) => profile.id === successorId,
  )?.role;
  if (!targetRole || !successorRole) return back('no_account');
  if (targetRole === 'admin') return back('cannot_offboard_admin');
  if (successorRole !== 'instructor') return back('successor_not_instructor');

  const transferred = await admin.rpc('offboard_staff', {
    p_actor_id: locals.user.id,
    p_target_id: targetId,
    p_successor_id: successorId,
  });
  if (transferred.error) {
    console.error('[admin/offboard] transfer_failed', {
      code: transferred.error.code,
    });
    return back('transfer_failed');
  }
  if (!['offboarded', 'already_offboarded'].includes(transferred.data ?? '')) {
    return back(
      transferred.data === 'invalid_roles' && targetRole === 'student'
        ? 'target_not_staff'
        : String(transferred.data ?? 'transfer_rejected'),
    );
  }

  const cleanup = await cleanPaperUploadIntentsForActor(targetId, 1000);
  if (!cleanup.ok) return back('cleanup_failed');
  const remainingUploads = await admin
    .from('archive_paper_upload_intents')
    .select('id', { count: 'exact', head: true })
    .eq('actor_id', targetId)
    .in('state', ['pending', 'expired']);
  if (remainingUploads.error || (remainingUploads.count ?? 0) > 0) {
    return back('cleanup_failed');
  }

  try {
    await logDisclosure({
      actorId: locals.user.id,
      actorRole: 'admin',
      action: 'offboard_staff',
      targetUserId: targetId,
      targetResource: 'staff account offboarding',
      metadata: { successorId },
      request,
    });
  } catch {
    return back('audit_failed');
  }

  const deletedUser = await admin.auth.admin.deleteUser(targetId);
  if (deletedUser.error) {
    console.error('[admin/offboard] auth_delete_failed', {
      code: deletedUser.error.code,
    });
    return back('auth_delete_failed');
  }
  return back('completed', true);
};
