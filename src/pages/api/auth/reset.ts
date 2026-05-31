import type { APIRoute } from 'astro';

const MIN_PASSWORD_LEN = 12;

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  if (!locals.supabase) return redirect('/auth/setup-required');
  if (!locals.user) {
    return redirect(
      '/auth/signin?error=Reset+link+expired%2C+request+a+new+one',
    );
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
