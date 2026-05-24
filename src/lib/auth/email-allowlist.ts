// Accepted email domains for signup. Add new domains here as the
// institution adds them. Lowercased; comparison is case-insensitive.
//
// Today: Baruch College students and faculty/staff.
// Common additions to consider later if the program grows:
//   - login.cuny.edu (CUNY-wide SSO domain)
//   - other CUNY school domains (hunter.cuny.edu, etc.)
export const ALLOWED_EMAIL_DOMAINS = [
  'baruchmail.cuny.edu',
  'baruch.cuny.edu',
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
