import type {
  ArchiveItem,
  LessonInput,
  QuizInput,
  VideoInput,
} from './types.ts';

/** Strip a trailing .md/.mdx so quiz `lessonSlug` and lesson `id` align. */
export function normalizeLessonSlug(slug: string): string {
  return slug.replace(/\.mdx?$/, '');
}

function unitsFor(slugs: string[], unitBySlug: Map<string, string>): string[] {
  const out: string[] = [];
  for (const s of slugs) {
    const u = unitBySlug.get(s);
    if (u && !out.includes(u)) out.push(u);
  }
  return out;
}

export function buildArchiveItems(input: {
  lessons: LessonInput[];
  quizzes: QuizInput[];
  videos: VideoInput[];
  course: string;
}): ArchiveItem[] {
  const { course } = input;
  const courseLessons = input.lessons.filter(
    (l) => l.course === course && !l.draft,
  );
  const unitBySlug = new Map<string, string>();
  for (const l of courseLessons) {
    unitBySlug.set(normalizeLessonSlug(l.id), l.unit);
  }

  const items: ArchiveItem[] = [];

  // Notes
  for (const l of courseLessons) {
    const slug = normalizeLessonSlug(l.id);
    items.push({
      id: `notes:${slug}`,
      type: 'notes',
      title: l.title,
      course,
      href: `/lessons/${slug}`,
      lessonSlugs: [slug],
      units: l.unit ? [l.unit] : [],
      semester: null,
      searchText: [l.title, l.summary, l.tags.join(' '), l.unit]
        .join(' ')
        .toLowerCase(),
    });
  }

  // Exams / assignments
  for (const q of input.quizzes) {
    if (q.course !== course) continue;
    if (q.kind === 'practice') continue;
    const lessonSlugs = (
      q.covers.length ? q.covers : q.lessonSlug ? [q.lessonSlug] : []
    ).map(normalizeLessonSlug);
    const units = unitsFor(lessonSlugs, unitBySlug);
    items.push({
      id: `${q.kind}:${q.slug}`,
      type: q.kind,
      title: q.title,
      course,
      href: `/practice/${q.slug}`,
      lessonSlugs,
      units,
      semester: q.semester ?? null,
      searchText: [q.title, units.join(' ')].join(' ').toLowerCase(),
    });
  }

  // Videos
  for (const v of input.videos) {
    if (v.course !== course) continue;
    const slug = normalizeLessonSlug(v.lessonSlug);
    const units = unitsFor([slug], unitBySlug);
    items.push({
      id: `video:${v.slug}`,
      type: 'video',
      title: v.title,
      course,
      href: '',
      lessonSlugs: [slug],
      units,
      semester: v.semester,
      provider: v.provider,
      videoId: v.videoId,
      searchText: [v.title, v.description ?? '', units.join(' ')]
        .join(' ')
        .toLowerCase(),
    });
  }

  return items;
}
