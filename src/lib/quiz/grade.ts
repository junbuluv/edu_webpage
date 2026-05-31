// Pure quiz grading — no I/O, no @lib/@content aliases — so it runs under
// `node --test src/lib/quiz/grade.test.ts` AND is reused by the server-side
// grading endpoint (src/pages/api/quiz/grade.ts). Answer keys live only on
// the server; this is the single place that compares a student's answers to
// them, so grading can never be reproduced from the client bundle.

export type AnswerValue = number | number[] | string;
export type AnswerMap = Record<string, AnswerValue>;

// Structural subset of the content-collection QuestionT (config.ts). Kept
// alias-free on purpose; the API passes its QuestionT[] here (compatible).
export type GradableQuestion =
  | {
      type: 'multiple_choice';
      id: string;
      correctIndex: number;
      explanation: string;
      points: number;
    }
  | {
      type: 'multi_select';
      id: string;
      correctIndices: number[];
      explanation: string;
      points: number;
    }
  | {
      type: 'numeric';
      id: string;
      answer: number;
      tolerance: number;
      explanation: string;
      points: number;
    };

export interface PerQuestionResult {
  correct: boolean;
  awarded: number;
  explanation: string;
}

export interface GradeResult {
  score: number;
  maxScore: number;
  passed: boolean;
  perQuestion: Record<string, PerQuestionResult>;
}

function isQuestionCorrect(q: GradableQuestion, ans: AnswerValue | undefined): boolean {
  if (q.type === 'multiple_choice') {
    return typeof ans === 'number' && ans === q.correctIndex;
  }
  if (q.type === 'multi_select') {
    if (!Array.isArray(ans)) return false;
    const a = [...ans].sort((x, y) => x - y).join(',');
    const c = [...q.correctIndices].sort((x, y) => x - y).join(',');
    return a === c;
  }
  // numeric
  if (typeof ans !== 'string' && typeof ans !== 'number') return false;
  const parsed = Number(ans);
  return Number.isFinite(parsed) && Math.abs(parsed - q.answer) <= q.tolerance;
}

/**
 * Grade a submission. `passingScore` is a fraction (0..1). Returns the score,
 * max, pass flag, and per-question {correct, awarded, explanation}. The
 * explanation is the post-submit feedback text — it is intentionally returned
 * only here (after a submission), never shipped pre-submit.
 */
export function gradeQuiz(
  questions: GradableQuestion[],
  answers: AnswerMap,
  passingScore = 0.7,
): GradeResult {
  let score = 0;
  let maxScore = 0;
  const perQuestion: Record<string, PerQuestionResult> = {};
  for (const q of questions) {
    maxScore += q.points;
    const correct = isQuestionCorrect(q, answers[q.id]);
    const awarded = correct ? q.points : 0;
    score += awarded;
    perQuestion[q.id] = { correct, awarded, explanation: q.explanation };
  }
  const passed = maxScore === 0 ? false : score / maxScore >= passingScore;
  return { score, maxScore, passed, perQuestion };
}
