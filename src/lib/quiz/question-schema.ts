import { z } from 'zod';

// Standalone mirror of the QuestionSchema discriminated union in
// src/content/config.ts. Kept separate so API routes can validate authored
// quiz questions without importing the Astro content config. Keep in sync
// with config.ts if question shapes change.
export const questionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('multiple_choice'),
    id: z.string(),
    prompt: z.string(),
    choices: z.array(z.string()).min(2),
    correctIndex: z.number().int().nonnegative(),
    explanation: z.string(),
    points: z.number().positive().default(1),
  }),
  z.object({
    type: z.literal('numeric'),
    id: z.string(),
    prompt: z.string(),
    answer: z.number(),
    tolerance: z.number().nonnegative().default(0.01),
    unit: z.string().optional(),
    explanation: z.string(),
    points: z.number().positive().default(1),
  }),
  z.object({
    type: z.literal('multi_select'),
    id: z.string(),
    prompt: z.string(),
    choices: z.array(z.string()).min(2),
    correctIndices: z.array(z.number().int().nonnegative()).min(1),
    explanation: z.string(),
    points: z.number().positive().default(1),
  }),
]);

export const quizQuestionsSchema = z.array(questionSchema).min(1);
export type AuthoredQuestion = z.infer<typeof questionSchema>;
