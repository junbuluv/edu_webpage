import type { APIRoute } from 'astro';
import { safeNext } from '@lib/auth/safe-next';
import { buildAuthCallbackUrl } from '@lib/auth/callback-url';
import {
  isAllowedEmail,
  allowedDomainsHumanList,
} from '@lib/auth/email-allowlist';
import { CURRENT_TERMS_VERSION } from '@lib/auth/terms';
import { getAdminClient, listAllAuthUsers } from '@lib/supabase/admin';
import {
  classifySignup,
  isStaffSignupRole,
  normalizeStudentId,
} from '@lib/auth/signup-role';
import { hmacPIIHex } from '@lib/crypto/pii';
import { notifyAdminsOfRoleRequest } from '@lib/email/notify';

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

  // Role is a *request*, never an assignment: staff signups are recorded in
  // role_requests below and stay student-level until an admin approves.
  const requestedRole = String(form.get('role') ?? 'student').trim();
  const rawStudentId = String(form.get('student_id') ?? '');
  const signupOutcome = classifySignup({
    role: requestedRole,
    studentId: rawStudentId,
  });
  if (signupOutcome !== 'ok') {
    const message =
      signupOutcome === 'student_id_required'
        ? 'Enter your 8-digit student ID (EMPLID).'
        : signupOutcome === 'student_id_invalid'
          ? 'That student ID does not look right. It should be 8 digits, as shown in CUNYfirst.'
          : 'Choose whether you are a student, lecturer, or teaching assistant.';
    return redirect(
      `/auth/signup?next=${encodeURIComponent(next)}&role=${encodeURIComponent(
        requestedRole,
      )}&error=${encodeURIComponent(message)}`,
    );
  }

  const isStaffRequest = isStaffSignupRole(requestedRole);
  const studentIdHmac = isStaffRequest
    ? null
    : hmacPIIHex(normalizeStudentId(rawStudentId));

  // Reject a duplicate student ID before creating the auth user, so the
  // account and the ID never end up out of step. The unique index is the
  // real guarantee; this check just produces a readable error.
  if (studentIdHmac) {
    const { data: existing, error: lookupError } = await getAdminClient()
      .from('profiles')
      .select('id')
      .eq('student_id_hmac', studentIdHmac)
      .limit(1);
    if (lookupError) {
      console.error('[auth/signup] student_id_lookup_failed', {
        code: lookupError.code,
      });
    } else if ((existing ?? []).length > 0) {
      return redirect(
        `/auth/signup?next=${encodeURIComponent(
          next,
        )}&role=${encodeURIComponent(requestedRole)}&error=${encodeURIComponent(
          'That student ID is already registered. If this is you, sign in instead or use password reset.',
        )}`,
      );
    }
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
  // data.user is NOT reliable here: this project's GoTrue returns a bare user
  // object for confirmation-required signups, which the installed supabase-js
  // maps to null (no error). Relying on it silently skipped every
  // post-signup write, including terms acceptance. Resolve the account
  // through the service role instead, which is version-independent.
  //
  // Freshness guard: signing up with an already-registered email must never
  // write to that account (it would let anyone attach their student ID or a
  // staff request to someone else's profile). A profile created seconds ago
  // is one this request just created; anything older is pre-existing.
  const NEW_ACCOUNT_WINDOW_MS = 60_000;
  try {
    const admin = getAdminClient();
    const account = (await listAllAuthUsers(admin)).find(
      (candidate) => candidate.email?.toLowerCase() === email.toLowerCase(),
    );
    const { data: profile } = account
      ? await admin
          .from('profiles')
          .select('id, created_at, student_id_hmac')
          .eq('id', account.id)
          .maybeSingle()
      : { data: null };

    const isFreshAccount =
      profile != null &&
      Date.now() - Date.parse(profile.created_at) < NEW_ACCOUNT_WINDOW_MS;

    if (isFreshAccount) {
      const userId = profile.id;

      const accepted = await admin.rpc('accept_terms', {
        p_user_id: userId,
        p_policy_version: CURRENT_TERMS_VERSION,
        p_source: 'signup',
      });
      if (accepted.error || accepted.data !== 'accepted') {
        console.error('[auth/signup] terms_acceptance_save_failed', {
          userId,
          code: accepted.error?.code,
        });
      }

      // Never overwrite an ID that is already set.
      if (studentIdHmac && profile.student_id_hmac == null) {
        const { error: idError } = await admin
          .from('profiles')
          .update({ student_id_hmac: studentIdHmac })
          .eq('id', userId);
        if (idError) {
          console.error('[auth/signup] student_id_save_failed', {
            userId,
            code: idError.code,
          });
        }
      }

      if (isStaffRequest) {
        const { error: requestError } = await admin
          .from('role_requests')
          .upsert(
            {
              user_id: userId,
              requested_role: requestedRole as 'instructor' | 'ta',
              status: 'pending',
              requested_at: new Date().toISOString(),
              decided_by: null,
              decided_at: null,
            },
            { onConflict: 'user_id' },
          );
        if (requestError) {
          console.error('[auth/signup] role_request_save_failed', {
            userId,
            code: requestError.code,
          });
        } else {
          // Fail-open: a mail outage must not break account creation.
          await notifyAdminsOfRoleRequest({
            email,
            requestedRole: requestedRole as 'instructor' | 'ta',
          });
        }
      }
    }
  } catch (postSignupError) {
    console.error('[auth/signup] post_signup_write_failed', {
      error:
        postSignupError instanceof Error
          ? postSignupError.message
          : String(postSignupError),
    });
  }
  return redirect('/auth/check-email');
};
