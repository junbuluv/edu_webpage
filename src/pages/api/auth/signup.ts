import type { APIRoute } from 'astro';
import { safeNext } from '@lib/auth/safe-next';

const MIN_PASSWORD_LEN = 12;

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  if (!locals.supabase) return redirect('/auth/setup-required');

  const form = await request.formData();
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  const next = safeNext(String(form.get('next') ?? '/'));

  if (password.length < MIN_PASSWORD_LEN) {
    return redirect(
      `/auth/signup?next=${encodeURIComponent(next)}&error=${encodeURIComponent(
        `Password must be at least ${MIN_PASSWORD_LEN} characters.`,
      )}`,
    );
  }

  const { error } = await locals.supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${import.meta.env.PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    return redirect(
      `/auth/signup?next=${encodeURIComponent(next)}&error=${encodeURIComponent(error.message)}`,
    );
  }
  return redirect(`/auth/check-email?email=${encodeURIComponent(email)}`);
};
