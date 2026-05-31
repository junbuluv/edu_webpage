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

  // Cascade order: app rows first (have FK to profiles), then auth.users.
  // profiles row has ON DELETE CASCADE from auth.users, so deleting the
  // auth user removes profiles too. But lesson_progress/quiz_attempts also
  // cascade from profiles. Explicit deletes give clearer audit visibility
  // even if cascading would handle it.
  await admin.from('quiz_attempts').delete().eq('user_id', userId);
  await admin.from('lesson_progress').delete().eq('user_id', userId);
  await admin.from('enrollments').delete().eq('user_id', userId);

  const { error: authErr } = await admin.auth.admin.deleteUser(userId);
  if (authErr) {
    return redirect(
      `/account/delete?error=${encodeURIComponent(authErr.message)}`,
    );
  }

  await locals.supabase.auth.signOut();
  return redirect('/?deleted=1');
};
