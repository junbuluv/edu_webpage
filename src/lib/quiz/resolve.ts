import { getEntry } from 'astro:content';
import { getAdminClient } from '@lib/supabase/admin';
import type { QuestionT } from '@/content/config';
import { quizQuestionsSchema } from './question-schema';
import { QuizInvalidError, QuizUnavailableError } from '@lib/archive/errors';

export interface GradableQuiz {
  slug: string;
  title: string;
  course: string;
  kind: 'practice' | 'exam' | 'assignment';
  questions: QuestionT[];
  passingScore: number;
  lessonSlug?: string;
  furtherReading?: {
    title: string;
    url: string;
    source: string;
    date?: string;
    why: string;
  };
}

/**
 * Resolve a quiz by slug: git content collection first, else an instructor-
 * authored DB quiz by id. Returns null if neither exists. Server-only (the
 * DB read uses the service-role admin client). The questions array carries
 * answer keys; callers must strip via toPublicQuestions before SSR.
 */
export async function loadGradableQuiz(
  slug: string,
): Promise<GradableQuiz | null> {
  const entry = await getEntry('quizzes', slug);
  if (entry) {
    const d = entry.data;
    return {
      slug: d.slug,
      title: d.title,
      course: d.course,
      kind: d.kind,
      questions: d.questions,
      passingScore: d.passingScore,
      lessonSlug: d.lessonSlug,
      furtherReading: d.furtherReading,
    };
  }
  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('archive_quizzes')
      .select('id, title, course_slug, kind, questions, passing_score')
      .eq('id', slug)
      .is('deleted_at', null)
      .eq('published', true)
      .maybeSingle();
    if (error) {
      console.error('[quiz/resolve] db_read_failed', { code: error.code });
      throw new QuizUnavailableError();
    }
    if (!data) return null;
    const questions = quizQuestionsSchema.safeParse(data.questions);
    if (!questions.success) {
      console.error('[quiz/resolve] invalid_db_quiz', { quizId: data.id });
      throw new QuizInvalidError();
    }
    return {
      slug: data.id,
      title: data.title,
      course: data.course_slug,
      kind: data.kind,
      questions: questions.data as QuestionT[],
      passingScore: Number(data.passing_score),
    };
  } catch (error) {
    if (
      error instanceof QuizInvalidError ||
      error instanceof QuizUnavailableError
    ) {
      throw error;
    }
    console.error('[quiz/resolve] db_read_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new QuizUnavailableError();
  }
}
