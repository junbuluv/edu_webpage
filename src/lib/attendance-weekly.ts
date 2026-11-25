// Weekly attendance matrix built from workshop administrations + stamps.
//
// Weeks are the distinct `week_of` Mondays of non-cancelled
// administrations; there is no semester calendar. Every student on the
// roster is eligible for every week. Alias-free so `node --test` can run
// the unit tests.

export interface WeeklyAdministration {
  id: string;
  week_of: string; // Monday, YYYY-MM-DD
  closes_at: string; // ISO timestamp
}

export interface WeeklyStamp {
  user_id: string;
  administration_id: string;
}

export type WeeklyCell = 'attended' | 'missed' | 'pending';

export interface WeeklyAttendance {
  /** Sorted ascending list of week_of Mondays. */
  weeks: string[];
  /** userId -> cell per week, aligned with `weeks`. */
  cellsByUser: Map<string, WeeklyCell[]>;
}

export function buildWeeklyAttendance(
  administrations: WeeklyAdministration[],
  stamps: WeeklyStamp[],
  rosterUserIds: Iterable<string>,
  nowMs: number,
): WeeklyAttendance {
  const weeks = [...new Set(administrations.map((a) => a.week_of))].sort();
  const adminById = new Map(administrations.map((a) => [a.id, a]));
  const roster = new Set(rosterUserIds);

  // A week is still pending while any of its windows is open.
  const openWeeks = new Set(
    administrations
      .filter((a) => Date.parse(a.closes_at) >= nowMs)
      .map((a) => a.week_of),
  );

  const stampedWeeksByUser = new Map<string, Set<string>>();
  for (const s of stamps) {
    const a = adminById.get(s.administration_id);
    if (!a || !roster.has(s.user_id)) continue; // unknown window or off-roster
    let set = stampedWeeksByUser.get(s.user_id);
    if (!set) stampedWeeksByUser.set(s.user_id, (set = new Set()));
    set.add(a.week_of);
  }

  const cellsByUser = new Map<string, WeeklyCell[]>();
  for (const userId of roster) {
    const stamped = stampedWeeksByUser.get(userId);
    cellsByUser.set(
      userId,
      weeks.map((week) =>
        stamped?.has(week)
          ? 'attended'
          : openWeeks.has(week)
            ? 'pending'
            : 'missed',
      ),
    );
  }

  return { weeks, cellsByUser };
}

export const WEEKLY_CELL_SYMBOL: Record<WeeklyCell, string> = {
  attended: '✓',
  missed: '✗',
  pending: '·',
};

/** CSV cell: 1 attended, 0 missed, blank while pending. */
export function weeklyCellCsv(cell: WeeklyCell): string {
  if (cell === 'attended') return '1';
  if (cell === 'missed') return '0';
  return '';
}
