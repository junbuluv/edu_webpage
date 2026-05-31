// Pure roster-CSV parsing — no I/O, no path-alias imports — so it can be
// unit-tested directly with `node --test src/lib/instructor/roster-csv.test.ts`
// (Node strips TS types but does NOT resolve tsconfig path aliases, so the
// service-role code that needs @lib/* lives in roster-import.ts instead).

export interface ParsedRosterRow {
  email: string; // normalized: trimmed + lowercased
  name: string | null;
  section: string | null;
}

export interface ParseResult {
  rows: ParsedRosterRow[];
  errors: string[];
}

/**
 * RFC-4180-ish tokenizer: handles quoted fields, escaped "" quotes,
 * embedded commas/newlines inside quotes, and CRLF line endings.
 */
function tokenize(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let sawAny = false;

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
      sawAny = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
      sawAny = true;
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      sawAny = false;
    } else if (c === '\r') {
      // ignore; newline handled on \n
    } else {
      field += c;
      sawAny = true;
    }
  }
  if (sawAny || field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function looksLikeEmail(s: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
}

/**
 * Parse a header-based roster CSV. Requires an `email` column; `name` and
 * `section` are optional. Emails are trimmed + lowercased and de-duplicated
 * (last occurrence wins). Returns parse errors for missing/invalid rows.
 */
export function parseRosterCsv(text: string): ParseResult {
  const errors: string[] = [];
  const grid = tokenize(text).filter((r) => r.some((c) => c.trim() !== ''));
  if (grid.length === 0) {
    return { rows: [], errors: ['No rows found. Paste a CSV with an "email" column.'] };
  }

  const header = grid[0].map((h) => h.trim().toLowerCase());
  const emailIdx = header.indexOf('email');
  const nameIdx = header.indexOf('name');
  const sectionIdx = header.indexOf('section');
  if (emailIdx === -1) {
    return { rows: [], errors: ['Header row must include an "email" column.'] };
  }

  const byEmail = new Map<string, ParsedRosterRow>();
  for (let i = 1; i < grid.length; i += 1) {
    const cells = grid[i];
    const lineNo = i + 1; // 1-based, header is line 1
    const email = (cells[emailIdx] ?? '').trim().toLowerCase();
    if (!email) {
      errors.push(`Line ${lineNo}: missing email — skipped.`);
      continue;
    }
    if (!looksLikeEmail(email)) {
      errors.push(`Line ${lineNo}: "${email}" is not a valid email — skipped.`);
      continue;
    }
    const name = nameIdx === -1 ? null : (cells[nameIdx] ?? '').trim() || null;
    const section = sectionIdx === -1 ? null : (cells[sectionIdx] ?? '').trim() || null;
    byEmail.set(email, { email, name, section });
  }

  return { rows: [...byEmail.values()], errors };
}
