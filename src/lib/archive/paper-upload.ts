import { isCourseSlug, type CourseSlug } from '../courses.ts';

export const PAPER_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;
export const PAPER_UPLOAD_BUCKET = 'archive-papers';
export const PAPER_UPLOAD_MAX_ZIP_DIRECTORY_BYTES = 1024 * 1024;

export const PAPER_CONTENT_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
} as const;

export type PaperContentType =
  (typeof PAPER_CONTENT_TYPES)[keyof typeof PAPER_CONTENT_TYPES];
export type PaperKind = 'exam' | 'assignment';
export type SemesterTerm = 'spring' | 'summer' | 'fall';

export interface PaperUploadMetadata {
  courseSlug: CourseSlug;
  kind: PaperKind;
  title: string;
  semesterTerm: SemesterTerm;
  semesterYear: number;
  covers: string[];
  fileName: string;
  contentType: PaperContentType;
  sizeBytes: number;
}

export type PaperUploadValidation =
  | { ok: true; value: PaperUploadMetadata }
  | { ok: false; reason: string };

interface RawMetadata {
  course_slug?: unknown;
  kind?: unknown;
  title?: unknown;
  semester_term?: unknown;
  semester_year?: unknown;
  covers?: unknown;
  file_name?: unknown;
  content_type?: unknown;
  size_bytes?: unknown;
}

const TERMS = new Set<SemesterTerm>(['spring', 'summer', 'fall']);
const KINDS = new Set<PaperKind>(['exam', 'assignment']);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function expectedExtension(contentType: PaperContentType): string {
  return contentType === PAPER_CONTENT_TYPES.pdf ? '.pdf' : '.docx';
}

export function resolvePaperContentType(
  fileName: string,
  browserContentType: string,
): PaperContentType | null {
  const lowerName = fileName.toLowerCase();
  const expected = lowerName.endsWith('.pdf')
    ? PAPER_CONTENT_TYPES.pdf
    : lowerName.endsWith('.docx')
      ? PAPER_CONTENT_TYPES.docx
      : null;
  if (!expected) return null;

  const reported = browserContentType.trim().toLowerCase();
  if (reported === expected) return expected;
  const genericTypes = new Set([
    '',
    'application/octet-stream',
    ...(expected === PAPER_CONTENT_TYPES.docx
      ? ['application/zip', 'application/x-zip-compressed']
      : []),
  ]);
  return genericTypes.has(reported) ? expected : null;
}

export function validatePaperUploadMetadata(
  input: unknown,
): PaperUploadValidation {
  if (!isRecord(input)) return { ok: false, reason: 'invalid_payload' };
  const raw = input as RawMetadata;

  const course =
    typeof raw.course_slug === 'string' ? raw.course_slug.trim() : '';
  if (!isCourseSlug(course)) return { ok: false, reason: 'invalid_course' };

  const kind = typeof raw.kind === 'string' ? raw.kind : '';
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const term = typeof raw.semester_term === 'string' ? raw.semester_term : '';
  const year =
    typeof raw.semester_year === 'number' ? raw.semester_year : Number.NaN;

  if (
    !KINDS.has(kind as PaperKind) ||
    !title ||
    title.length > 200 ||
    !TERMS.has(term as SemesterTerm) ||
    !Number.isInteger(year) ||
    year < 2020 ||
    year > 2100
  ) {
    return { ok: false, reason: 'invalid_input' };
  }

  if (!Array.isArray(raw.covers) || raw.covers.length > 100) {
    return { ok: false, reason: 'invalid_input' };
  }
  const covers: string[] = [];
  for (const cover of raw.covers) {
    if (
      typeof cover !== 'string' ||
      cover.length === 0 ||
      cover.length > 200 ||
      covers.includes(cover)
    ) {
      return { ok: false, reason: 'invalid_input' };
    }
    covers.push(cover);
  }

  const fileName =
    typeof raw.file_name === 'string' ? raw.file_name.trim() : '';
  if (
    !fileName ||
    fileName.length > 160 ||
    fileName === '.' ||
    fileName === '..' ||
    /[\\/\u0000-\u001f\u007f]/.test(fileName)
  ) {
    return { ok: false, reason: 'bad_file_name' };
  }

  const contentType =
    typeof raw.content_type === 'string' ? raw.content_type.toLowerCase() : '';
  if (
    contentType !== PAPER_CONTENT_TYPES.pdf &&
    contentType !== PAPER_CONTENT_TYPES.docx
  ) {
    return { ok: false, reason: 'bad_file_type' };
  }
  if (!fileName.toLowerCase().endsWith(expectedExtension(contentType))) {
    return { ok: false, reason: 'bad_file_type' };
  }

  const sizeBytes =
    typeof raw.size_bytes === 'number' ? raw.size_bytes : Number.NaN;
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
    return { ok: false, reason: 'missing_file' };
  }
  if (sizeBytes > PAPER_UPLOAD_MAX_BYTES) {
    return { ok: false, reason: 'file_too_large' };
  }

  return {
    ok: true,
    value: {
      courseSlug: course,
      kind: kind as PaperKind,
      title,
      semesterTerm: term as SemesterTerm,
      semesterYear: year,
      covers,
      fileName,
      contentType,
      sizeBytes,
    },
  };
}

