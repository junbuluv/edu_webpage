import type { APIRoute } from 'astro';
import { safeNext } from '@lib/auth/safe-next';
import { buildAuthCallbackUrl } from '@lib/auth/callback-url';
import {
  isAllowedEmail,
  allowedDomainsHumanList,
} from '@lib/auth/email-allowlist';
import { CURRENT_TERMS_VERSION } from '@lib/auth/terms';
import { getAdminClient } from '@lib/supabase/admin';

const MIN_PASSWORD_LEN = 8;

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  if (!locals.supabase) return redirect('/auth/setup-required');

  const form = await request.formData();
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  const next = safeNext(String(form.get('next') ?? '/'));
  const acceptedTerms = form.get('accept_terms') === 'yes';

  if (!isAllowedEmail(email)) {
    return redirect(
      `/auth/signup?next=${encodeURIComponent(next)}&error=${encodeURIComponent(
        `Please sign up with an accepted email domain: ${allowedDomainsHumanList()}.`,
      )}`,
    );
  }

  if (password.length < MIN_PASSWORD_LEN) {
    return redirect(
      `/auth/signup?next=${encodeURIComponent(next)}&error=${encodeURIComponent(
        `Password must be at least ${MIN_PASSWORD_LEN} characters.`,
      )}`,
    );
  }
  if (!acceptedTerms) {
    return redirect(
      `/auth/signup?next=${encodeURIComponent(next)}&error=${encodeURIComponent(
        'You must accept the Terms of Service and acknowledge the Privacy Policy.',
      )}`,
    );
  }

  const { data, error } = await locals.supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: buildAuthCallbackUrl(
        import.meta.env.PUBLIC_SITE_URL || import.meta.env.VERCEL_URL,
        request.url,
        next,
      ),
    },
  });

  if (error) {
    console.error('[auth/signup] signup_failed', {
      name: error.name,
      status: error.status,
      code: error.code,
    });
    return redirect(
      `/auth/signup?next=${encodeURIComponent(next)}&error=${encodeURIComponent(
        'Account creation could not be completed. Please retry.',
      )}`,
    );
  }
  if (data.user) {
    try {
      const accepted = await getAdminClient().rpc('accept_terms', {
        p_user_id: data.user.id,
        p_policy_version: CURRENT_TERMS_VERSION,
        p_source: 'signup',
      });
      if (accepted.error || accepted.data !== 'accepted') {
        console.error('[auth/signup] terms_acceptance_save_failed', {
          userId: data.user.id,
          code: accepted.error?.code,
        });
      }
    } catch (acceptanceError) {
      console.error('[auth/signup] terms_acceptance_save_failed', {
        userId: data.user.id,
        error:
          acceptanceError instanceof Error
            ? acceptanceError.message
            : String(acceptanceError),
      });
    }
  }
  return redirect('/auth/check-email');
};
