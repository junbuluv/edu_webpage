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
  selectAllRowsInBatches,
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
  instructorId: string;
  instructorName: string | null;
  assignmentActive: boolean;
  studentCount: number;
  /** Most recent enrolled_at in the class — used to sort newest-first. */
  latestEnrolledAt: string;
}

export interface RosterStudent {
  userId: string;
  instructorId: string;
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
  instructorId: string;
  assignmentActive: boolean;
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
  const assignmentRes = await selectAllRows<{
    instructor_id: string;
    course_slug: string;
    semester: string;
    active: boolean;
    assigned_at: string;
  }>((from, to) => {
    let query = admin
      .from('teaching_assignments')
      .select('instructor_id, course_slug, semester, active, assigned_at');
    if (!isAdmin) {
      query = query.eq('instructor_id', instructorId).eq('active', true);
    }
    return query
      .order('instructor_id', { ascending: true })
      .order('course_slug', { ascending: true })
      .order('semester', { ascending: true })
      .range(from, to);
  });
  if (assignmentRes.error) throw new Error(assignmentRes.error);

  const byKey = new Map<string, InstructorClass>();
  for (const row of assignmentRes.rows) {
    if (!isCourseSlug(row.course_slug)) continue;
    const key = `${row.instructor_id}::${row.course_slug}::${row.semester}`;
    byKey.set(key, {
      course: row.course_slug,
      semester: row.semester,
      instructorId: row.instructor_id,
      instructorName: null,
      assignmentActive: row.active,
      studentCount: 0,
      latestEnrolledAt: row.assigned_at,
    });
  }

  const enrollmentRes = await selectAllRows<{
    instructor_id: string;
    course_slug: string;
    semester: string;
    enrolled_at: string;
  }>((from, to) => {
    let query = admin
      .from('enrollments')
      .select('instructor_id, course_slug, semester, enrolled_at');
    if (!isAdmin) query = query.eq('instructor_id', instructorId);
    return query
      .order('instructor_id', { ascending: true })
      .order('course_slug', { ascending: true })
      .order('semester', { ascending: true })
      .order('user_id', { ascending: true })
      .range(from, to);
  });
  if (enrollmentRes.error) throw new Error(enrollmentRes.error);
  for (const row of enrollmentRes.rows) {
    const key = `${row.instructor_id}::${row.course_slug}::${row.semester}`;
    const entry = byKey.get(key);
    if (!entry) continue;
    entry.studentCount += 1;
    if (row.enrolled_at > entry.latestEnrolledAt) {
      entry.latestEnrolledAt = row.enrolled_at;
    }
  }

  const instructorIds = [
    ...new Set([...byKey.values()].map((c) => c.instructorId)),
  ];
  if (instructorIds.length > 0) {
    const profileRes = await selectAllRowsInBatches<
      {
        id: string;
        display_name: string | null;
      },
      string
    >(instructorIds, (batch, from, to) =>
      admin
        .from('profiles')
        .select('id, display_name')
        .in('id', batch)
        .order('id', { ascending: true })
        .range(from, to),
    );
    if (profileRes.error) throw new Error(profileRes.error);
    const names = new Map(
      profileRes.rows.map((profile) => [profile.id, profile.display_name]),
    );
    for (const entry of byKey.values()) {
      entry.instructorName = names.get(entry.instructorId) ?? null;
    }
  }

  return [...byKey.values()].sort((a, b) =>
    b.latestEnrolledAt.localeCompare(a.latestEnrolledAt),
  );
}