export function storageFileName(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  const extension = dot > 0 ? fileName.slice(dot).toLowerCase() : '';
  const rawStem = dot > 0 ? fileName.slice(0, dot) : fileName;
  const stem =
    rawStem
      .normalize('NFKC')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 100)
      .replace(/^[_-]+|[_-]+$/g, '') || 'file';
  return `${stem}${extension}`;
}

export function buildPaperStoragePath(
  actorId: string,
  courseSlug: CourseSlug,
  paperId: string,
  fileName: string,
): string {
  return `${actorId}/${courseSlug}/${paperId}/${storageFileName(fileName)}`;
}

export interface ActorScopedPaperPath {
  courseSlug: CourseSlug;
  paperId: string;
  fileName: string;
}

export function parseActorScopedPaperPath(
  path: unknown,
  actorId: string,
): ActorScopedPaperPath | null {
  if (typeof path !== 'string' || path.length > 500) return null;
  const parts = path.split('/');
  if (parts.length !== 4 || parts[0] !== actorId) return null;
  const [, course, paperId, fileName] = parts;
  if (!isCourseSlug(course) || !UUID_RE.test(paperId) || !fileName) return null;
  return { courseSlug: course, paperId, fileName };
}

export function pathMatchesPaperMetadata(
  path: ActorScopedPaperPath,
  metadata: PaperUploadMetadata,
): boolean {
  return (
    path.courseSlug === metadata.courseSlug &&
    path.fileName === storageFileName(metadata.fileName)
  );
}

export function paperFileHasExpectedMagic(
  bytes: Uint8Array,
  contentType: PaperContentType,
): boolean {
  if (contentType === PAPER_CONTENT_TYPES.pdf) {
    return (
      bytes.length >= 5 &&
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46 &&
      bytes[4] === 0x2d
    );
  }
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
}

export interface ZipCentralDirectory {
  offset: number;
  size: number;
  entries: number;
}

function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

export function findZipCentralDirectory(
  tail: Uint8Array,
  tailOffset: number,
  totalSize: number,
): ZipCentralDirectory | null {
  if (
    tail.length < 22 ||
    tailOffset < 0 ||
    tailOffset + tail.length !== totalSize
  ) {
    return null;
  }
  const view = viewOf(tail);
  for (let cursor = tail.length - 22; cursor >= 0; cursor -= 1) {
    if (view.getUint32(cursor, true) !== 0x06054b50) continue;
    const commentLength = view.getUint16(cursor + 20, true);
    if (cursor + 22 + commentLength !== tail.length) continue;

    const disk = view.getUint16(cursor + 4, true);
    const centralDisk = view.getUint16(cursor + 6, true);
    const diskEntries = view.getUint16(cursor + 8, true);
    const entries = view.getUint16(cursor + 10, true);
    const size = view.getUint32(cursor + 12, true);
    const offset = view.getUint32(cursor + 16, true);
    if (
      disk !== 0 ||
      centralDisk !== 0 ||
      diskEntries !== entries ||
      entries === 0 ||
      entries > 10_000 ||
      size === 0 ||
      size > PAPER_UPLOAD_MAX_ZIP_DIRECTORY_BYTES ||
      offset + size > tailOffset + cursor
    ) {
      return null;
    }
    return { offset, size, entries };
  }
  return null;
}

const REQUIRED_DOCX_ENTRIES = new Set([
  '[Content_Types].xml',
  '_rels/.rels',
  'word/document.xml',
]);

export function docxCentralDirectoryHasRequiredEntries(
  centralDirectory: Uint8Array,
  expectedEntries: number,
): boolean {
  const found = new Set<string>();
  const view = viewOf(centralDirectory);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let cursor = 0;

  try {
    for (let entry = 0; entry < expectedEntries; entry += 1) {
      if (
        cursor + 46 > centralDirectory.length ||
        view.getUint32(cursor, true) !== 0x02014b50
      ) {
        return false;
      }
      const flags = view.getUint16(cursor + 8, true);
      if ((flags & 0x1) !== 0) return false;
      const nameLength = view.getUint16(cursor + 28, true);
      const extraLength = view.getUint16(cursor + 30, true);
      const commentLength = view.getUint16(cursor + 32, true);
      const next = cursor + 46 + nameLength + extraLength + commentLength;
      if (nameLength === 0 || next > centralDirectory.length) return false;
      const name = decoder.decode(
        centralDirectory.subarray(cursor + 46, cursor + 46 + nameLength),
      );
      if (REQUIRED_DOCX_ENTRIES.has(name)) found.add(name);
      cursor = next;
    }
  } catch {
    return false;
  }

  return found.size === REQUIRED_DOCX_ENTRIES.size;
}
