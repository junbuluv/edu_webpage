import type { APIRoute } from 'astro';
import { getAdminClient, selectAllRows } from '@lib/supabase/admin';
import { PAPER_UPLOAD_BUCKET } from '@lib/archive/paper-upload';
import { clearWorkshopDeviceId } from '@lib/device';

const CONFIRM_PHRASE = 'delete my account';

export const POST: APIRoute = async ({
  request,
  redirect,
  locals,
  cookies,
}) => {
  if (!locals.supabase) return redirect('/auth/setup-required');
  if (!locals.user) return redirect('/auth/signin?next=/account/delete');
  if ((locals.profile?.role ?? 'student') !== 'student') {
    return redirect(
      '/account/delete?error=Staff accounts require admin-assisted offboarding so institutional teaching records and access changes remain controlled.',
    );
  }

  const form = await request.formData();
  const confirm = String(form.get('confirm') ?? '')
    .trim()
    .toLowerCase();
  if (confirm !== CONFIRM_PHRASE) {
    return redirect(
      `/account/delete?error=${encodeURIComponent(
        `Please type "${CONFIRM_PHRASE}" exactly to confirm.`,
      )}`,
    );
  }

  const userId = locals.user.id;
  const admin = getAdminClient();

  const checks = await Promise.all([
    admin
      .from('enrollments')
      .select('user_id', { count: 'exact', head: true })
      .eq('instructor_id', userId),
    admin
      .from('teaching_assignments')
      .select('instructor_id', { count: 'exact', head: true })
      .eq('instructor_id', userId),
    admin
      .from('workshop_administrations')
      .select('id', { count: 'exact', head: true })
      .eq('instructor_id', userId),
    admin
      .from('archive_videos')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', userId),
    admin
      .from('archive_papers')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', userId),
    admin
      .from('archive_quizzes')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', userId),
  ]);
  if (checks.some((result) => result.error)) {
    return redirect(
      '/account/delete?error=Could not verify account ownership. Please try again.',
    );
  }
  if (checks.some((result) => (result.count ?? 0) > 0)) {
    return redirect(
      '/account/delete?error=This staff account owns institutional teaching records that self-service deletion must preserve. Ask an admin to complete the ownership-retention and account-offboarding process.',
    );
  }

  const intents = await selectAllRows<{ id: string; storage_path: string }>(
    (from, to) =>
      admin
        .from('archive_paper_upload_intents')
        .select('id, storage_path')
        .eq('actor_id', userId)
        .order('id', { ascending: true })
        .range(from, to),
  );
  if (intents.error) {
    return redirect(
      '/account/delete?error=Could not verify pending uploads. Please try again.',
    );
  }
  for (let start = 0; start < intents.rows.length; start += 100) {
    const paths = intents.rows
      .slice(start, start + 100)
      .map((intent) => intent.storage_path);
    if (paths.length === 0) continue;
    const removed = await admin.storage.from(PAPER_UPLOAD_BUCKET).remove(paths);
    if (removed.error) {
      return redirect(
        '/account/delete?error=Could not remove a pending archive upload. Please try again.',
      );
    }
  }
  if (intents.rows.length > 0) {
    const { error: intentDeleteError } = await admin
      .from('archive_paper_upload_intents')
      .delete()
      .eq('actor_id', userId);
    if (intentDeleteError) {
      return redirect(
        '/account/delete?error=Could not clear pending uploads. Please try again.',
      );
    }
  }

  const { error: authErr } = await admin.auth.admin.deleteUser(userId);
  if (authErr) {
    console.error('[account/delete] auth_delete_failed', {
      userId,
      code: authErr.code,
    });
    return redirect(
      '/account/delete?error=Account deletion could not be completed. Please try again.',
    );
  }

  await locals.supabase.auth.signOut();
  clearWorkshopDeviceId(cookies);
  return redirect('/?deleted=1');
};
