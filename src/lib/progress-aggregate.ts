// Pure aggregation + at-risk logic shared by the student dashboard
// (src/lib/dashboard.ts) and the instructor class roster
// (src/lib/instructor/class-roster.ts).
//
// Everything here is a pure function over plain rows — no Supabase, no
// astro:content, no I/O — so it can be unit-tested directly with
// `node --test src/lib/progress-aggregate.test.ts` (Node strips the TS
// types natively; no test-runner dependency needed).

export type QuizAttemptRow = {
  quiz_slug: string;
  score: number;
  max_score: number;
  /** ISO timestamp; orders attempts when picking a quiz's first try. */
  submitted_at?: string | null;
};

/** Number of distinct quizzes a student has attempted at least once. */
export function countDistinctQuizzes(
  attempts: Array<{ quiz_slug: string }>,
): number {
  return new Set(attempts.map((a) => a.quiz_slug)).size;
}

/**
 * Best (highest) fraction-correct per quiz, keyed by quiz_slug. Attempts
 * with a non-positive max_score are ignored (can't form a ratio).
 */
export function bestScoreByQuiz(
  attempts: QuizAttemptRow[],
): Map<string, number> {
  const best = new Map<string, number>();
  for (const a of attempts) {
    if (a.max_score <= 0) continue;
    const pct = a.score / a.max_score;
    const prev = best.get(a.quiz_slug);
    if (prev === undefined || pct > prev) best.set(a.quiz_slug, pct);
  }
  return best;
}

/**
 * Fraction-correct of each quiz's FIRST attempt (earliest submitted_at),
 * keyed by quiz_slug. Practice quizzes show the answers after every attempt,
 * so the first try is the honest measure of what a student knew; later tries
 * mostly measure retrying. Rows without a timestamp only count when no dated
 * row exists, in array order. Attempts with a non-positive max_score are
 * ignored.
 */
export function firstScoreByQuiz(
  attempts: QuizAttemptRow[],
): Map<string, number> {
  const first = new Map<string, { pct: number; at: number }>();
  for (const a of attempts) {
    if (a.max_score <= 0) continue;
    const parsed = a.submitted_at ? Date.parse(a.submitted_at) : NaN;
    const at = Number.isFinite(parsed) ? parsed : Infinity;
    const prev = first.get(a.quiz_slug);
    if (prev === undefined || at < prev.at) {
      first.set(a.quiz_slug, { pct: a.score / a.max_score, at });
    }
  }
  return new Map(Array.from(first, ([slug, v]) => [slug, v.pct]));
}

function averageOf(scores: Map<string, number>): number | null {
  if (scores.size === 0) return null;
  const sum = Array.from(scores.values()).reduce((s, v) => s + v, 0);
  return sum / scores.size;
}

/**
 * Average of each quiz's best fraction-correct, across quizzes the student
 * has a scorable attempt for. Returns null when there is nothing to score
 * (no attempts, or every attempt had max_score <= 0).
 */
export function computeAvgBestScore(attempts: QuizAttemptRow[]): number | null {
  return averageOf(bestScoreByQuiz(attempts));
}

/** Average of each quiz's first-try fraction-correct; null when nothing scorable. */
export function computeAvgFirstScore(
  attempts: QuizAttemptRow[],
): number | null {
  return averageOf(firstScoreByQuiz(attempts));
}

// ---------- at-risk evaluation ----------

export const RISK_THRESHOLDS = {
  /** Days since last lesson activity that counts as "inactive". */
  inactiveDays: 14,
  /** Below this fraction of course lessons completed counts as "behind". */
  minLessonCompletionRatio: 0.5,
  /**
   * Below this average FIRST-TRY quiz score counts as "low scores". Not the
   * best score: answers are shown after each attempt, so a student can retry
   * any quiz to 100% without having learned it.
   */
  minAvgFirstScore: 0.6,
} as const;

export type RiskThresholds = typeof RISK_THRESHOLDS;

export interface StudentSignals {
  lessonsCompleted: number;
  lessonsTotal: number;
  /** lesson_progress rows for this student in this course (started or completed). */
  lessonStartedCount: number;
  /** Max lesson_progress.updated_at as an ISO string; null if no lesson activity. */
  lastActiveAt: string | null;
  /** Total quiz_attempts rows for this student in this course. */
  quizAttemptCount: number;
  /** Average first-try quiz score (0..1), or null if nothing scorable. */
  avgFirstScore: number | null;
  /** Workshop stamps for this student in this course. */
  attendanceCount: number;
}

export interface RiskContext {
  /** Workshop windows for this class that have already closed. */
  closedWindowCount: number;
  /** Current time in ms (injected so the rule is deterministic in tests). */
  nowMs: number;
}

export interface RiskResult {
  atRisk: boolean;
  reasons: string[];
}

const DAY_MS = 86_400_000;

/**
 * Flags a student at-risk if ANY rule fires; `reasons` lists the
 * human-readable causes for display. Rules (see RISK_THRESHOLDS):
 *   1. No activity at all (no lessons started, no quizzes attempted).
 *   2. Inactive > inactiveDays AND lessons completed < minLessonCompletionRatio.
 *   3. Average first-try quiz score < minAvgFirstScore (only if they have one).
 *   4. Zero workshop attendance while >=1 window has already closed.
 */
export function evaluateRisk(
  s: StudentSignals,
  ctx: RiskContext,
  t: RiskThresholds = RISK_THRESHOLDS,
): RiskResult {
  const reasons: string[] = [];

  const noActivity = s.lessonStartedCount === 0 && s.quizAttemptCount === 0;
  if (noActivity) reasons.push('No activity yet');

  const ratio = s.lessonsTotal > 0 ? s.lessonsCompleted / s.lessonsTotal : 0;
  const daysSinceActive =
    s.lastActiveAt == null
      ? Infinity
      : (ctx.nowMs - Date.parse(s.lastActiveAt)) / DAY_MS;

  // Rule 2 only applies once they've engaged at all (rule 1 covers the rest).
  if (
    !noActivity &&
    daysSinceActive > t.inactiveDays &&
    ratio < t.minLessonCompletionRatio
  ) {
    // Guard the non-finite case (engaged but no dated activity) so the label
    // never renders "Infinityd".
    const inactiveLabel = Number.isFinite(daysSinceActive)
      ? `Inactive ${Math.floor(daysSinceActive)}d`
      : 'No recent activity';
    reasons.push(`${inactiveLabel}, ${Math.round(ratio * 100)}% lessons done`);
  }

  if (s.avgFirstScore != null && s.avgFirstScore < t.minAvgFirstScore) {
    reasons.push(
      `Low first-try quiz avg (${Math.round(s.avgFirstScore * 100)}%)`,
    );
  }

  if (ctx.closedWindowCount > 0 && s.attendanceCount === 0) {
    reasons.push('No workshop attendance');
  }

  return { atRisk: reasons.length > 0, reasons };
}
