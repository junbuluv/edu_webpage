// Instructor class-roster loader (Phase 1: read-only monitoring).
//
// Architecture (decided in design): a TypeScript loader using the
// service-role admin client + an app-side ownership check, mirroring the
// existing instructor write-paths (api/instructor/workshops/*.ts). The
// service-role client is required because student email lives in
// auth.users (not in public.profiles, which only stores email_hmac) and
// no RLS path lets one instructor read another user's auth row.
//
// Server-only: getAdminClient reads SUPABASE_SERVICE_ROLE_KEY. Never
// import this module from a client-hydrated component — pages and other
// server libs only.

import { getCollection } from 'astro:content';
import {
  getAdminClient,
  listAllAuthUsers,
  selectAllRows,
} from '@lib/supabase/admin';
import { type CourseSlug, isCourseSlug } from '@lib/courses';
import {
  computeAvgBestScore,
  countDistinctQuizzes,
  evaluateRisk,
  type RiskResult,
} from '@lib/progress-aggregate';

export interface InstructorClass {
  course: CourseSlug;
  semester: string;
  studentCount: number;
  /** Most recent enrolled_at in the class — used to sort newest-first. */
  latestEnrolledAt: string;
}

export interface RosterStudent {
  userId: string;
  name: string | null;
  section: string | null;
  email: string | null;
  lessonsCompleted: number;
  lessonsTotal: number;
  lastActiveAt: string | null;
  quizzesTaken: number;
  avgBestScore: number | null;
  attendanceCount: number;
  risk: RiskResult;
}

export interface ClassRoster {
  course: CourseSlug;
  semester: string;
  lessonsTotal: number;
  closedWindowCount: number;
  students: RosterStudent[];
  atRiskCount: number;
  /** True when the auth.users email lookup failed; emails render as "—". */
  emailLookupFailed: boolean;
  /** True when a progress/quiz/attendance read errored; figures may be
   *  incomplete (signals could be undercounted, at-risk over-flagged). */
  dataIncomplete: boolean;
}

export type RosterResult =
  | { kind: 'ok'; roster: ClassRoster }
  | { kind: 'not_found' }
  | { kind: 'forbidden' }
  | { kind: 'error' };

/**
 * Distinct (course, semester) classes for an instructor, newest first.
 * Admins see every class in the catalog (no instructor_id filter).
 */
