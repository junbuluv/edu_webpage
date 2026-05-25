import type { SupabaseServerClient } from '@lib/supabase/server';
import type { CourseSlug } from '@lib/courses';

// Loader for the staff section on /dashboard. Returns per-course
// management metrics: workshop stamps (ECO 1002) or exam attempts
// (FIN 3610), filtered by a time range parsed from a query param.

export type TimeRange = 'week' | 'month' | 'all';

export function parseRange(raw: string | null): TimeRange {
  if (raw === 'month' || raw === 'all') return raw;
  return 'week';
}

function rangeStartISO(range: TimeRange): string | null {
  if (range === 'all') return null;
  const now = new Date();
  if (range === 'week') {
    // Monday 00:00 of current week (UTC) — using ISO weekday Monday=1.
    const day = now.getUTCDay(); // 0=Sun..6=Sat
    const daysBack = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() - daysBack);
    monday.setUTCHours(0, 0, 0, 0);
    return monday.toISOString();
  }
  // month
  const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return firstOfMonth.toISOString();
}

type AnyClient = NonNullable<SupabaseServerClient>;

export interface WorkshopStaffMetrics {
  kind: 'workshop';
  rangeStartISO: string | null;
  totalStamps: number;
  sessionsTouched: number;
  recent: Array<{
    administration_id: string;
    workshop_slug: string;
    section: 'CML' | 'CTL' | 'CWL' | 'CRL';
    user_id: string;
    stamped_at: string;
  }>;
  openNow: number;
}

export interface ExamStaffMetrics {
  kind: 'exam';
  rangeStartISO: string | null;
  totalAttempts: number;
  avgScore: number | null;
  recent: Array<{
    administration_id: string;
    exam_slug: string;
    user_id: string;
    score: number | null;
    max_score: number | null;
    submitted_at: string;
  }>;
  openNow: number;
}

export type StaffMetrics = WorkshopStaffMetrics | ExamStaffMetrics | null;

export async function loadStaffMetrics(
  supabase: AnyClient,
  courseSlug: CourseSlug,
  range: TimeRange,
): Promise<StaffMetrics> {
  const startISO = rangeStartISO(range);

  if (courseSlug === 'eco-1002') {
    return loadWorkshopMetrics(supabase, courseSlug, startISO);
  }
  if (courseSlug === 'fin-3610') {
    return loadExamMetrics(supabase, courseSlug, startISO);
  }
  return null;
}

async function loadWorkshopMetrics(
  supabase: AnyClient,
  courseSlug: CourseSlug,
  startISO: string | null,
): Promise<WorkshopStaffMetrics> {
  // Pull this course's administrations (id list scopes the attendance
  // query). No time filter on admins themselves — they're the surface
  // we're measuring against.
  const { data: admins } = await supabase
    .from('workshop_administrations')
    .select('id, workshop_slug, section, opens_at, closes_at')
    .eq('course_slug', courseSlug);
  const adminIds = (admins ?? []).map((a) => a.id);
  const adminById = new Map((admins ?? []).map((a) => [a.id, a]));

  // Attendance rows in the time range.
  let stamps: Array<{
    administration_id: string;
    user_id: string;
    stamped_at: string;
  }> = [];
  if (adminIds.length > 0) {
    let query = supabase
      .from('workshop_attendance')
      .select('administration_id, user_id, stamped_at')
      .in('administration_id', adminIds)
      .order('stamped_at', { ascending: false });
    if (startISO) query = query.gte('stamped_at', startISO);
    const { data } = await query;
    stamps = data ?? [];
  }

  const sessionsTouched = new Set(stamps.map((s) => s.administration_id)).size;

  const now = Date.now();
  const openNow = (admins ?? []).filter(
    (a) => Date.parse(a.opens_at) <= now && now <= Date.parse(a.closes_at),
  ).length;

  return {
    kind: 'workshop',
    rangeStartISO: startISO,
    totalStamps: stamps.length,
    sessionsTouched,
    openNow,
    recent: stamps.slice(0, 10).map((s) => {
      const a = adminById.get(s.administration_id);
      return {
        administration_id: s.administration_id,
        workshop_slug: a?.workshop_slug ?? '',
        section: (a?.section ?? 'CML') as 'CML' | 'CTL' | 'CWL' | 'CRL',
        user_id: s.user_id,
        stamped_at: s.stamped_at,
      };
    }),
  };
}

async function loadExamMetrics(
  supabase: AnyClient,
  courseSlug: CourseSlug,
  startISO: string | null,
): Promise<ExamStaffMetrics> {
  const { data: admins } = await supabase
    .from('exam_administrations')
    .select('id, exam_slug, opens_at, closes_at')
    .eq('course_slug', courseSlug);
  const adminIds = (admins ?? []).map((a) => a.id);
  const adminById = new Map((admins ?? []).map((a) => [a.id, a]));

  let attempts: Array<{
    administration_id: string;
    user_id: string;
    score: number | null;
    max_score: number | null;
    submitted_at: string | null;
  }> = [];
  if (adminIds.length > 0) {
    let query = supabase
      .from('exam_attempts')
      .select('administration_id, user_id, score, max_score, submitted_at')
      .in('administration_id', adminIds)
      .not('submitted_at', 'is', null)
      .order('submitted_at', { ascending: false });
    if (startISO) query = query.gte('submitted_at', startISO);
    const { data } = await query;
    attempts = data ?? [];
  }

  const validScores = attempts
    .filter((a) => a.max_score != null && a.max_score > 0 && a.score != null)
    .map((a) => (a.score as number) / (a.max_score as number));
  const avgScore = validScores.length
    ? validScores.reduce((s, v) => s + v, 0) / validScores.length
    : null;

  const now = Date.now();
  const openNow = (admins ?? []).filter(
    (a) => Date.parse(a.opens_at) <= now && now <= Date.parse(a.closes_at),
  ).length;

  return {
    kind: 'exam',
    rangeStartISO: startISO,
    totalAttempts: attempts.length,
    avgScore,
    openNow,
    recent: attempts.slice(0, 10).map((a) => ({
      administration_id: a.administration_id,
      exam_slug: adminById.get(a.administration_id)?.exam_slug ?? '',
      user_id: a.user_id,
      score: a.score,
      max_score: a.max_score,
      submitted_at: a.submitted_at!,
    })),
  };
}
