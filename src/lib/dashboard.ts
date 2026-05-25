import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import type { User } from '@supabase/supabase-js';
import type { SupabaseServerClient } from '@lib/supabase/server';
import { COURSE_SLUGS, type CourseSlug, isCourseSlug } from '@lib/courses';

export type AvailableCourse = {
  slug: CourseSlug;
  code: string;
  title: string;
  accentColor: string;
  order: number;
  enrolled: boolean;
  semester: string | null;
};

export type CourseDashboardData = {
  course: CollectionEntry<'courses'>;
  instructors: Array<CollectionEntry<'instructors'>>;
  enrolledSemester: string | null;
  stats: {
    lessonsCompleted: number;
    lessonsTotal: number;
    quizzesTaken: number;
    avgScore: number | null;
  };
  lessons: Array<CollectionEntry<'lessons'>>;
  progressBySlug: Map<string, 'started' | 'completed'>;
  quizAttempts: Array<{
    quiz_slug: string;
    score: number;
    max_score: number;
    submitted_at: string;
  }>;
};

export type ResolveResult =
  | { kind: 'render'; courseSlug: CourseSlug | null }
  | { kind: 'redirect'; to: string };

type EnrollmentRow = { course_slug: string; semester: string };
type AnyClient = NonNullable<SupabaseServerClient>;

/**
 * Resolution ladder for which course the dashboard should display:
 *   1. ?course=X param (and user has access)  -> use X, persist as preference
 *   2. profile.active_course_slug             -> redirect with ?course=that
 *   3. First enrolled course (by order)       -> redirect
 *   4. First activity course (by order)       -> redirect
 *   5. None                                   -> render empty state (null)
 */
export async function resolveActiveCourse(
  supabase: AnyClient,
  user: User,
  courseParam: string | null,
): Promise<ResolveResult> {
  const enrollments = await fetchEnrollments(supabase, user.id);
  const enrolledSlugs = new Set(
    enrollments
      .map((e) => e.course_slug)
      .filter(isCourseSlug),
  );
  const activitySlugs = await fetchActivityCourseSlugs(supabase, user.id);
  const accessible = new Set<CourseSlug>([...enrolledSlugs, ...activitySlugs]);

  // 1. Honor explicit ?course=X if accessible.
  if (courseParam && isCourseSlug(courseParam) && accessible.has(courseParam)) {
    void persistActiveCourse(supabase, user.id, courseParam);
    return { kind: 'render', courseSlug: courseParam };
  }

  // 2. Stored preference.
  const { data: profile } = await supabase
    .from('profiles')
    .select('active_course_slug')
    .eq('id', user.id)
    .maybeSingle();

  const stored = profile?.active_course_slug;
  if (stored && isCourseSlug(stored) && accessible.has(stored)) {
    return { kind: 'redirect', to: `/dashboard?course=${stored}` };
  }

  // 3. & 4. First enrolled, else first activity, sorted by course order.
  const ordered = await sortByCourseOrder([...accessible]);
  if (ordered.length > 0) {
    return { kind: 'redirect', to: `/dashboard?course=${ordered[0]}` };
  }

  // 5. Nothing — render empty state.
  return { kind: 'render', courseSlug: null };
}

/**
 * Lists every course the user can switch to, with enrollment status,
 * ordered enrolled-first then activity-only.
 */
export async function listAvailableCourses(
  supabase: AnyClient,
  userId: string,
): Promise<AvailableCourse[]> {
  const enrollments = await fetchEnrollments(supabase, userId);
  const activitySlugs = await fetchActivityCourseSlugs(supabase, userId);
  const all = await getCollection('courses');

  const enrolledMap = new Map<string, string>();
  for (const e of enrollments) enrolledMap.set(e.course_slug, e.semester);

  const result: AvailableCourse[] = [];
  for (const entry of all) {
    const slug = entry.data.slug;
    const enrolled = enrolledMap.has(slug);
    const hasActivity = activitySlugs.has(slug);
    if (!enrolled && !hasActivity) continue;
    result.push({
      slug,
      code: entry.data.code,
      title: entry.data.title,
      accentColor: entry.data.accentColor,
      order: entry.data.order,
      enrolled,
      semester: enrolledMap.get(slug) ?? null,
    });
  }

  result.sort((a, b) => {
    if (a.enrolled !== b.enrolled) return a.enrolled ? -1 : 1;
    return a.order - b.order;
  });
  return result;
}

/**
 * Loads everything the dashboard needs to render a single course.
 */
