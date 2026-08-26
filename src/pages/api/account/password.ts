import type { APIRoute } from 'astro';

const MIN_PASSWORD_LEN = 8;

// Signed-in password change with re-authentication: verifying the current
// password via signInWithPassword before updateUser means a walk-up on an
// unlocked machine can't take over the account. (The recovery flow, which
// legitimately has no current password, lives at /api/auth/reset and is
// restricted to recovery-link sessions.)
export const POST: APIRoute = async ({ request, redirect, locals }) => {
  if (!locals.supabase) return redirect('/auth/setup-required');
  if (!locals.user?.email) {
    return redirect('/auth/signin?next=/account/password');
  }

  const form = await request.formData();
  const currentPassword = String(form.get('current_password') ?? '');
  const password = String(form.get('password') ?? '');

  if (password.length < MIN_PASSWORD_LEN) {
    return redirect(
      `/account/password?error=${encodeURIComponent(
        `New password must be at least ${MIN_PASSWORD_LEN} characters.`,
      )}`,
    );
  }
  if (password === currentPassword) {
    return redirect(
      '/account/password?error=New+password+must+differ+from+the+current+one.',
    );
  }

  const reauth = await locals.supabase.auth.signInWithPassword({
    email: locals.user.email,
    password: currentPassword,
  });
  if (reauth.error) {
    return redirect('/account/password?error=Current+password+is+incorrect.');
  }

  const { error } = await locals.supabase.auth.updateUser({ password });
  if (error) {
    return redirect(
      `/account/password?error=${encodeURIComponent(error.message)}`,
    );
  }
  return redirect('/account/password?ok=1');
};
