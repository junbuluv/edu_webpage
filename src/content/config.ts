import { defineCollection, z } from 'astro:content';

const lessons = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    course: z.enum(['macro', 'micro', 'finance', 'derivatives']),
    unit: z.string(),
    order: z.number(),
    summary: z.string(),
    learningObjectives: z.array(z.string()).min(1),
    prerequisites: z.array(z.string()).default([]),
    estimatedMinutes: z.number().positive(),
    tags: z.array(z.string()).default([]),
    quizSlug: z.string().optional(),
    draft: z.boolean().default(false),
    updated: z.date().optional(),
  }),
});

const QuestionSchema = z.discriminatedUnion('type', [
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

const quizzes = defineCollection({
  type: 'data',
  schema: z.object({
    slug: z.string(),
    title: z.string(),
    course: z.enum(['macro', 'micro', 'finance', 'derivatives']),
    lessonSlug: z.string().optional(),
    questions: z.array(QuestionSchema).min(1),
    passingScore: z.number().min(0).max(1).default(0.7),
  }),
});

export const collections = { lessons, quizzes };
export type QuestionT = z.infer<typeof QuestionSchema>;
