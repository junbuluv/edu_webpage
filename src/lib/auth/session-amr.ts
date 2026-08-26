import type { SupabaseServerClient } from '@lib/supabase/server';

// Authentication methods recorded in the session JWT's `amr` claim.
// A password-reset link signs the user in via an email OTP flow; a normal
// signin records 'password'. Used to keep the no-current-password reset
// endpoint reserved for recovery-link sessions.
export const RECOVERY_AMR_METHODS = new Set([
  'otp',
  'recovery',
  'magiclink',
  'email_link',
  'email_otp',
]);

/**
 * Best-effort read of the session's `amr` method list. Returns null when it
 * can't be determined (no session, opaque token, malformed payload) — callers
 * should fail open on null so an odd token never strands a genuine
 * recovery-link user, while normal password sessions (which decode fine and
 * carry method 'password') are still distinguished.
 */
export async function sessionAmrMethods(
  supabase: NonNullable<SupabaseServerClient>,
): Promise<string[] | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return null;
    const payload = JSON.parse(
      Buffer.from(
        payloadPart.replace(/-/g, '+').replace(/_/g, '/'),
        'base64',
      ).toString('utf8'),
    ) as { amr?: Array<{ method?: unknown }> };
    if (!Array.isArray(payload.amr)) return null;
    const methods = payload.amr
      .map((entry) => entry?.method)
      .filter((m): m is string => typeof m === 'string');
    return methods.length > 0 ? methods : null;
  } catch {
    return null;
  }
}

/** True when the session came in through a recovery-style link (or when the
 *  amr claim can't be read — fail open, see sessionAmrMethods). */
export async function isRecoverySession(
  supabase: NonNullable<SupabaseServerClient>,
): Promise<boolean> {
  const methods = await sessionAmrMethods(supabase);
  if (methods === null) return true;
  return methods.some((m) => RECOVERY_AMR_METHODS.has(m));
}
