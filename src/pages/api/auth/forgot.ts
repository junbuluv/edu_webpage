import type { APIRoute } from 'astro';
import { buildAuthCallbackUrl } from '@lib/auth/callback-url';

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  if (!locals.supabase) return redirect('/auth/setup-required');

  const form = await request.formData();
  const email = String(form.get('email') ?? '').trim();

  // Always pretend success — do not leak which emails are registered.
  const { error } = await locals.supabase.auth.resetPasswordForEmail(email, {
    redirectTo: buildAuthCallbackUrl(
      import.meta.env.PUBLIC_SITE_URL || import.meta.env.VERCEL_URL,
      request.url,
      '/auth/reset',
    ),
  });
  if (error) {
    console.error('[auth/forgot] reset_email_failed', {
      name: error.name,
      status: error.status,
      code: error.code,
    });
  }

  return redirect('/auth/forgot?sent=1');
};