/**
 * Full roster + per-student monitoring signals for one (course, semester)
 * class. Non-admin callers receive only the rows they own in that
 * course-semester, so co-taught sections never disclose another instructor's
 * roster.
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
  opts: { withEmail?: boolean; instructorId?: string } = {},
): Promise<RosterResult> {
  const withEmail = opts.withEmail ?? true;
  const admin = getAdminClient();
  const scopedInstructorId = isAdmin ? opts.instructorId : instructorId;
  if (!scopedInstructorId) return { kind: 'forbidden' };

  let assignmentQuery = admin
    .from('teaching_assignments')
    .select('active')
    .eq('instructor_id', scopedInstructorId)
    .eq('course_slug', course)
    .eq('semester', semester);
  if (!isAdmin) assignmentQuery = assignmentQuery.eq('active', true);
  const { data: assignment, error: assignmentError } =
    await assignmentQuery.maybeSingle();
  if (assignmentError) return { kind: 'error' };
  if (!assignment) return { kind: 'not_found' };

  // 1. Roster + ownership. Paginated, and an actual query error is reported
  // as 'error' (not 'not_found') so a transient failure doesn't masquerade
  // as a non-existent class.
  const enrollmentRes = await selectAllRows<{
    user_id: string;
    instructor_id: string;
    student_name: string | null;
    section: string | null;
  }>((from, to) => {
    let query = admin
      .from('enrollments')
      .select('user_id, instructor_id, student_name, section')
      .eq('course_slug', course)
      .eq('semester', semester)
      .eq('instructor_id', scopedInstructorId);
    return query.order('user_id', { ascending: true }).range(from, to);
  });
  if (enrollmentRes.error) return { kind: 'error' };
  const roster = enrollmentRes.rows;
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

  const emptyRows = <T>() => Promise.resolve({ rows: [] as T[], error: null });

  // 2. Course-level facts + per-student source rows, in parallel. Each
  // table read is paginated past the 1000-row PostgREST cap so a large
  // class isn't silently truncated.
  const [lessonEntries, profileRes, progressRes, quizRes, adminRes, emailById] =
    await Promise.all([
      getCollection(
        'lessons',
        (l) => !l.data.draft && l.data.course === course,
      ),
      userIds.length > 0
        ? selectAllRowsInBatches<
            { id: string; display_name: string | null },
            string
          >(userIds, (batch, from, to) =>
            admin
              .from('profiles')
              .select('id, display_name')
              .in('id', batch)
              .order('id', { ascending: true })
              .range(from, to),
          )
        : emptyRows<{ id: string; display_name: string | null }>(),
      userIds.length > 0
        ? selectAllRowsInBatches<
            {
              user_id: string;
              lesson_slug: string;
              status: string;
              updated_at: string;
            },
            string
          >(userIds, (batch, from, to) =>
            admin
              .from('offering_lesson_progress')
              .select('user_id, lesson_slug, status, updated_at')
              .in('user_id', batch)
              .eq('course_slug', course)
              .eq('semester', semester)
              .eq('instructor_id', scopedInstructorId)
              .order('user_id', { ascending: true })
              .order('lesson_slug', { ascending: true })
              .range(from, to),
          )
        : emptyRows<{
            user_id: string;
            lesson_slug: string;
            status: string;
            updated_at: string;
          }>(),
      userIds.length > 0
        ? selectAllRowsInBatches<
            {
              user_id: string;
              quiz_slug: string;
              score: number;
              max_score: number;
              submitted_at: string;
            },
            string
          >(userIds, (batch, from, to) =>
            admin
              .from('quiz_attempts')
              .select('user_id, quiz_slug, score, max_score, submitted_at')
              .in('user_id', batch)
              .eq('course_slug', course)
              .eq('semester', semester)
              .eq('instructor_id', scopedInstructorId)
              .order('id', { ascending: true })
              .range(from, to),
          )
        : emptyRows<{
            user_id: string;
            quiz_slug: string;
            score: number;
            max_score: number;
            submitted_at: string;
          }>(),
      selectAllRows<{
        id: string;
        closes_at: string;
        instructor_id: string;
        section: string | null;
      }>((from, to) => {
        const query = admin
          .from('workshop_administrations')
          .select('id, closes_at, instructor_id, section')
          .eq('course_slug', course)
          .eq('semester', semester)
          .eq('instructor_id', scopedInstructorId)
          .is('cancelled_at', null);
        return query.order('id', { ascending: true }).range(from, to);
      }),
      withEmail && userIds.length > 0 ? fetchEmails() : Promise.resolve(null),
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
  const adminById = new Map(adminRows.map((row) => [row.id, row]));
  const adminIds = adminRows.map((a) => a.id);
  const closedWindowCount = adminRows.filter(
    (a) =>
      a.instructor_id === scopedInstructorId && Date.parse(a.closes_at) < nowMs,
  ).length;

  const attendanceByUser = new Map<string, number>();
  let attendanceError: string | null = null;
  if (adminIds.length > 0) {
    const stampsRes = await selectAllRowsInBatches<
      {
        user_id: string;
        administration_id: string;
      },
      string
    >(adminIds, (batch, from, to) =>
      admin
        .from('workshop_attendance')
        .select('user_id, administration_id')
        .in('administration_id', batch)
        .order('administration_id', { ascending: true })
        .order('user_id', { ascending: true })
        .range(from, to),
    );
    attendanceError = stampsRes.error;
    for (const s of stampsRes.rows) {
      if (!userIdSet.has(s.user_id)) continue;
      const administration = adminById.get(s.administration_id);
      if (!administration) {
        continue;
      }
      if ((sectionById.get(s.user_id) ?? null) !== administration.section) {
        continue;
      }
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
    const studentSection = sectionById.get(id) ?? null;
    const eligibleClosedWindowCount = adminRows.filter(
      (administration) =>
        administration.instructor_id === scopedInstructorId &&
        Date.parse(administration.closes_at) < nowMs &&
        studentSection === administration.section,
    ).length;
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
      { closedWindowCount: eligibleClosedWindowCount, nowMs },
    );

    return {
      userId: id,
      instructorId: scopedInstructorId,
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
      instructorId: scopedInstructorId,
      assignmentActive: assignment.active,
      lessonsTotal,
      closedWindowCount,
      students,
      atRiskCount: students.filter((s) => s.risk.atRisk).length,
      emailLookupFailed: withEmail && userIds.length > 0 && emailById === null,
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