export async function listClasses(
  instructorId: string,
  isAdmin: boolean,
): Promise<InstructorClass[]> {
  const admin = getAdminClient();
  let query = admin
    .from('enrollments')
    .select('course_slug, semester, enrolled_at');
  if (!isAdmin) query = query.eq('instructor_id', instructorId);
  const { data } = await query;

  const byKey = new Map<string, InstructorClass>();
  for (const r of data ?? []) {
    if (!isCourseSlug(r.course_slug)) continue;
    const key = `${r.course_slug}::${r.semester}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        course: r.course_slug,
        semester: r.semester,
        studentCount: 1,
        latestEnrolledAt: r.enrolled_at,
      });
    } else {
      existing.studentCount += 1;
      if (r.enrolled_at > existing.latestEnrolledAt) {
        existing.latestEnrolledAt = r.enrolled_at;
      }
    }
  }

  return [...byKey.values()].sort((a, b) =>
    b.latestEnrolledAt.localeCompare(a.latestEnrolledAt),
  );
}

/**
 * Full roster + per-student monitoring signals for one (course, semester)
 * class. Enforces ownership in app code: a non-admin caller must be the
 * instructor_id on at least one enrollment in the class.
 *
 * @param nowMs current time (injected so at-risk evaluation is testable)
 * @param opts.withEmail skip the auth.users email lookup when only counts
 *        are needed (e.g. the classes index) — cheaper, no email exposure.
 */
export async function loadClassRoster(
  instructorId: string,
  isAdmin: boolean,
  course: CourseSlug,
  semester: string,
  nowMs: number,
  opts: { withEmail?: boolean } = {},
): Promise<RosterResult> {
  const withEmail = opts.withEmail ?? true;
  const admin = getAdminClient();

  // 1. Roster + ownership. Paginated, and an actual query error is reported
  // as 'error' (not 'not_found') so a transient failure doesn't masquerade
  // as a non-existent class.
  const enrollmentRes = await selectAllRows<{
    user_id: string;
    instructor_id: string;
    student_name: string | null;
    section: string | null;
  }>((from, to) =>
    admin
      .from('enrollments')
      .select('user_id, instructor_id, student_name, section')
      .eq('course_slug', course)
      .eq('semester', semester)
      .range(from, to),
  );
  if (enrollmentRes.error) return { kind: 'error' };
  const roster = enrollmentRes.rows;
  if (roster.length === 0) return { kind: 'not_found' };
  if (!isAdmin && !roster.some((r) => r.instructor_id === instructorId)) {
    return { kind: 'forbidden' };
  }
  const userIds = roster.map((r) => r.user_id);
  const userIdSet = new Set(userIds);

  // Registrar-provided name (from roster import) is authoritative; it
  // falls back to profiles.display_name below.
  const registrarNameById = new Map<string, string | null>();
  const sectionById = new Map<string, string | null>();
  for (const r of roster) {
    registrarNameById.set(r.user_id, r.student_name ?? null);
    sectionById.set(r.user_id, r.section ?? null);
  }

  // 2. Course-level facts + per-student source rows, in parallel. Each
  // table read is paginated past the 1000-row PostgREST cap so a large
  // class isn't silently truncated.
  const [lessonEntries, profileRes, progressRes, quizRes, adminRes, emailById] =
    await Promise.all([
      getCollection(
        'lessons',
        (l) => !l.data.draft && l.data.course === course,
      ),
      selectAllRows<{ id: string; display_name: string | null }>((from, to) =>
        admin
          .from('profiles')
          .select('id, display_name')
          .in('id', userIds)
          .range(from, to),
      ),
      selectAllRows<{
        user_id: string;
        lesson_slug: string;
        status: string;
        updated_at: string;
      }>((from, to) =>
        admin
          .from('lesson_progress')
          .select('user_id, lesson_slug, status, updated_at')
          .in('user_id', userIds)
          .like('lesson_slug', `${course}/%`)
          .range(from, to),
      ),
      selectAllRows<{
        user_id: string;
        quiz_slug: string;
        score: number;
        max_score: number;
        submitted_at: string;
      }>((from, to) =>
        admin
          .from('quiz_attempts')
          .select('user_id, quiz_slug, score, max_score, submitted_at')
          .in('user_id', userIds)
          .like('quiz_slug', `${course}-%`)
          .range(from, to),
      ),
      selectAllRows<{ id: string; closes_at: string }>((from, to) =>
        admin
          .from('workshop_administrations')
          .select('id, closes_at')
          .eq('course_slug', course)
          .range(from, to),
      ),
      withEmail ? fetchEmails() : Promise.resolve(null),
    ]);

  const lessonsTotal = lessonEntries.length;
  // Only count progress for currently-published lessons so lessonsCompleted
  // can never exceed lessonsTotal (a since-drafted/renamed lesson otherwise
  // leaves a stale completed row).
  const publishedSlugs = new Set(lessonEntries.map((l) => l.slug));

  const nameById = new Map<string, string | null>();
  for (const p of profileRes.rows) nameById.set(p.id, p.display_name);

  // 3. Attendance: stamps in this course's windows, counted per student.
  const adminRows = adminRes.rows;
  const adminIds = adminRows.map((a) => a.id);
  const closedWindowCount = adminRows.filter(
    (a) => Date.parse(a.closes_at) < nowMs,
  ).length;

  const attendanceByUser = new Map<string, number>();
  let attendanceError: string | null = null;
  if (adminIds.length > 0) {
    const stampsRes = await selectAllRows<{
      user_id: string;
      administration_id: string;
    }>((from, to) =>
      admin
        .from('workshop_attendance')
        .select('user_id, administration_id')
        .in('administration_id', adminIds)
        .range(from, to),
    );
    attendanceError = stampsRes.error;
    for (const s of stampsRes.rows) {
      if (!userIdSet.has(s.user_id)) continue;
      attendanceByUser.set(
        s.user_id,
        (attendanceByUser.get(s.user_id) ?? 0) + 1,
      );
    }
  }

  const dataIncomplete = Boolean(
    profileRes.error ||
    progressRes.error ||
    quizRes.error ||
    adminRes.error ||
    attendanceError,
  );

  // 4. Group lesson + quiz rows per student. lastActive folds in both lesson
  // activity (updated_at) and quiz activity (submitted_at).
  type LessonAgg = {
    completed: number;
    started: number;
    lastActive: string | null;
  };
  const lessonByUser = new Map<string, LessonAgg>();
  for (const row of progressRes.rows) {
    if (!publishedSlugs.has(row.lesson_slug)) continue;
    const agg = lessonByUser.get(row.user_id) ?? {
      completed: 0,
      started: 0,
      lastActive: null,
    };
    agg.started += 1;
    if (row.status === 'completed') agg.completed += 1;
    if (
      row.updated_at &&
      (agg.lastActive == null || row.updated_at > agg.lastActive)
    ) {
      agg.lastActive = row.updated_at;
    }
    lessonByUser.set(row.user_id, agg);
  }

  const quizByUser = new Map<
    string,
    Array<{ quiz_slug: string; score: number; max_score: number }>
  >();
  const quizLastActive = new Map<string, string>();
  for (const row of quizRes.rows) {
    const arr = quizByUser.get(row.user_id) ?? [];
    arr.push({
      quiz_slug: row.quiz_slug,
      score: row.score,
      max_score: row.max_score,
    });
    quizByUser.set(row.user_id, arr);
    if (row.submitted_at) {
      const prev = quizLastActive.get(row.user_id);
      if (prev == null || row.submitted_at > prev)
        quizLastActive.set(row.user_id, row.submitted_at);
    }
  }

  // 5. Assemble per-student rows + risk.
  const students: RosterStudent[] = userIds.map((id) => {
    const lessons = lessonByUser.get(id) ?? {
      completed: 0,
      started: 0,
      lastActive: null,
    };
    const attempts = quizByUser.get(id) ?? [];
    const attendanceCount = attendanceByUser.get(id) ?? 0;
    const avgBestScore = computeAvgBestScore(attempts);

    const quizLast = quizLastActive.get(id) ?? null;
    let lastActiveAt = lessons.lastActive;
    if (quizLast && (lastActiveAt == null || quizLast > lastActiveAt))
      lastActiveAt = quizLast;

    const risk = evaluateRisk(
      {
        lessonsCompleted: lessons.completed,
        lessonsTotal,
        lessonStartedCount: lessons.started,
        lastActiveAt,
        quizAttemptCount: attempts.length,
        avgBestScore,
        attendanceCount,
      },
      { closedWindowCount, nowMs },
    );

    return {
      userId: id,
      name: registrarNameById.get(id) ?? nameById.get(id) ?? null,
      section: sectionById.get(id) ?? null,
      email: emailById?.get(id) ?? null,
      lessonsCompleted: lessons.completed,
      lessonsTotal,
      lastActiveAt,
      quizzesTaken: countDistinctQuizzes(attempts),
      avgBestScore,
      attendanceCount,
      risk,
    };
  });

  // At-risk first, then by display name (unnamed students sort last).
  students.sort((a, b) => {
    if (a.risk.atRisk !== b.risk.atRisk) return a.risk.atRisk ? -1 : 1;
    return (a.name ?? '￿').localeCompare(b.name ?? '￿');
  });

  return {
    kind: 'ok',
    roster: {
      course,
      semester,
      lessonsTotal,
      closedWindowCount,
      students,
      atRiskCount: students.filter((s) => s.risk.atRisk).length,
      emailLookupFailed: withEmail && emailById === null,
      dataIncomplete,
    },
  };
}

/**
 * Build an id -> email map from auth.users. Returns null on failure so the
 * caller can degrade gracefully (render "—" for email) instead of failing
 * the whole roster.
 */
async function fetchEmails(): Promise<Map<string, string> | null> {
  try {
    const byId = new Map<string, string>();
    for (const u of await listAllAuthUsers()) {
      if (u.email) byId.set(u.id, u.email);
    }
    return byId;
  } catch {
    return null;
  }
}
