import type {
  ArchiveFilters,
  ArchiveItem,
  ArchiveItemType,
  Facets,
  LessonInput,
  LessonRef,
  QuizInput,
  Semester,
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

const TYPE_ORDER: ArchiveItemType[] = ['notes', 'exam', 'assignment', 'video'];
const TERM_RANK: Record<Semester['term'], number> = {
  spring: 0,
  summer: 1,
  fall: 2,
};

export function semesterKey(s: Semester | null): string {
  return s ? `${s.term}-${s.year}` : '';
}

export function semesterLabel(s: Semester): string {
  const term = s.term.charAt(0).toUpperCase() + s.term.slice(1);
  return `${term} ${s.year}`;
}

export function deriveFacets(
  items: ArchiveItem[],
  lessonIndex: LessonRef[],
): Facets {
  const presentTypes = new Set(items.map((i) => i.type));
  const types = TYPE_ORDER.filter((t) => presentTypes.has(t));

  const semMap = new Map<string, Semester>();
  for (const i of items) {
    if (i.semester) semMap.set(semesterKey(i.semester), i.semester);
  }
  const semesters = [...semMap.values()]
    .sort((a, b) => b.year - a.year || TERM_RANK[b.term] - TERM_RANK[a.term])
    .map((s) => ({ key: semesterKey(s), label: semesterLabel(s) }));

  const units = [...new Set(items.flatMap((i) => i.units))].sort((a, b) =>
    a.localeCompare(b),
  );

  const referenced = new Set(items.flatMap((i) => i.lessonSlugs));
  const lessons = lessonIndex
    .filter((l) => referenced.has(l.slug))
    .map((l) => ({ slug: l.slug, title: l.title }))
    .sort((a, b) => a.title.localeCompare(b.title));

  return { types, semesters, units, lessons };
}

export function filterItems(
  items: ArchiveItem[],
  filters: ArchiveFilters,
): ArchiveItem[] {
  const tokens = (filters.query ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return items.filter((i) => {
    if (filters.type && i.type !== filters.type) return false;
    if (filters.semester && semesterKey(i.semester) !== filters.semester)
      return false;
    if (filters.unit && !i.units.includes(filters.unit)) return false;
    if (filters.lesson && !i.lessonSlugs.includes(filters.lesson)) return false;
    if (tokens.length && !tokens.every((t) => i.searchText.includes(t)))
      return false;
    return true;
  });
}
