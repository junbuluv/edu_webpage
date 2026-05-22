import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  if (!locals.supabase) return redirect('/auth/setup-required');

  const form = await request.formData();
  const email = String(form.get('email') ?? '');
  const password = String(form.get('password') ?? '');
  const next = String(form.get('next') ?? '/');

  const { error } = await locals.supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return redirect(
      `/auth/login?next=${encodeURIComponent(next)}&error=${encodeURIComponent(error.message)}`,
    );
  }
  return redirect(next);
};
