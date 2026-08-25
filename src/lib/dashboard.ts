import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import type { User } from '@supabase/supabase-js';
import type { SupabaseServerClient } from '@lib/supabase/server';
import { type CourseSlug, isCourseSlug } from '@lib/courses';
import {
  computeAvgBestScore,
  countDistinctQuizzes,
} from '@lib/progress-aggregate';
import { fetchArchiveQuizzes } from '@lib/archive/db';
import { isUuid } from '@lib/workshop-policy';
import { buildWeeklyAttendance, type WeeklyCell } from '@lib/attendance-weekly';

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
    title: string;
    score: number;
    max_score: number;
    submitted_at: string;
  }>;
  /** Weekly workshop attendance for the signed-in student. Null when the
   *  student has no visible workshop windows (not enrolled, or none
   *  scheduled). RLS limits the administration read to windows matching
   *  the student's own enrollment. */
  attendance: {
    weeks: Array<{ weekOf: string; cell: WeeklyCell }>;
    attendedCount: number;
    /** A window the student can stamp into right now, if any. */
    openNow: { workshopSlug: string; closesAt: string } | null;
  } | null;
};

export type ResolveResult =
  | { kind: 'render'; courseSlug: CourseSlug | null }
  | { kind: 'redirect'; to: string };

type EnrollmentRow = { course_slug: string; semester: string };
type AnyClient = NonNullable<SupabaseServerClient>;

