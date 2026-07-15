// Bulk roster import (Phase 2). An instructor pastes a registrar CSV; we
// match rows to existing accounts by email and upsert enrollments. Rows
// without an account yet are reported (skip + report) for re-import later
// once those students sign up — the upsert makes re-running safe.
//
// The pure CSV parser lives in ./roster-csv.ts (no @lib aliases) and is
// unit-tested with `node --test src/lib/instructor/roster-csv.test.ts`.
// This module imports the service-role admin client, so it is intentionally
// NOT node --test runnable. Writes go through service-role + an app-side
// ownership check here (enrollments has no INSERT RLS policy), consistent
// with the other instructor write-paths.

import {
  getAdminClient,
  listAllAuthUsers,
  selectAllRows,
} from '@lib/supabase/admin';
import type { CourseSlug } from '@lib/courses';
import { hasActiveTeachingAssignment } from './class-access';
import { parseRosterCsv } from './roster-csv';

const ECO_SECTIONS = new Set(['CML', 'CTL', 'CWL', 'CRL']);
const MAX_CSV_CHARS = 1_000_000;
const MAX_ROSTER_ROWS = 5_000;

export type { ParsedRosterRow, ParseResult } from './roster-csv';
export { parseRosterCsv } from './roster-csv';

// ---------- match + write (service-role) ----------

export interface ImportMatchRow {
  email: string;
  name: string | null;
  section: string | null;
  userId: string | null;
  alreadyEnrolled: boolean;
}

export interface ImportPreview {
  toEnroll: ImportMatchRow[];
  toUpdate: ImportMatchRow[];
  unmatched: ImportMatchRow[];
  parseErrors: string[];
  total: number;
  /** True when at least one matched student belongs to a different instructor
   *  in the same course and term. Apply will be rejected so a bulk upload can
   *  never silently transfer or overwrite a co-instructor's student. */
  ownedByOther: boolean;
}

export interface ImportResult {
  enrolled: number;
  updated: number;
  skipped: number;
  total: number;
}

/** Thrown by applyImport; the page maps `code` to a friendly banner. */
export class RosterImportError extends Error {
  readonly code: 'forbidden' | 'invalid' | 'failed';
  constructor(code: 'forbidden' | 'invalid' | 'failed', message: string) {
    super(message);
    this.code = code;
    this.name = 'RosterImportError';
  }
}

type Admin = ReturnType<typeof getAdminClient>;

type ExistingEnrollment = {
  user_id: string;
  instructor_id: string;
  student_name: string | null;
  section: string | null;
};

async function fetchEmailToId(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const u of await listAllAuthUsers()) {
    if (u.email) map.set(u.email.toLowerCase(), u.id);
  }
  return map;
}

async function fetchExisting(
  admin: Admin,
  course: CourseSlug,
  semester: string,
): Promise<Map<string, ExistingEnrollment>> {
  // Paginated, and an error MUST propagate: this read drives the ownership
  // gate, so a silent empty map would let an errored fetch look like a
  // brand-new class and bypass the check. Fail closed.
  const { rows, error } = await selectAllRows<ExistingEnrollment>((from, to) =>
    admin
      .from('enrollments')
      .select('user_id, instructor_id, student_name, section')
      .eq('course_slug', course)
      .eq('semester', semester)
      .order('user_id', { ascending: true })
      .range(from, to),
  );
  if (error) {
    throw new RosterImportError(
      'failed',
      `Failed to load existing enrollments: ${error}`,
    );
  }
  const map = new Map<string, ExistingEnrollment>();
  for (const r of rows) map.set(r.user_id, r);
  return map;
}

/**
 * A bulk import may update only enrollment rows already owned by the selected
 * assignment. Cross-instructor transfers must be deliberate, one-student
 * admin actions from the roster screen.
 */
function isOwnedByOther(
  matched: ImportMatchRow[],
  existing: Map<string, ExistingEnrollment>,
  instructorId: string,
): boolean {
  return matched.some((row) => {
    const enrollment = row.userId ? existing.get(row.userId) : null;
    return enrollment != null && enrollment.instructor_id !== instructorId;
  });
}

