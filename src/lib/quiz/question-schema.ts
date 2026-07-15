import { z } from 'zod';

// Standalone authored-question schema based on the QuestionSchema union in
// src/content/config.ts. Kept separate so API routes can apply stricter DB
// input checks without importing the Astro content config.
const questionShapeSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('multiple_choice'),
    id: z.string().trim().min(1).max(100),
    prompt: z.string().trim().min(1).max(5000),
    choices: z.array(z.string().trim().min(1).max(1000)).min(2).max(20),
    correctIndex: z.number().int().nonnegative(),
    explanation: z.string().max(5000),
    points: z.number().positive().max(1000).default(1),
  }),
  z.object({
    type: z.literal('numeric'),
    id: z.string().trim().min(1).max(100),
    prompt: z.string().trim().min(1).max(5000),
    answer: z.number(),
    tolerance: z.number().nonnegative().default(0.01),
    unit: z.string().max(100).optional(),
    explanation: z.string().max(5000),
    points: z.number().positive().max(1000).default(1),
  }),
  z.object({
    type: z.literal('multi_select'),
    id: z.string().trim().min(1).max(100),
    prompt: z.string().trim().min(1).max(5000),
    choices: z.array(z.string().trim().min(1).max(1000)).min(2).max(20),
    correctIndices: z.array(z.number().int().nonnegative()).min(1).max(20),
    explanation: z.string().max(5000),
    points: z.number().positive().max(1000).default(1),
  }),
]);

export const questionSchema = questionShapeSchema.superRefine(
  (question, context) => {
    if (
      question.type === 'multiple_choice' &&
      question.correctIndex >= question.choices.length
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Correct choice is outside the choices array.',
        path: ['correctIndex'],
      });
    }

    if (question.type === 'multi_select') {
      const seen = new Set<number>();
      question.correctIndices.forEach((index, position) => {
        if (index >= question.choices.length) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Correct choice is outside the choices array.',
            path: ['correctIndices', position],
          });
        }
        if (seen.has(index)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Correct choices must be unique.',
            path: ['correctIndices', position],
          });
        }
        seen.add(index);
      });
    }
  },
);

export const quizQuestionsSchema = z
  .array(questionSchema)
  .min(1)
  .max(100)
  .superRefine((questions, context) => {
    const seen = new Set<string>();
    questions.forEach((question, index) => {
      if (seen.has(question.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Question ids must be unique.',
          path: [index, 'id'],
        });
      }
      seen.add(question.id);
    });
  });
export type AuthoredQuestion = z.infer<typeof questionSchema>;
