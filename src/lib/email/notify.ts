// Outbound operational email (not auth email — Supabase sends that through
// its own SMTP config). Used to tell admins that someone is waiting on a
// staff-access decision, so a TA isn't blocked until an admin happens to
// check /admin.
//
// Every function here is fail-open: it logs and returns false rather than
// throwing, because none of these messages are worth breaking the user
// action that triggered them.

import { getAdminClient, listAllAuthUsers } from '@lib/supabase/admin';

const FROM = 'Baruch Econ & Finance Studio <noreply@baruchfinance.com>';
const SITE = 'https://baruchfinance.com';

async function sendEmail(args: {
  to: string[];
  subject: string;
  text: string;
}): Promise<boolean> {
  const key = import.meta.env.RESEND_API_KEY;
  if (!key) {
    console.error('[email/notify] resend_api_key_missing');
    return false;
  }
  if (args.to.length === 0) return false;
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: args.to,
        subject: args.subject,
        text: args.text,
      }),
    });
    if (!response.ok) {
      console.error('[email/notify] send_failed', { status: response.status });
      return false;
    }
    return true;
  } catch (error) {
    console.error('[email/notify] send_threw', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/** Email addresses of every admin, via the service role (admins' emails live
 *  in auth.users, which no RLS path exposes). */
async function adminEmails(): Promise<string[]> {
  const { data, error } = await getAdminClient()
    .from('profiles')
    .select('id')
    .eq('role', 'admin');
  if (error) {
    console.error('[email/notify] admin_lookup_failed', { code: error.code });
    return [];
  }
  const ids = new Set((data ?? []).map((row) => row.id));
  if (ids.size === 0) return [];
  const users = await listAllAuthUsers();
  return users
    .filter((u) => ids.has(u.id) && u.email)
    .map((u) => u.email as string);
}

export async function notifyAdminsOfRoleRequest(args: {
  email: string;
  requestedRole: 'instructor' | 'ta';
}): Promise<boolean> {
  try {
    const to = await adminEmails();
    const roleLabel =
      args.requestedRole === 'instructor' ? 'Lecturer' : 'Teaching assistant';
    return await sendEmail({
      to,
      subject: `Staff access requested: ${roleLabel}`,
      text: [
        `${args.email} signed up and requested ${roleLabel} access.`,
        '',
        'They currently have student-level access only. Approve or deny at:',
        `${SITE}/admin`,
        '',
        'If you do not recognize this person, deny the request.',
      ].join('\n'),
    });
  } catch (error) {
    console.error('[email/notify] role_request_notify_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
