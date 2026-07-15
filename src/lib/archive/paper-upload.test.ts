import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPaperStoragePath,
  docxCentralDirectoryHasRequiredEntries,
  findZipCentralDirectory,
  PAPER_CONTENT_TYPES,
  PAPER_UPLOAD_MAX_BYTES,
  paperFileHasExpectedMagic,
  parseActorScopedPaperPath,
  pathMatchesPaperMetadata,
  resolvePaperContentType,
  storageFileName,
  validatePaperUploadMetadata,
} from './paper-upload.ts';

const actorId = '1041dc31-6a89-44d8-b076-54195ec9a753';
const paperId = '82adca7a-f0c4-43dc-ab78-c241fc1ce95f';

function validMetadata() {
  return {
    course_slug: 'eco-1002',
    kind: 'exam',
    title: 'Midterm review',
    semester_term: 'fall',
    semester_year: 2026,
    covers: ['eco-1002/solow'],
    file_name: 'Midterm Review.pdf',
    content_type: PAPER_CONTENT_TYPES.pdf,
    size_bytes: 1024,
  };
}

test('validates a PDF upload and normalizes server-owned fields', () => {
  const result = validatePaperUploadMetadata(validMetadata());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.title, 'Midterm review');
  assert.equal(result.value.fileName, 'Midterm Review.pdf');
  assert.equal(result.value.sizeBytes, 1024);
});

test('rejects extension/MIME mismatches, traversal names, and oversized files', () => {
  assert.deepEqual(
    validatePaperUploadMetadata({
      ...validMetadata(),
      file_name: 'exam.docx',
    }),
    { ok: false, reason: 'bad_file_type' },
  );
  assert.deepEqual(
    validatePaperUploadMetadata({
      ...validMetadata(),
      file_name: '../exam.pdf',
    }),
    { ok: false, reason: 'bad_file_name' },
  );
  assert.deepEqual(
    validatePaperUploadMetadata({
      ...validMetadata(),
      size_bytes: PAPER_UPLOAD_MAX_BYTES + 1,
    }),
    { ok: false, reason: 'file_too_large' },
  );
  assert.deepEqual(
    validatePaperUploadMetadata({
      ...validMetadata(),
      semester_year: '2026',
    }),
    { ok: false, reason: 'invalid_input' },
  );
});

test('builds and parses a unique actor-scoped storage path', () => {
  const path = buildPaperStoragePath(
    actorId,
    'eco-1002',
    paperId,
    'Midterm Review.pdf',
  );
  assert.equal(path, `${actorId}/eco-1002/${paperId}/Midterm_Review.pdf`);
  const parsed = parseActorScopedPaperPath(path, actorId);
  assert.deepEqual(parsed, {
    courseSlug: 'eco-1002',
    paperId,
    fileName: 'Midterm_Review.pdf',
  });
  assert.equal(
    parseActorScopedPaperPath(path, '51d60934-caf8-4ebc-9e86-a2d32b849ac7'),
    null,
  );
  assert.equal(storageFileName('  Exam (final).DOCX'), 'Exam_final.docx');
});

test('binds a prepared path to the finalized metadata', () => {
  const result = validatePaperUploadMetadata(validMetadata());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const path = parseActorScopedPaperPath(
    buildPaperStoragePath(actorId, 'eco-1002', paperId, result.value.fileName),
    actorId,
  );
  assert.ok(path);
  assert.equal(pathMatchesPaperMetadata(path, result.value), true);
  assert.equal(
    pathMatchesPaperMetadata(path, { ...result.value, courseSlug: 'fin-3610' }),
    false,
  );
});

test('checks PDF and docx magic bytes', () => {
  assert.equal(
    paperFileHasExpectedMagic(
      new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]),
      PAPER_CONTENT_TYPES.pdf,
    ),
    true,
  );
  assert.equal(
    paperFileHasExpectedMagic(
      new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
      PAPER_CONTENT_TYPES.docx,
    ),
    true,
  );
  assert.equal(
    paperFileHasExpectedMagic(
      new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
      PAPER_CONTENT_TYPES.pdf,
    ),
    false,
  );
});

test('resolves generic browser MIME values from a supported extension', () => {
  assert.equal(
    resolvePaperContentType('exam.pdf', 'application/octet-stream'),
    PAPER_CONTENT_TYPES.pdf,
  );
  assert.equal(
    resolvePaperContentType('exam.docx', 'application/zip'),
    PAPER_CONTENT_TYPES.docx,
  );
  assert.equal(
    resolvePaperContentType('exam.pdf', PAPER_CONTENT_TYPES.docx),
    null,
  );
  assert.equal(resolvePaperContentType('exam.zip', 'application/zip'), null);
});

function centralEntry(name: string): Uint8Array {
  const encoded = new TextEncoder().encode(name);
  const bytes = new Uint8Array(46 + encoded.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(28, encoded.length, true);
  bytes.set(encoded, 46);
  return bytes;
}

function join(parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(
    parts.reduce((sum, part) => sum + part.length, 0),
  );
  let cursor = 0;
  for (const part of parts) {
    output.set(part, cursor);
    cursor += part.length;
  }
  return output;
}

test('requires the core OOXML entries in a bounded ZIP central directory', () => {
  const central = join([
    centralEntry('[Content_Types].xml'),
    centralEntry('_rels/.rels'),
    centralEntry('word/document.xml'),
  ]);
  assert.equal(docxCentralDirectoryHasRequiredEntries(central, 3), true);
  assert.equal(docxCentralDirectoryHasRequiredEntries(central, 4), false);
  assert.equal(
    docxCentralDirectoryHasRequiredEntries(
      join([centralEntry('[Content_Types].xml'), centralEntry('_rels/.rels')]),
      2,
    ),
    false,
  );

  const prefix = new Uint8Array(16);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, 3, true);
  endView.setUint16(10, 3, true);
  endView.setUint32(12, central.length, true);
  endView.setUint32(16, prefix.length, true);
  const archive = join([prefix, central, end]);
  assert.deepEqual(findZipCentralDirectory(archive, 0, archive.length), {
    offset: prefix.length,
    size: central.length,
    entries: 3,
  });
});
