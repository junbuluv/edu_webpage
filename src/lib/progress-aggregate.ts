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
 * Average of each quiz's best fraction-correct, across quizzes the student
 * has a scorable attempt for. Returns null when there is nothing to score
 * (no attempts, or every attempt had max_score <= 0).
 */
export function computeAvgBestScore(attempts: QuizAttemptRow[]): number | null {
  const best = bestScoreByQuiz(attempts);
  if (best.size === 0) return null;
  const sum = Array.from(best.values()).reduce((s, v) => s + v, 0);
  return sum / best.size;
}

// ---------- at-risk evaluation ----------

export const RISK_THRESHOLDS = {
  /** Days since last lesson activity that counts as "inactive". */
  inactiveDays: 14,
  /** Below this fraction of course lessons completed counts as "behind". */
  minLessonCompletionRatio: 0.5,
  /** Below this average best quiz score counts as "low scores". */
  minAvgBestScore: 0.6,
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
  /** Average best quiz score (0..1), or null if nothing scorable. */
  avgBestScore: number | null;
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
 *   3. Average best quiz score < minAvgBestScore (only if they have a score).
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

  if (s.avgBestScore != null && s.avgBestScore < t.minAvgBestScore) {
    reasons.push(`Low quiz avg (${Math.round(s.avgBestScore * 100)}%)`);
  }

  if (ctx.closedWindowCount > 0 && s.attendanceCount === 0) {
    reasons.push('No workshop attendance');
  }

  return { atRisk: reasons.length > 0, reasons };
}
