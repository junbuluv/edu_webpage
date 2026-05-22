import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  if (!locals.supabase) return redirect('/auth/setup-required');

  const form = await request.formData();
  const email = String(form.get('email') ?? '').trim();

  // Always pretend success — do not leak which emails are registered.
  await locals.supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${import.meta.env.PUBLIC_SITE_URL}/auth/reset`,
  });

  return redirect(`/auth/forgot?sent=${encodeURIComponent(email)}`);
};
