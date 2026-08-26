import type { APIRoute } from 'astro';
import { isRecoverySession } from '@lib/auth/session-amr';

const MIN_PASSWORD_LEN = 8;

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  if (!locals.supabase) return redirect('/auth/setup-required');
  if (!locals.user) {
    return redirect(
      '/auth/signin?error=Reset+link+expired%2C+request+a+new+one',
    );
  }
  // Only recovery-link sessions may set a password without providing the
  // current one; normally signed-in users go through /account/password.
  if (!(await isRecoverySession(locals.supabase))) {
    return redirect('/account/password');
  }

  const form = await request.formData();
  const password = String(form.get('password') ?? '');
  if (password.length < MIN_PASSWORD_LEN) {
    return redirect(
      `/auth/reset?error=${encodeURIComponent(
        `Password must be at least ${MIN_PASSWORD_LEN} characters.`,
      )}`,
    );
  }

  const { error } = await locals.supabase.auth.updateUser({ password });
  if (error) {
    return redirect(`/auth/reset?error=${encodeURIComponent(error.message)}`);
  }
  return redirect('/dashboard');
};