async function planImport(
  course: CourseSlug,
  semester: string,
  csvText: string,
) {
  if (csvText.length > MAX_CSV_CHARS) {
    throw new RosterImportError('invalid', 'Roster CSV is too large.');
  }
  const parsed = parseRosterCsv(csvText);
  if (parsed.rows.length > MAX_ROSTER_ROWS) {
    throw new RosterImportError('invalid', 'Roster has too many rows.');
  }
  const validRows: Array<{
    email: string;
    name: string | null;
    section: string | null;
  }> = [];
  for (const row of parsed.rows) {
    if ((row.name?.length ?? 0) > 120) {
      parsed.errors.push(`${row.email}: name exceeds 120 characters`);
      continue;
    }
    if (course === 'eco-1002' && !ECO_SECTIONS.has(row.section ?? '')) {
      parsed.errors.push(`${row.email}: a valid ECO 1002 section is required`);
      continue;
    }
    validRows.push({
      ...row,
      section: course === 'eco-1002' ? row.section : null,
    });
  }
  const admin = getAdminClient();
  const [emailToId, existing] = await Promise.all([
    fetchEmailToId(),
    fetchExisting(admin, course, semester),
  ]);

  const toEnroll: ImportMatchRow[] = [];
  const toUpdate: ImportMatchRow[] = [];
  const unmatched: ImportMatchRow[] = [];
  for (const r of validRows) {
    const userId = emailToId.get(r.email) ?? null;
    const alreadyEnrolled = userId ? existing.has(userId) : false;
    const row: ImportMatchRow = { ...r, userId, alreadyEnrolled };
    if (!userId) unmatched.push(row);
    else if (alreadyEnrolled) toUpdate.push(row);
    else toEnroll.push(row);
  }
  return { admin, parsed, existing, toEnroll, toUpdate, unmatched };
}

/**
 * Dry run: classify each parsed row as enroll / update / unmatched and report
 * whether the caller is allowed to apply (ownership). No writes.
 */
export async function previewImport(
  instructorId: string,
  isAdmin: boolean,
  targetInstructorId: string,
  course: CourseSlug,
  semester: string,
  csvText: string,
): Promise<ImportPreview> {
  if (
    !(await hasActiveTeachingAssignment(targetInstructorId, course, semester))
  ) {
    throw new RosterImportError(
      'forbidden',
      'An active teaching assignment is required for this class.',
    );
  }
  if (!isAdmin && targetInstructorId !== instructorId) {
    throw new RosterImportError('forbidden', 'Invalid instructor assignment.');
  }
  const p = await planImport(course, semester, csvText);
  return {
    toEnroll: p.toEnroll,
    toUpdate: p.toUpdate,
    unmatched: p.unmatched,
    parseErrors: p.parsed.errors,
    total: p.toEnroll.length + p.toUpdate.length + p.unmatched.length,
    ownedByOther: isOwnedByOther(p.toUpdate, p.existing, targetInstructorId),
  };
}

/**
 * Apply the import atomically. The database rechecks the preview's expected
 * row state and active assignment under advisory locks, so a concurrent
 * transfer or revocation fails the whole import instead of partially writing.
 *
 * Throws RosterImportError('forbidden') when a non-admin tries to import
 * into a class owned by another instructor.
 */
export async function applyImport(
  instructorId: string,
  isAdmin: boolean,
  targetInstructorId: string,
  course: CourseSlug,
  semester: string,
  csvText: string,
): Promise<ImportResult> {
  if (
    !(await hasActiveTeachingAssignment(targetInstructorId, course, semester))
  ) {
    throw new RosterImportError(
      'forbidden',
      'An active teaching assignment is required for this class.',
    );
  }
  if (!isAdmin && targetInstructorId !== instructorId) {
    throw new RosterImportError('forbidden', 'Invalid instructor assignment.');
  }
  const p = await planImport(course, semester, csvText);

  if (isOwnedByOther(p.toUpdate, p.existing, targetInstructorId)) {
    throw new RosterImportError(
      'forbidden',
      'This course and semester is managed by another instructor.',
    );
  }

  const writeRows = [...p.toEnroll, ...p.toUpdate].filter(
    (r): r is ImportMatchRow & { userId: string } => r.userId !== null,
  );
  if (writeRows.length > 0) {
    const payload = writeRows.map((r) => {
      const ex = p.existing.get(r.userId);
      return {
        user_id: r.userId,
        student_name: r.name ?? ex?.student_name ?? null,
        section: r.section ?? ex?.section ?? null,
        expected_existing: ex != null,
      };
    });
    const { data: applied, error } = await p.admin.rpc('apply_roster_import', {
      p_actor_id: instructorId,
      p_instructor_id: targetInstructorId,
      p_course_slug: course,
      p_semester: semester,
      p_rows: payload,
    });
    if (error || !applied)
      throw new RosterImportError(
        'failed',
        error
          ? `roster import failed: ${error.message}`
          : 'Roster changed while the import was being applied. Preview it again.',
      );
  }

  return {
    enrolled: p.toEnroll.length,
    updated: p.toUpdate.length,
    skipped: p.unmatched.length,
    total: p.toEnroll.length + p.toUpdate.length + p.unmatched.length,
  };
}
