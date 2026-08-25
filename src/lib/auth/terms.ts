export const CURRENT_TERMS_VERSION = '2026-07-14';

export interface TermsProfile {
  tos_accepted_at: string | null;
  tos_version: string | null;
}

export function hasAcceptedCurrentTerms(
  profile: TermsProfile | null | undefined,
): boolean {
  return Boolean(
    profile?.tos_accepted_at && profile.tos_version === CURRENT_TERMS_VERSION,
  );
}
