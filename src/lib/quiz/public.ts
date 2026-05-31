// Sanitize quiz questions for the client. The browser must never receive the
// answer keys (correctIndex / correctIndices / answer / tolerance) or the
// post-submit explanations — those stay server-side and are only revealed by
// the grading endpoint after a submission. The practice page passes
// toPublicQuestions(...) into the <Quiz> island.

import type { QuestionT } from '@/content/config';

export interface PublicQuestion {
  id: string;
  type: QuestionT['type'];
  prompt: string;
  /** present for multiple_choice / multi_select */
  choices?: string[];
  /** present for numeric */
  unit?: string;
  points: number;
}

export function toPublicQuestions(questions: QuestionT[]): PublicQuestion[] {
  return questions.map((q) => {
    const base: PublicQuestion = {
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      points: q.points,
    };
    if (q.type === 'multiple_choice' || q.type === 'multi_select') {
      base.choices = q.choices;
    } else if (q.type === 'numeric') {
      base.unit = q.unit;
    }
    return base;
  });
}
