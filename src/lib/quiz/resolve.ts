import { getEntry } from 'astro:content';
import { getAdminClient } from '@lib/supabase/admin';
import type { QuestionT } from '@/content/config';

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
    const { data } = await admin
      .from('archive_quizzes')
      .select('id, title, course_slug, kind, questions, passing_score')
      .eq('id', slug)
      .is('deleted_at', null)
      .eq('published', true)
      .maybeSingle();
    if (!data) return null;
    return {
      slug: data.id,
      title: data.title,
      course: data.course_slug,
      kind: data.kind,
      questions: data.questions as unknown as QuestionT[],
      passingScore: Number(data.passing_score),
    };
  } catch {
    return null;
  }
}
