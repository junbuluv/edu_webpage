import { getCollection } from 'astro:content';
import type { CourseSlug } from '@lib/courses';
import { buildArchiveItems, deriveFacets, normalizeLessonSlug } from './build';
import {
  fetchArchiveVideos,
  fetchArchivePapers,
  fetchArchiveQuizzes,
  signPaperUrl,
} from './db';
import type {
  ArchiveItem,
  Facets,
  LessonInput,
  LessonRef,
  PaperInput,
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

  const gitQuizzes: QuizInput[] = quizEntries.map((q) => ({
    slug: q.data.slug,
    course: q.data.course,
    title: q.data.title,
    kind: q.data.kind,
    lessonSlug: q.data.lessonSlug,
    covers: q.data.covers,
    semester: q.data.semester ?? null,
  }));

  const dbQuizRows = await fetchArchiveQuizzes(course);
  const dbQuizzes: QuizInput[] = dbQuizRows.map((r) => ({
    slug: r.id,
    course: r.course_slug,
    title: r.title,
    kind: r.kind,
    covers: r.covers,
    semester: { term: r.semester_term, year: r.semester_year },
  }));
  const quizzes: QuizInput[] = [...gitQuizzes, ...dbQuizzes];

  const gitVideos: VideoInput[] = videoEntries.map((v) => ({
    slug: v.data.slug,
    course: v.data.course,
    title: v.data.title,
    lessonSlug: v.data.lessonSlug,
    description: v.data.description,
    provider: v.data.provider,
    videoId: v.data.videoId,
    semester: v.data.semester,
  }));

  const dbVideoRows = await fetchArchiveVideos(course);
  const dbVideos: VideoInput[] = dbVideoRows.map((r) => ({
    slug: r.id,
    course: r.course_slug,
    title: r.title,
    lessonSlug: r.lesson_slug,
    description: r.description ?? undefined,
    provider: r.provider,
    videoId: r.video_id,
    semester: { term: r.semester_term, year: r.semester_year },
  }));

  const videos: VideoInput[] = [...gitVideos, ...dbVideos];

  const paperRows = await fetchArchivePapers(course);
  const papers: PaperInput[] = [];
  for (const r of paperRows) {
    const fileUrl = await signPaperUrl(r.storage_path);
    if (!fileUrl) continue; // skip papers whose file can't be signed
    papers.push({
      id: r.id,
      course: r.course_slug,
      kind: r.kind,
      title: r.title,
      covers: r.covers,
      semester: { term: r.semester_term, year: r.semester_year },
      fileUrl,
      fileName: r.original_filename,
    });
  }

  const items = buildArchiveItems({ lessons, quizzes, videos, papers, course });

  const lessonIndex: LessonRef[] = lessons
    .filter((l) => !l.draft)
    .map((l) => ({
      slug: normalizeLessonSlug(l.id),
      title: l.title,
      unit: l.unit,
    }));

  return { items, facets: deriveFacets(items, lessonIndex) };
}
