import { getCollection } from 'astro:content';
import type { CourseSlug } from '@lib/courses';
import { buildArchiveItems, deriveFacets, normalizeLessonSlug } from './build';
import { fetchArchivePapers, fetchArchiveQuizzes } from './db';
import type {
  ArchiveItem,
  Facets,
  LessonInput,
  LessonRef,
  PaperInput,
  QuizInput,
} from './types';

export async function loadArchiveForCourse(
  course: CourseSlug,
): Promise<{ items: ArchiveItem[]; facets: Facets }> {
  const [lessonEntries, quizEntries] = await Promise.all([
    getCollection('lessons', (l) => l.data.course === course),
    getCollection('quizzes', (q) => q.data.course === course),
  ]);

  const lessons: LessonInput[] = lessonEntries.map((l) => ({
    id: l.id,
    course: l.data.course,
    title: l.data.title,
    unit: l.data.unit,
    summary: l.data.summary,
    tags: l.data.tags,
    draft: l.data.draft,
  }));

  const gitQuizzes: QuizInput[] = quizEntries.map((q) => ({
    slug: q.data.slug,
    course: q.data.course,
    title: q.data.title,
    kind: q.data.kind,
    lessonSlug: q.data.lessonSlug,
    covers: q.data.covers,
    semester: q.data.semester ?? null,
  }));

  const [dbQuizRows, paperRows] = await Promise.all([
    fetchArchiveQuizzes(course),
    fetchArchivePapers(course),
  ]);
  const dbQuizzes: QuizInput[] = dbQuizRows.map((r) => ({
    slug: r.id,
    course: r.course_slug,
    title: r.title,
    kind: r.kind,
    covers: r.covers,
    semester: { term: r.semester_term, year: r.semester_year },
  }));
  const quizzes: QuizInput[] = [...gitQuizzes, ...dbQuizzes];

  const papers: PaperInput[] = paperRows.map((r) => {
    return {
      id: r.id,
      course: r.course_slug,
      kind: r.kind,
      title: r.title,
      covers: r.covers,
      semester: { term: r.semester_term, year: r.semester_year },
      fileUrl: `/api/archive/papers/${r.id}`,
      fileName: r.original_filename,
    };
  });

  const items = buildArchiveItems({ lessons, quizzes, papers, course });

  const lessonIndex: LessonRef[] = lessons
    .filter((l) => !l.draft)
    .map((l) => ({
      slug: normalizeLessonSlug(l.id),
      title: l.title,
      unit: l.unit,
    }));

  return { items, facets: deriveFacets(items, lessonIndex) };
}
