import type { APIRoute } from 'astro';
import { getAdminClient } from '@lib/supabase/admin';

const CONFIRM_PHRASE = 'delete my account';

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  if (!locals.supabase) return redirect('/auth/setup-required');
  if (!locals.user) return redirect('/auth/signin?next=/account/delete');

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
      '/account/delete?error=Transfer or remove your instructor-managed classes, workshops, and archive content before deleting this account.',
    );
  }

  const { error: authErr } = await admin.auth.admin.deleteUser(userId);
  if (authErr) {
    return redirect(
      `/account/delete?error=${encodeURIComponent(authErr.message)}`,
    );
  }

  await locals.supabase.auth.signOut();
  return redirect('/?deleted=1');
};