export async function getDashboardData(
  supabase: AnyClient,
  userId: string,
  courseSlug: CourseSlug,
): Promise<CourseDashboardData | null> {
  const course = await getEntry('courses', courseSlug);
  if (!course) return null;

  const [allLessons, allInstructors, progressRows, quizRows, enrollmentRows] =
    await Promise.all([
      getCollection('lessons', (l) => !l.data.draft && l.data.course === courseSlug),
      getCollection('instructors', (i) => i.data.courses.includes(courseSlug)),
      supabase
        .from('lesson_progress')
        .select('lesson_slug, status, updated_at')
        .eq('user_id', userId)
        .like('lesson_slug', `${courseSlug}/%`),
      supabase
        .from('quiz_attempts')
        .select('quiz_slug, score, max_score, submitted_at')
        .eq('user_id', userId)
        .like('quiz_slug', `${courseSlug}-%`)
        .order('submitted_at', { ascending: false }),
      supabase
        .from('enrollments')
        .select('semester')
        .eq('user_id', userId)
        .eq('course_slug', courseSlug)
        .maybeSingle(),
    ]);

  const lessons = [...allLessons].sort((a, b) => {
    if (a.data.unit !== b.data.unit) return a.data.unit.localeCompare(b.data.unit);
    return a.data.order - b.data.order;
  });

  const instructors = [...allInstructors].sort(
    (a, b) => (a.data.order ?? 100) - (b.data.order ?? 100),
  );

  const progressBySlug = new Map<string, 'started' | 'completed'>();
  for (const p of progressRows.data ?? []) {
    progressBySlug.set(p.lesson_slug, p.status);
  }

  const lessonsCompleted = Array.from(progressBySlug.values()).filter(
    (s) => s === 'completed',
  ).length;

  const quizAttempts = quizRows.data ?? [];

  return {
    course,
    instructors,
    enrolledSemester: enrollmentRows.data?.semester ?? null,
    stats: {
      lessonsCompleted,
      lessonsTotal: lessons.length,
      quizzesTaken: countDistinctQuizzes(quizAttempts),
      avgScore: computeAvgBestScore(quizAttempts),
    },
    lessons,
    progressBySlug,
    quizAttempts,
  };
}

// ---------- helpers ----------

async function fetchEnrollments(
  supabase: AnyClient,
  userId: string,
): Promise<EnrollmentRow[]> {
  const { data } = await supabase
    .from('enrollments')
    .select('course_slug, semester')
    .eq('user_id', userId);
  return data ?? [];
}

async function fetchActivityCourseSlugs(
  supabase: AnyClient,
  userId: string,
): Promise<Set<CourseSlug>> {
  const [{ data: lessons }, { data: quizzes }] = await Promise.all([
    supabase.from('lesson_progress').select('lesson_slug').eq('user_id', userId),
    supabase.from('quiz_attempts').select('quiz_slug').eq('user_id', userId),
  ]);

  const slugs = new Set<CourseSlug>();
  for (const row of lessons ?? []) {
    const slug = row.lesson_slug.split('/', 1)[0];
    if (isCourseSlug(slug)) slugs.add(slug);
  }
  for (const row of quizzes ?? []) {
    // Quiz slugs are 'eco-1002-...' or 'fin-3610-...'. Match against
    // known slugs rather than splitting on '-' (course slugs themselves
    // contain hyphens).
    for (const cs of COURSE_SLUGS) {
      if (row.quiz_slug.startsWith(`${cs}-`)) {
        slugs.add(cs);
        break;
      }
    }
  }
  return slugs;
}

async function persistActiveCourse(
  supabase: AnyClient,
  userId: string,
  slug: CourseSlug,
): Promise<void> {
  await supabase
    .from('profiles')
    .update({ active_course_slug: slug })
    .eq('id', userId);
}

async function sortByCourseOrder(slugs: CourseSlug[]): Promise<CourseSlug[]> {
  if (slugs.length === 0) return [];
  const all = await getCollection('courses');
  const orderBySlug = new Map(all.map((c) => [c.data.slug, c.data.order]));
  return slugs
    .slice()
    .sort((a, b) => (orderBySlug.get(a) ?? 999) - (orderBySlug.get(b) ?? 999));
}

function countDistinctQuizzes(
  attempts: Array<{ quiz_slug: string }>,
): number {
  return new Set(attempts.map((a) => a.quiz_slug)).size;
}

function computeAvgBestScore(
  attempts: Array<{ quiz_slug: string; score: number; max_score: number }>,
): number | null {
  if (attempts.length === 0) return null;
  const bestByQuiz = new Map<string, number>();
  for (const a of attempts) {
    if (a.max_score <= 0) continue;
    const pct = a.score / a.max_score;
    const prev = bestByQuiz.get(a.quiz_slug);
    if (prev === undefined || pct > prev) bestByQuiz.set(a.quiz_slug, pct);
  }
  if (bestByQuiz.size === 0) return null;
  const sum = Array.from(bestByQuiz.values()).reduce((s, v) => s + v, 0);
  return sum / bestByQuiz.size;
}