export class DashboardUnavailableError extends Error {
  constructor(context: string) {
    super(`Dashboard data unavailable: ${context}`);
    this.name = 'DashboardUnavailableError';
  }
}

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
    enrollments.map((e) => e.course_slug).filter(isCourseSlug),
  );
  const activitySlugs = await fetchActivityCourseSlugs(supabase, user.id);
  // Any slug that round-trips isCourseSlug is acceptable now (browse mode).
  const accessible = new Set<CourseSlug>([...enrolledSlugs, ...activitySlugs]);

  // 1. Honor explicit ?course=X for any valid course slug.
  if (courseParam && isCourseSlug(courseParam)) {
    await persistActiveCourse(supabase, user.id, courseParam);
    return { kind: 'render', courseSlug: courseParam };
  }

  // 2. Stored preference.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('active_course_slug')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) throw new DashboardUnavailableError('profile');

  const stored = profile?.active_course_slug;
  if (stored && isCourseSlug(stored)) {
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
 * Lists every course in the catalog, annotated with whether the user
 * is enrolled. Used by the global course switcher so students can browse
 * any course (not just the ones they're enrolled in). Sorted by the
 * course `order` field, alphabetical fallback on code.
 */
export async function listAvailableCourses(
  supabase: AnyClient,
  userId: string,
): Promise<AvailableCourse[]> {
  const enrollments = await fetchEnrollments(supabase, userId);
  const all = await getCollection('courses');

  const enrolledMap = new Map<string, string>();
  for (const e of enrollments) enrolledMap.set(e.course_slug, e.semester);

  const result: AvailableCourse[] = all.map((entry) => ({
    slug: entry.data.slug,
    code: entry.data.code,
    title: entry.data.title,
    accentColor: entry.data.accentColor,
    order: entry.data.order,
    enrolled: enrolledMap.has(entry.data.slug),
    semester: enrolledMap.get(entry.data.slug) ?? null,
  }));

  result.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.code.localeCompare(b.code);
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

  const [
    allLessons,
    allInstructors,
    catalogQuizzes,
    progressRows,
    quizRows,
    enrollmentRows,
  ] = await Promise.all([
    getCollection(
      'lessons',
      (l) => !l.data.draft && l.data.course === courseSlug,
    ),
    getCollection('instructors', (i) => i.data.courses.includes(courseSlug)),
    getCollection('quizzes', (quiz) => quiz.data.course === courseSlug),
    supabase
      .from('lesson_progress')
      .select('lesson_slug, status, updated_at')
      .eq('user_id', userId)
      .like('lesson_slug', `${courseSlug}/%`),
    supabase
      .from('quiz_attempts')
      .select('quiz_slug, score, max_score, submitted_at')
      .eq('user_id', userId)
      .eq('course_slug', courseSlug)
      .order('submitted_at', { ascending: false }),
    supabase
      .from('enrollments')
      .select('semester')
      .eq('user_id', userId)
      .eq('course_slug', courseSlug)
      .order('enrolled_at', { ascending: false })
      .limit(1),
  ]);

  if (progressRows.error)
    throw new DashboardUnavailableError('lesson progress');
  if (quizRows.error) throw new DashboardUnavailableError('quiz attempts');
  if (enrollmentRows.error) throw new DashboardUnavailableError('enrollment');

  const lessons = [...allLessons].sort((a, b) => {
    if (a.data.unit !== b.data.unit)
      return a.data.unit.localeCompare(b.data.unit);
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

  const quizTitleBySlug = new Map(
    catalogQuizzes.map((quiz) => [quiz.data.slug, quiz.data.title]),
  );
  if ((quizRows.data ?? []).some((attempt) => isUuid(attempt.quiz_slug))) {
    try {
      for (const quiz of await fetchArchiveQuizzes(courseSlug)) {
        quizTitleBySlug.set(quiz.id, quiz.title);
      }
    } catch (error) {
      console.error('[dashboard] archive_quiz_titles_unavailable', error);
    }
  }
  const quizAttempts = (quizRows.data ?? []).map((attempt) => ({
    ...attempt,
    title: quizTitleBySlug.get(attempt.quiz_slug) ?? 'Archived quiz',
  }));

  // Weekly workshop attendance. The administrations RLS policy already
  // limits rows to windows matching this student's enrollment (course,
  // semester, instructor, and section-or-null), so no extra filtering is
  // needed beyond dropping cancelled windows. Failures degrade to null —
  // the dashboard card simply doesn't render.
  let attendance: CourseDashboardData['attendance'] = null;
  try {
    const [adminRes, stampRes] = await Promise.all([
      supabase
        .from('workshop_administrations')
        .select('id, workshop_slug, section, week_of, opens_at, closes_at')
        .eq('course_slug', courseSlug)
        .is('cancelled_at', null),
      supabase
        .from('workshop_attendance')
        .select('administration_id')
        .eq('user_id', userId),
    ]);
    if (!adminRes.error && !stampRes.error && (adminRes.data ?? []).length) {
      const nowMs = Date.now();
      const admins = adminRes.data ?? [];
      const weekly = buildWeeklyAttendance(
        // RLS pre-filtered to eligible windows; null section = all match.
        admins.map((a) => ({
          id: a.id,
          week_of: a.week_of,
          section: null,
          closes_at: a.closes_at,
        })),
        (stampRes.data ?? []).map((s) => ({
          user_id: userId,
          administration_id: s.administration_id,
        })),
        new Map([[userId, null]]),
        nowMs,
      );
      const cells = weekly.cellsByUser.get(userId) ?? [];
      const stamped = new Set(
        (stampRes.data ?? []).map((s) => s.administration_id),
      );
      const open = admins.find(
        (a) =>
          !stamped.has(a.id) &&
          Date.parse(a.opens_at) <= nowMs &&
          Date.parse(a.closes_at) >= nowMs,
      );
      attendance = {
        weeks: weekly.weeks.map((weekOf, i) => ({
          weekOf,
          cell: cells[i] ?? 'ineligible',
        })),
        attendedCount: cells.filter((c) => c === 'attended').length,
        openNow: open
          ? { workshopSlug: open.workshop_slug, closesAt: open.closes_at }
          : null,
      };
    }
  } catch (error) {
    console.error('[dashboard] attendance_unavailable', error);
  }

  return {
    course,
    instructors,
    enrolledSemester: enrollmentRows.data?.[0]?.semester ?? null,
    stats: {
      lessonsCompleted,
      lessonsTotal: lessons.length,
      quizzesTaken: countDistinctQuizzes(quizAttempts),
      avgScore: computeAvgBestScore(quizAttempts),
    },
    lessons,
    progressBySlug,
    quizAttempts,
    attendance,
  };
}

// ---------- helpers ----------

async function fetchEnrollments(
  supabase: AnyClient,
  userId: string,
): Promise<EnrollmentRow[]> {
  const { data, error } = await supabase
    .from('enrollments')
    .select('course_slug, semester')
    .eq('user_id', userId);
  if (error) throw new DashboardUnavailableError('enrollments');
  return data ?? [];
}

async function fetchActivityCourseSlugs(
  supabase: AnyClient,
  userId: string,
): Promise<Set<CourseSlug>> {
  const [lessonResult, quizResult] = await Promise.all([
    supabase
      .from('lesson_progress')
      .select('course_slug')
      .eq('user_id', userId),
    supabase.from('quiz_attempts').select('course_slug').eq('user_id', userId),
  ]);
  if (lessonResult.error)
    throw new DashboardUnavailableError('lesson activity');
  if (quizResult.error) throw new DashboardUnavailableError('quiz activity');

  const slugs = new Set<CourseSlug>();
  for (const row of lessonResult.data ?? []) {
    const slug = row.course_slug;
    if (slug && isCourseSlug(slug)) slugs.add(slug);
  }
  for (const row of quizResult.data ?? []) {
    const slug = row.course_slug;
    if (slug && isCourseSlug(slug)) slugs.add(slug);
  }
  return slugs;
}

async function persistActiveCourse(
  supabase: AnyClient,
  userId: string,
  slug: CourseSlug,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ active_course_slug: slug })
    .eq('id', userId);
  if (error) console.error('[dashboard] active_course_persist_failed', error);
}

async function sortByCourseOrder(slugs: CourseSlug[]): Promise<CourseSlug[]> {
  if (slugs.length === 0) return [];
  const all = await getCollection('courses');
  const orderBySlug = new Map(all.map((c) => [c.data.slug, c.data.order]));
  return slugs
    .slice()
    .sort((a, b) => (orderBySlug.get(a) ?? 999) - (orderBySlug.get(b) ?? 999));
}
