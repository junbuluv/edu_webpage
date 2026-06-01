import { defineCollection, z } from 'astro:content';
import { COURSE_SLUGS } from '@lib/courses';

const courseEnum = z.enum(COURSE_SLUGS);

const semesterSchema = z.object({
  term: z.enum(['spring', 'summer', 'fall']),
  year: z.number().int(),
});

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
    // Public-asset path to a headshot, e.g. "/instructors/jun-yoo.jpeg".
    // Optional; profile pages render a plain header when absent.
    photoPath: z.string().optional(),
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
  schema: z
    .object({
      slug: z.string(),
      title: z.string(),
      course: courseEnum,
      lessonSlug: z.string().optional(),
      kind: z.enum(['practice', 'exam', 'assignment']).default('practice'),
      semester: semesterSchema.optional(),
      covers: z.array(z.string()).default([]),
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
    })
    .refine((d) => d.kind === 'practice' || d.semester !== undefined, {
      message: 'exam/assignment quizzes must declare a semester',
      path: ['semester'],
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
      .regex(
        /^#[0-9a-fA-F]{6}$/,
        'accentColor must be a 6-digit hex (#rrggbb)',
      ),
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

const videos = defineCollection({
  type: 'data',
  schema: z
    .object({
      slug: z.string(),
      title: z.string(),
      course: courseEnum,
      lessonSlug: z.string(),
      semester: semesterSchema,
      provider: z.enum(['youtube', 'vimeo']),
      videoId: z.string().min(1),
      description: z.string().optional(),
      durationMinutes: z.number().positive().optional(),
    })
    .refine((d) => d.course === 'eco-1002', {
      message: 'videos are only supported for eco-1002',
      path: ['course'],
    }),
});

export const collections = {
  lessons,
  quizzes,
  instructors,
  courses,
  workshops,
  videos,
};
export type QuestionT = z.infer<typeof QuestionSchema>;
