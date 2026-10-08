// The date of the newest Terms or Privacy Policy change that every account
// must acknowledge. Bumping it sends each signed-in user through
// /account/terms once (terms.test.ts keeps it >= both pages' lastUpdated).
// 2026-10-07: the privacy update disclosing the AI study tutor.
export const CURRENT_TERMS_VERSION = '2026-10-07';

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
