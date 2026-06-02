export type EnrollOutcome = 'no_account' | 'already_enrolled' | 'ok';

/**
 * Decide the outcome of a single-student enroll attempt. Pure so the API
 * handler stays thin and this branching is unit-tested.
 * - email not matched to an account -> 'no_account'
 * - matched but already enrolled for this course+semester -> 'already_enrolled'
 * - matched and not yet enrolled -> 'ok' (proceed to insert)
 */
export function classifyEnroll(input: {
  emailFound: boolean;
  alreadyEnrolled: boolean;
}): EnrollOutcome {
  if (!input.emailFound) return 'no_account';
  if (input.alreadyEnrolled) return 'already_enrolled';
  return 'ok';
}
