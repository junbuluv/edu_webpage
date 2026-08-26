import type { APIRoute } from 'astro';
import { safeNext } from '@lib/auth/safe-next';

export const GET: APIRoute = async ({ url, redirect, locals }) => {
  if (!locals.supabase) return redirect('/auth/setup-required');

  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'));
  if (!code) return redirect('/auth/signin?error=Missing+code');

  const { error } = await locals.supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // The PKCE code verifier lives in the browser that started the flow, so
    // opening the link on another device fails here even though the email
    // verification itself already succeeded. Say so instead of leaking the
    // cryptic PKCE message. (New emails use /auth/confirm, which is
    // cross-device; this handles legacy links.)
    const friendly = /code verifier/i.test(error.message)
      ? 'This link only completes in the browser you signed up from, but your email is likely already confirmed: try signing in.'
      : error.message;
    return redirect(`/auth/signin?error=${encodeURIComponent(friendly)}`);
  }
  return redirect(next);
};
