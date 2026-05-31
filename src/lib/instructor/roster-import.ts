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

import { getAdminClient, listAllAuthUsers, selectAllRows } from '@lib/supabase/admin';
import type { CourseSlug } from '@lib/courses';
import { parseRosterCsv } from './roster-csv';

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
  /** True when this class already exists under a different instructor and
   *  the caller is not an admin — apply will be rejected. */
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
  readonly code: 'forbidden' | 'failed';
  constructor(code: 'forbidden' | 'failed', message: string) {
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
      .range(from, to),
  );
  if (error) {
    throw new RosterImportError('failed', `Failed to load existing enrollments: ${error}`);
  }
  const map = new Map<string, ExistingEnrollment>();
  for (const r of rows) map.set(r.user_id, r);
  return map;
}

/**
 * A non-admin may import into a class only if it is brand-new (no existing
 * enrollments for this course+semester) or they already own it. Importing
 * into another instructor's class is forbidden — it would otherwise let one
 * staff member reassign/overwrite another's roster.
 */
function isOwnedByOther(
  existing: Map<string, ExistingEnrollment>,
  instructorId: string,
  isAdmin: boolean,
): boolean {
  if (isAdmin || existing.size === 0) return false;
  for (const r of existing.values()) {
    if (r.instructor_id === instructorId) return false;
  }
  return true;
}

async function planImport(course: CourseSlug, semester: string, csvText: string) {
  const parsed = parseRosterCsv(csvText);
  const admin = getAdminClient();
  const [emailToId, existing] = await Promise.all([
    fetchEmailToId(),
    fetchExisting(admin, course, semester),
  ]);

  const toEnroll: ImportMatchRow[] = [];
  const toUpdate: ImportMatchRow[] = [];
  const unmatched: ImportMatchRow[] = [];
  for (const r of parsed.rows) {
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
  course: CourseSlug,
  semester: string,
  csvText: string,
): Promise<ImportPreview> {
  const p = await planImport(course, semester, csvText);
  return {
    toEnroll: p.toEnroll,
    toUpdate: p.toUpdate,
    unmatched: p.unmatched,
    parseErrors: p.parsed.errors,
    total: p.parsed.rows.length,
    ownedByOther: isOwnedByOther(p.existing, instructorId, isAdmin),
  };
}

/**
 * Apply the import: upsert matched rows into enrollments (idempotent on the
 * (user_id, course_slug, semester) PK). For students already enrolled we
 * PRESERVE the existing instructor_id (never reassign ownership) and only
 * overwrite student_name/section when the CSV actually supplies a value
 * (an email-only re-import must not null out previously imported names).
 * New students are created with instructor_id = the importer.
 *
 * Throws RosterImportError('forbidden') when a non-admin tries to import
 * into a class owned by another instructor.
 */
export async function applyImport(
  instructorId: string,
  isAdmin: boolean,
  course: CourseSlug,
  semester: string,
  csvText: string,
): Promise<ImportResult> {
  const p = await planImport(course, semester, csvText);

  if (isOwnedByOther(p.existing, instructorId, isAdmin)) {
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
        course_slug: course,
        semester,
        // Preserve the existing owner; only brand-new rows get the importer.
        instructor_id: ex ? ex.instructor_id : instructorId,
        // Coalesce: keep the previously imported value when the CSV omits it.
        student_name: r.name ?? ex?.student_name ?? null,
        section: r.section ?? ex?.section ?? null,
      };
    });
    const { error } = await p.admin
      .from('enrollments')
      .upsert(payload, { onConflict: 'user_id,course_slug,semester' });
    if (error) throw new RosterImportError('failed', `enrollment upsert failed: ${error.message}`);
  }

  return {
    enrolled: p.toEnroll.length,
    updated: p.toUpdate.length,
    skipped: p.unmatched.length,
    total: p.parsed.rows.length,
  };
}
