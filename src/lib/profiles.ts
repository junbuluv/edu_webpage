// Profile-lookup helpers. Plaintext email is never queried from
// public.profiles — only via auth.users (admin client) or via the HMAC
// index for "already-registered?" checks.

import { hmacPIIHex } from './crypto/pii';
import { getAdminClient } from './supabase/admin';

export async function findProfileIdByEmail(
  email: string,
): Promise<string | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('email_hmac', hmacPIIHex(email))
    .maybeSingle();
  if (error) {
    console.error('[profiles] findProfileIdByEmail failed', error.message);
    return null;
  }
  return data?.id ?? null;
}

export async function isEmailRegistered(email: string): Promise<boolean> {
  const id = await findProfileIdByEmail(email);
  return id !== null;
}
