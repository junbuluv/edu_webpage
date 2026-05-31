// Accepted email domains for signup. Add new domains here as the
// institution adds them. Lowercased; comparison is case-insensitive.
//
// Today: Baruch College students and faculty/staff, plus Gmail.
// Common additions to consider later if the program grows:
//   - login.cuny.edu (CUNY-wide SSO domain)
//   - other CUNY school domains (hunter.cuny.edu, etc.)
//
// Why gmail.com is here: CUNY/Baruch mail is hosted on Microsoft 365
// (Exchange Online), whose spam filter silently drops Supabase's
// built-in confirmation email (no bounce). Until custom SMTP with an
// authenticated sending domain is configured, a student whose Baruch
// confirmation never arrives can fall back to a Gmail address. Signing
// up only creates an account; it grants no course access — that still
// requires an enrollments row added by an instructor/admin — so opening
// signup to Gmail does not widen who can see class data.
// TODO: once custom SMTP lands and Baruch delivery is verified, decide
// whether to keep Gmail or drop it back to Baruch-only.
export const ALLOWED_EMAIL_DOMAINS = [
  'baruchmail.cuny.edu',
  'baruch.cuny.edu',
  'gmail.com',
] as const;

export function isAllowedEmail(email: string): boolean {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at < 0) return false;
  const domain = trimmed.slice(at + 1);
  return (ALLOWED_EMAIL_DOMAINS as readonly string[]).includes(domain);
}

export function allowedDomainsHumanList(): string {
  return ALLOWED_EMAIL_DOMAINS.map((d) => `@${d}`).join(' or ');
}
