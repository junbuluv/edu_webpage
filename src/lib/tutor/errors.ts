// One vocabulary for lesson-tutor failures, shared by the route (server) and
// the panel (browser). Pure and alias-free.
import { TUTOR_DAILY_LIMIT } from './limits.ts';

export type TutorErrorCode =
  | 'rate_limited'
  | 'budget_exhausted'
  | 'forbidden'
  | 'terms_required'
  | 'unavailable';

export const TUTOR_ERROR_COPY: Record<TutorErrorCode, string> = {
  rate_limited: `You've reached today's limit of ${TUTOR_DAILY_LIMIT} tutor messages. Try again tomorrow.`,
  budget_exhausted:
    'The tutor is out of budget until next month. The lesson and practice quiz still work.',
  forbidden:
    "The tutor is for students enrolled in this course. If you're enrolled, sign in again.",
  terms_required:
    'Reload the page and accept the updated terms of use to keep using the tutor.',
  unavailable: 'The tutor is unavailable right now. Try again in a minute.',
};

function statusOf(error: unknown): number | undefined {
  let e: unknown = error;
  for (let depth = 0; e && typeof e === 'object' && depth < 4; depth++) {
    const { statusCode, status, cause } = e as {
      statusCode?: unknown;
      status?: unknown;
      cause?: unknown;
    };
    if (statusCode === 402 || status === 402) return 402;
    e = cause;
  }
  return undefined;
}

function textOf(error: unknown): string {
  const parts: string[] = [];
  let e: unknown = error;
  for (let depth = 0; e && depth < 4; depth++) {
    if (typeof e === 'string') {
      parts.push(e);
      break;
    }
    if (typeof e !== 'object') break;
    const { message, responseBody, cause } = e as {
      message?: unknown;
      responseBody?: unknown;
      cause?: unknown;
    };
    if (typeof message === 'string') parts.push(message);
    if (typeof responseBody === 'string') parts.push(responseBody);
    e = cause;
  }
  return parts.join(' ').toLowerCase();
}

/** Server: what the panel is told when the model stream fails. */
export function classifyStreamError(
  error: unknown,
): 'budget_exhausted' | 'unavailable' {
  if (statusOf(error) === 402) return 'budget_exhausted';
  const text = textOf(error);
  if (
    text.includes('quota_for_entity_exceeded') ||
    text.includes('budget exceeded') ||
    text.includes('insufficient funds')
  ) {
    return 'budget_exhausted';
  }
  return 'unavailable';
}

const CODE_ALIASES = new Map<string, TutorErrorCode>([
  ['rate_limited', 'rate_limited'],
  ['budget_exhausted', 'budget_exhausted'],
  ['forbidden', 'forbidden'],
  ['unauthorized', 'forbidden'],
  ['tutor_not_enabled', 'forbidden'],
  ['terms_acceptance_required', 'terms_required'],
]);

/** Browser: map useChat's error.message (JSON body or bare code) to a code. */
export function parseTutorError(message: string | undefined): TutorErrorCode {
  if (!message) return 'unavailable';
  const trimmed = message.trim();
  let body: unknown;
  try {
    body = JSON.parse(trimmed);
  } catch {
    return CODE_ALIASES.get(trimmed) ?? 'unavailable';
  }
  if (body && typeof body === 'object') {
    const { error, reason } = body as { error?: unknown; reason?: unknown };
    const code =
      typeof error === 'string'
        ? error
        : typeof reason === 'string'
          ? reason
          : '';
    return CODE_ALIASES.get(code) ?? 'unavailable';
  }
  return 'unavailable';
}

export function isRetryable(code: TutorErrorCode): boolean {
  return code === 'unavailable';
}
