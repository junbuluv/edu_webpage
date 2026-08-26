import type { APIRoute } from 'astro';
import { safeNext } from '@lib/auth/safe-next';

// Cross-device email confirmation. The Supabase email templates link here
// with ?token_hash=...&type=..., and verifyOtp validates the hash entirely
// server-side — unlike the PKCE ?code= flow handled by /auth/callback,
// no browser-local code-verifier cookie is needed, so the link works from
// any device or mail app, not just the browser that started signup.
//
// Requires the dashboard email templates to link
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
// (signup confirmation) and
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/reset
// (password reset). /auth/callback stays for any legacy ?code= links.

const OTP_TYPES = new Set(['email', 'signup', 'recovery', 'email_change']);

export const GET: APIRoute = async ({ url, redirect, locals }) => {
  if (!locals.supabase) return redirect('/auth/setup-required');

  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') ?? '';
  const next = safeNext(
    url.searchParams.get('next') ?? (type === 'recovery' ? '/auth/reset' : '/'),
  );

  if (!tokenHash || !OTP_TYPES.has(type)) {
    return redirect('/auth/signin?error=Invalid+confirmation+link');
  }

  const { error } = await locals.supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as 'email' | 'signup' | 'recovery' | 'email_change',
  });
  if (error) {
    // A consumed link usually means a scanner (e.g. Outlook SafeLinks)
    // pre-fetched it: the email is typically already confirmed, so steer
    // the user to sign in rather than a dead end.
    return redirect(
      '/auth/signin?error=' +
        encodeURIComponent(
          'That confirmation link was already used or expired. Your email is likely already confirmed: try signing in.',
        ),
    );
  }
  return redirect(next);
};
