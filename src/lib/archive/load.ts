import { getCollection } from 'astro:content';
import type { CourseSlug } from '@lib/courses';
import { buildArchiveItems, deriveFacets, normalizeLessonSlug } from './build';
import type {
  ArchiveItem,
  Facets,
  LessonInput,
  LessonRef,
  QuizInput,
  VideoInput,
} from './types';

export async function loadArchiveForCourse(
  course: CourseSlug,
): Promise<{ items: ArchiveItem[]; facets: Facets }> {
  const [lessonEntries, quizEntries, videoEntries] = await Promise.all([
    getCollection('lessons', (l) => l.data.course === course),
    getCollection('quizzes', (q) => q.data.course === course),
    getCollection('videos', (v) => v.data.course === course),
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

  const quizzes: QuizInput[] = quizEntries.map((q) => ({
    slug: q.data.slug,
    course: q.data.course,
    title: q.data.title,
    kind: q.data.kind,
    lessonSlug: q.data.lessonSlug,
    covers: q.data.covers,
    semester: q.data.semester ?? null,
  }));

  const videos: VideoInput[] = videoEntries.map((v) => ({
    slug: v.data.slug,
    course: v.data.course,
    title: v.data.title,
    lessonSlug: v.data.lessonSlug,
    description: v.data.description,
    provider: v.data.provider,
    videoId: v.data.videoId,
    semester: v.data.semester,
  }));

  const items = buildArchiveItems({ lessons, quizzes, videos, course });

  const lessonIndex: LessonRef[] = lessons
    .filter((l) => !l.draft)
    .map((l) => ({
      slug: normalizeLessonSlug(l.id),
      title: l.title,
      unit: l.unit,
    }));

  return { items, facets: deriveFacets(items, lessonIndex) };
}
