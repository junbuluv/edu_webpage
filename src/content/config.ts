import { defineCollection, z } from 'astro:content';
import { COURSE_SLUGS } from '@lib/courses';

const courseEnum = z.enum(COURSE_SLUGS);

const lessons = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    course: courseEnum,
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
    furtherReading: z
      .object({
        title: z.string(),
        url: z.string().url(),
        source: z.string(),
        date: z.string().optional(),
        why: z.string(),
      })
      .optional(),
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

const instructors = defineCollection({
  type: 'content',
  schema: z.object({
    fullName: z.string(),
    preferredName: z.string().optional(),
    title: z.string(),
    department: z.string().optional(),
    institution: z.string(),
    profileUrl: z.string().url().optional(),
    email: z.string().email().optional(),
    office: z.string().optional(),
    courses: z.array(courseEnum).default([]),
    researchInterests: z.array(z.string()).default([]),
    selectedPublications: z
      .array(
        z.object({
          title: z.string(),
          journal: z.string().optional(),
          year: z.number().int().optional(),
        }),
      )
      .default([]),
    education: z
      .array(
        z.object({
          degree: z.string(),
          institution: z.string(),
          year: z.number().int().optional(),
        }),
      )
      .default([]),
    order: z.number().default(100),
  }),
});

const quizzes = defineCollection({
  type: 'data',
  schema: z.object({
    slug: z.string(),
    title: z.string(),
    course: courseEnum,
    lessonSlug: z.string().optional(),
    questions: z.array(QuestionSchema).min(1),
    passingScore: z.number().min(0).max(1).default(0.7),
    furtherReading: z
      .object({
        title: z.string(),
        url: z.string().url(),
        source: z.string(),
        date: z.string().optional(),
        why: z.string(),
      })
      .optional(),
  }),
});

const exams = defineCollection({
  type: 'data',
  schema: z.object({
    slug: z.string(),
    title: z.string(),
    course: courseEnum,
    description: z.string(),
    durationMinutes: z.number().int().positive(),
    questions: z.array(QuestionSchema).min(1),
    passingScore: z.number().min(0).max(1).default(0.7),
  }),
});

const courses = defineCollection({
  type: 'data',
  schema: z.object({
    slug: courseEnum,
    code: z.string(),
    title: z.string(),
    description: z.string(),
    accentColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'accentColor must be a 6-digit hex (#rrggbb)'),
    order: z.number().int().nonnegative(),
    defaultSemester: z.string(),
  }),
});

const workshops = defineCollection({
  type: 'data',
  schema: z.object({
    slug: z.string(),
    title: z.string(),
    course: courseEnum,
    lessonSlug: z.string(),
    summary: z.string(),
    questions: z
      .array(
        z.object({
          id: z.string(),
          prompt: z.string(),
          notes: z.string().optional(),
        }),
      )
      .min(5)
      .max(7),
  }),
});

export const collections = { lessons, quizzes, instructors, exams, courses, workshops };
export type QuestionT = z.infer<typeof QuestionSchema>;
