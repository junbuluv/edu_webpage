// Roster CSV export (instructor class page). Pure and alias-free so it can be
// unit-tested with `node --test`; the page passes in weeklyCellCsv from
// attendance-weekly.ts rather than this module importing it.

export type RosterExportStudent = {
  name: string | null;
  email: string | null;
  section: string | null;
  lessonsCompleted: number;
  lessonsTotal: number;
  /** Distinct quizzes attempted. */
  quizzesTaken: number;
  /** Every attempt, retries included. */
  quizAttempts: number;
  avgFirstScore: number | null;
  avgBestScore: number | null;
  attendanceCount: number;
  weeklyCells: readonly string[];
  lastActiveAt: string | null;
  risk: { atRisk: boolean; reasons: readonly string[] };
};

// Spreadsheets read a cell as a formula when it starts with = + - @, tab, CR,
// or LF. Some importers trim leading whitespace first or accept the
// full-width forms (U+FF1D, U+FF0B, U+FF0D, U+FF20), so the first
// non-whitespace character counts too. Names in this export are partly
// student-controlled (display names), so this matters.
const FORMULA_START = /^[\t\r\n]|^\s*[=+\-@＝＋－＠]/;

/**
 * One CSV cell: formula-like text gets a leading apostrophe so it stays text,
 * and cells with a quote, comma, CR, or LF are quoted.
 */
export function csvCell(v: string | number | null): string {
  let s = v == null ? '' : String(v);
  if (FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function rosterExportHeader(weeks: readonly string[]): string[] {
  return [
    'name',
    'email',
    'section',
    'lessons_completed',
    'lessons_total',
    'quizzes_taken',
    'quiz_attempts',
    'avg_first_score',
    'avg_best_score',
    'attendance',
    ...weeks.map((w) => `week_${w}`),
    'last_active',
    'at_risk',
    'risk_reasons',
  ];
}

const score = (v: number | null) =>
  v == null ? '' : Math.round(v * 100) / 100;

export function rosterExportRow<Cell extends string>(
  s: RosterExportStudent & { weeklyCells: readonly Cell[] },
  weeklyCell: (cell: Cell) => string,
): string {
  return [
    csvCell(s.name),
    csvCell(s.email),
    csvCell(s.section),
    s.lessonsCompleted,
    s.lessonsTotal,
    s.quizzesTaken,
    s.quizAttempts,
    score(s.avgFirstScore),
    score(s.avgBestScore),
    s.attendanceCount,
    ...s.weeklyCells.map(weeklyCell),
    csvCell(s.lastActiveAt),
    s.risk.atRisk ? 'yes' : 'no',
    csvCell(s.risk.reasons.join('; ')),
  ].join(',');
}
