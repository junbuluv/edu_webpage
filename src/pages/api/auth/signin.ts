import type { APIRoute } from 'astro';
import { safeNext } from '@lib/auth/safe-next';

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  if (!locals.supabase) return redirect('/auth/setup-required');

  const form = await request.formData();
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  const next = safeNext(String(form.get('next') ?? '/'));

  const { error } = await locals.supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return redirect(
      `/auth/signin?next=${encodeURIComponent(next)}&error=${encodeURIComponent(error.message)}`,
    );
  }
  return redirect(next);
};
