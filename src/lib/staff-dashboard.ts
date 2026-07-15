import type { SupabaseServerClient } from '@lib/supabase/server';
import type { CourseSlug } from '@lib/courses';
import { newYorkReportingRangeStartISO } from '@lib/workshop-policy';
import { selectAllRows } from '@lib/supabase/admin';

// Loader for the staff section on /dashboard. Returns per-course
// workshop stamp metrics for both ECO 1002 and FIN 3610, filtered
// by a time range parsed from a query param.

export type TimeRange = 'week' | 'month' | 'all';

export function parseRange(raw: string | null): TimeRange {
  if (raw === 'month' || raw === 'all') return raw;
  return 'week';
}

function rangeStartISO(range: TimeRange): string | null {
  if (range === 'all') return null;
  return newYorkReportingRangeStartISO(range);
}

type AnyClient = NonNullable<SupabaseServerClient>;

export interface WorkshopStaffMetrics {
  kind: 'workshop';
  dataUnavailable: boolean;
  rangeStartISO: string | null;
  totalStamps: number;
  sessionsTouched: number;
  recent: Array<{
    administration_id: string;
    workshop_slug: string;
    section: 'CML' | 'CTL' | 'CWL' | 'CRL' | null;
    stamped_at: string;
  }>;
  openNow: number;
}

export type StaffMetrics = WorkshopStaffMetrics | null;

export async function loadStaffMetrics(
  supabase: AnyClient,
  courseSlug: CourseSlug,
  range: TimeRange,
): Promise<StaffMetrics> {
  const startISO = rangeStartISO(range);

  if (courseSlug === 'eco-1002' || courseSlug === 'fin-3610') {
    return loadWorkshopMetrics(supabase, courseSlug, startISO);
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
  const administrations = await selectAllRows<{
    id: string;
    workshop_slug: string;
    section: 'CML' | 'CTL' | 'CWL' | 'CRL' | null;
    opens_at: string;
    closes_at: string;
  }>((from, to) =>
    supabase
      .from('workshop_administrations')
      .select('id, workshop_slug, section, opens_at, closes_at')
      .is('cancelled_at', null)
      .eq('course_slug', courseSlug)
      .order('id', { ascending: true })
      .range(from, to),
  );
  if (administrations.error) return unavailableWorkshopMetrics(startISO);
  const admins = administrations.rows;
  const adminIds = admins.map((administration) => administration.id);
  const adminById = new Map(
    admins.map((administration) => [administration.id, administration]),
  );

  // Attendance rows in the time range.
  let stamps: Array<{
    administration_id: string;
    stamped_at: string;
  }> = [];
  if (adminIds.length > 0) {
    for (let start = 0; start < adminIds.length; start += 100) {
      const batch = adminIds.slice(start, start + 100);
      const result = await selectAllRows<(typeof stamps)[number]>(
        (from, to) => {
          let query = supabase
            .from('workshop_attendance')
            .select('administration_id, stamped_at')
            .in('administration_id', batch)
            .order('stamped_at', { ascending: false });
          query = query
            .order('administration_id', { ascending: true })
            .order('id', { ascending: true });
          if (startISO) query = query.gte('stamped_at', startISO);
          return query.range(from, to);
        },
      );
      if (result.error) return unavailableWorkshopMetrics(startISO);
      stamps.push(...result.rows);
    }
    stamps.sort((a, b) => b.stamped_at.localeCompare(a.stamped_at));
  }

  const sessionsTouched = new Set(stamps.map((s) => s.administration_id)).size;

  const now = Date.now();
  const openNow = admins.filter(
    (a) => Date.parse(a.opens_at) <= now && now <= Date.parse(a.closes_at),
  ).length;

  return {
    kind: 'workshop',
    dataUnavailable: false,
    rangeStartISO: startISO,
    totalStamps: stamps.length,
    sessionsTouched,
    openNow,
    recent: stamps.slice(0, 10).map((s) => {
      const a = adminById.get(s.administration_id);
      return {
        administration_id: s.administration_id,
        workshop_slug: a?.workshop_slug ?? '',
        section: (a?.section ?? null) as 'CML' | 'CTL' | 'CWL' | 'CRL' | null,
        stamped_at: s.stamped_at,
      };
    }),
  };
}

function unavailableWorkshopMetrics(
  startISO: string | null,
): WorkshopStaffMetrics {
  return {
    kind: 'workshop',
    dataUnavailable: true,
    rangeStartISO: startISO,
    totalStamps: 0,
    sessionsTouched: 0,
    recent: [],
    openNow: 0,
  };
}
