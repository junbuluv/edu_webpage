import type { APIRoute } from 'astro';
import { CURRENT_TERMS_VERSION } from '@lib/auth/terms';
import { safeNext } from '@lib/auth/safe-next';
import { getAdminClient } from '@lib/supabase/admin';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  if (!locals.supabase) return redirect('/auth/setup-required');
  if (!locals.user) return redirect('/auth/signin?next=/account/terms');

  const form = await request.formData();
  const next = safeNext(String(form.get('next') ?? '/dashboard'));
  if (
    form.get('accept_terms') !== 'yes' ||
    form.get('policy_version') !== CURRENT_TERMS_VERSION
  ) {
    return redirect(
      `/account/terms?next=${encodeURIComponent(next)}&error=acceptance_required`,
    );
  }

  try {
    const accepted = await getAdminClient().rpc('accept_terms', {
      p_user_id: locals.user.id,
      p_policy_version: CURRENT_TERMS_VERSION,
      p_source: 'account_gate',
    });
    if (accepted.error || accepted.data !== 'accepted') {
      console.error('[account/terms] acceptance_save_failed', {
        userId: locals.user.id,
        code: accepted.error?.code,
      });
      return redirect(
        `/account/terms?next=${encodeURIComponent(next)}&error=save_failed`,
      );
    }
  } catch (error) {
    console.error('[account/terms] acceptance_save_failed', {
      userId: locals.user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return redirect(
      `/account/terms?next=${encodeURIComponent(next)}&error=save_failed`,
    );
  }

  return redirect(next);
};
