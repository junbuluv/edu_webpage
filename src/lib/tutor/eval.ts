// Pure helpers for scripts/tutor-eval.ts, which picks the tutor model before
// launch. Pass bar from the 2026-10-05 interview: >= 90% of ECO quiz points
// and >= 8 of 10 FIN numeric questions. The coach-behavior check (>= 8 of 10
// transcripts) is read by a person. Alias-free.
import type { AnswerValue, GradableQuestion } from '../quiz/grade.ts';

export const ECO_PASS_FRACTION = 0.9;
export const FIN_NUMERIC_SAMPLE = 10;
export const FIN_NUMERIC_PASS = 8;

export type EvalQuestion = GradableQuestion & {
  prompt: string;
  choices?: string[];
  unit?: string;
};

const LETTERS = 'ABCDEFGHIJ';

export function formatEvalQuestion(q: EvalQuestion): string {
  const lines = [`Question: ${q.prompt}`];
  if (q.type === 'numeric') {
    lines.push(
      `Answer with a number${q.unit ? ` in ${q.unit}` : ''}.`,
      'End with a final line exactly like: ANSWER: 12.5',
    );
  } else {
    (q.choices ?? []).forEach((c, i) => lines.push(`${LETTERS[i]}. ${c}`));
    lines.push(
      q.type === 'multi_select'
        ? 'Select every correct choice. End with a final line exactly like: ANSWER: A, C'
        : 'Select one choice. End with a final line exactly like: ANSWER: B',
    );
  }
  lines.push(
    'Keep any reasoning to three sentences or fewer before the final line.',
  );
  return lines.join('\n');
}

export function parseEvalAnswer(
  q: EvalQuestion,
  reply: string,
): AnswerValue | undefined {
  const raw = [...reply.matchAll(/ANSWER:\s*(.+)/gi)].at(-1)?.[1]?.trim();
  if (!raw) return undefined;
  if (q.type === 'numeric') {
    const num = raw.replace(/[$,%\s]/g, '').match(/^-?\d+(\.\d+)?/);
    return num ? Number(num[0]) : undefined;
  }
  const letters = raw.toUpperCase().match(/\b[A-J]\b/g) ?? [];
  const indices = [...new Set(letters.map((l) => LETTERS.indexOf(l)))];
  if (q.type === 'multiple_choice')
    return indices.length === 1 ? indices[0] : undefined;
  return indices.length > 0 ? indices.sort((a, b) => a - b) : undefined;
}

export function accuracyPasses(
  ecoScore: number,
  ecoMax: number,
  finCorrect: number,
): boolean {
  return (
    ecoMax > 0 &&
    ecoScore / ecoMax >= ECO_PASS_FRACTION &&
    finCorrect >= FIN_NUMERIC_PASS
  );
}

/**
 * Gateway rate limits (the free tier allows 5 requests a minute) say nothing
 * about the model, so the eval waits and retries instead of scoring a miss.
 */
export function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { name, statusCode, message } = error as {
    name?: unknown;
    statusCode?: unknown;
    message?: unknown;
  };
  if (statusCode === 429 || name === 'GatewayRateLimitError') return true;
  return typeof message === 'string' && /rate ?limit/i.test(message);
}
