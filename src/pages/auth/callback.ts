import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url, redirect, locals }) => {
  if (!locals.supabase) return redirect('/auth/setup-required');

  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';
  if (!code) return redirect('/auth/login?error=Missing+code');

  const { error } = await locals.supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return redirect(
      `/auth/login?error=${encodeURIComponent(error.message)}`,
    );
  }
  return redirect(next);
};
