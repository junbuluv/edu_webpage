// Weekly attendance matrix built from workshop administrations + stamps.
//
// Weeks are the distinct `week_of` Mondays of non-cancelled
// administrations; there is no semester calendar. A student is eligible
// for a week when at least one administration that week matches their
// section (`section = null` administrations, the FIN 3610 shape, match
// every student). Alias-free so `node --test` can run the unit tests.

export interface WeeklyAdministration {
  id: string;
  week_of: string; // Monday, YYYY-MM-DD
  section: string | null;
  closes_at: string; // ISO timestamp
}

export interface WeeklyStamp {
  user_id: string;
  administration_id: string;
}

export type WeeklyCell = 'attended' | 'missed' | 'pending' | 'ineligible';

export interface WeeklyAttendance {
  /** Sorted ascending list of week_of Mondays. */
  weeks: string[];
  /** userId -> cell per week, aligned with `weeks`. */
  cellsByUser: Map<string, WeeklyCell[]>;
}

export function buildWeeklyAttendance(
  administrations: WeeklyAdministration[],
  stamps: WeeklyStamp[],
  sectionByUser: Map<string, string | null>,
  nowMs: number,
): WeeklyAttendance {
  const weeks = [...new Set(administrations.map((a) => a.week_of))].sort();
  const weekIndex = new Map(weeks.map((w, i) => [w, i]));
  const adminById = new Map(administrations.map((a) => [a.id, a]));

  const stampedWeeksByUser = new Map<string, Set<string>>();
  for (const s of stamps) {
    const a = adminById.get(s.administration_id);
    if (!a) continue;
    const section = sectionByUser.get(s.user_id);
    if (section === undefined) continue; // not on this roster
    if (a.section !== null && a.section !== section) continue;
    let set = stampedWeeksByUser.get(s.user_id);
    if (!set) stampedWeeksByUser.set(s.user_id, (set = new Set()));
    set.add(a.week_of);
  }

  const cellsByUser = new Map<string, WeeklyCell[]>();
  for (const [userId, section] of sectionByUser) {
    const stamped = stampedWeeksByUser.get(userId) ?? new Set<string>();
    const cells: WeeklyCell[] = weeks.map(() => 'ineligible');
    for (const a of administrations) {
      if (a.section !== null && a.section !== section) continue;
      const i = weekIndex.get(a.week_of)!;
      if (stamped.has(a.week_of)) {
        cells[i] = 'attended';
        continue;
      }
      // Eligible but unstamped: missed only once every matching window
      // that week has closed; otherwise still pending.
      const open = Date.parse(a.closes_at) >= nowMs;
      if (cells[i] === 'ineligible') cells[i] = open ? 'pending' : 'missed';
      else if (cells[i] === 'missed' && open) cells[i] = 'pending';
    }
    cellsByUser.set(userId, cells);
  }

  return { weeks, cellsByUser };
}

export const WEEKLY_CELL_SYMBOL: Record<WeeklyCell, string> = {
  attended: '✓',
  missed: '✗',
  pending: '·',
  ineligible: '–',
};

/** CSV cell: 1 attended, 0 missed, blank otherwise. */
export function weeklyCellCsv(cell: WeeklyCell): string {
  if (cell === 'attended') return '1';
  if (cell === 'missed') return '0';
  return '';
}
