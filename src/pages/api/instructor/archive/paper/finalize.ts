import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { instructorOwnsCourse } from '@lib/archive/access';
import { normalizeLessonSlug } from '@lib/archive/build';
import {
  docxCentralDirectoryHasRequiredEntries,
  findZipCentralDirectory,
  PAPER_CONTENT_TYPES,
  PAPER_UPLOAD_BUCKET,
  PAPER_UPLOAD_MAX_BYTES,
  paperFileHasExpectedMagic,
  parseActorScopedPaperPath,
  validatePaperUploadMetadata,
} from '@lib/archive/paper-upload';
import { logDisclosureSafe } from '@lib/audit';
import { isContentManager } from '@lib/roles';
import { getAdminClient } from '@lib/supabase/admin';

const MAX_JSON_BYTES = 32 * 1024;

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

async function readJson(request: Request): Promise<unknown | undefined> {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return undefined;
  }
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BYTES) {
    return undefined;
  }
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES) {
      return undefined;
    }
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function field(body: unknown, name: string): unknown {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return undefined;
  }
  return (body as Record<string, unknown>)[name];
}

function normalizedContentType(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.split(';', 1)[0]?.trim().toLowerCase() || null;
}

function integerValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

async function readSignedRange(
  signedUrl: string,
  start: number,
  end: number,
): Promise<Uint8Array | null> {
  if (start < 0 || end < start) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(signedUrl, {
      headers: { range: `bytes=${start}-${end}` },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.body) return null;
    if (response.status === 206) {
      const match = response.headers
        .get('content-range')
        ?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
      if (!match || Number(match[1]) !== start || Number(match[2]) !== end) {
        return null;
      }
    } else if (
      response.status !== 200 ||
      start !== 0 ||
      Number(response.headers.get('content-length')) !== end + 1
    ) {
      return null;
    }

    const reader = response.body.getReader();
    const output = new Uint8Array(end - start + 1);
    let length = 0;
    try {
      while (length < output.length) {
        const { done, value } = await reader.read();
        if (done) break;
        if (length + value.length > output.length) return null;
        output.set(value, length);
        length += value.length;
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }
    return length === output.length ? output : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function storedFileIsValid(
  path: string,
  size: number,
  contentType:
    | 'application/pdf'
    | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
): Promise<boolean | null> {
  const admin = getAdminClient();
  const { data, error } = await admin.storage
    .from(PAPER_UPLOAD_BUCKET)
    .createSignedUrl(path, 60);
  if (error || !data) return null;

  const prefix = await readSignedRange(
    data.signedUrl,
    0,
    Math.min(7, size - 1),
  );
  if (!prefix) return null;
  if (!paperFileHasExpectedMagic(prefix, contentType)) return false;
  if (contentType === PAPER_CONTENT_TYPES.pdf) return true;

  const tailLength = Math.min(size, 65_557);
  const tailOffset = size - tailLength;
  const tail = await readSignedRange(data.signedUrl, tailOffset, size - 1);
  if (!tail) return null;
  const directory = findZipCentralDirectory(tail, tailOffset, size);
  if (!directory) return false;

  const directoryBytes =
    directory.offset >= tailOffset &&
    directory.offset + directory.size <= tailOffset + tail.length
      ? tail.subarray(
          directory.offset - tailOffset,
          directory.offset - tailOffset + directory.size,
        )
      : await readSignedRange(
          data.signedUrl,
          directory.offset,
          directory.offset + directory.size - 1,
        );
  return directoryBytes
    ? docxCentralDirectoryHasRequiredEntries(directoryBytes, directory.entries)
    : null;
}

async function markFinalized(intentId: string): Promise<void> {
  const admin = getAdminClient();
  const result = await admin
    .from('archive_paper_upload_intents')
    .update({ state: 'finalized', finalized_at: new Date().toISOString() })
    .eq('id', intentId)
    .neq('state', 'finalized');
  if (result.error) {
    console.error('[archive-paper] failed to mark intent finalized', {
      intentId,
      error: result.error.message,
    });
  }
}

async function rejectInvalidFile(
  intentId: string,
  path: string,
): Promise<void> {
  const admin = getAdminClient();
  const claimed = await admin
    .from('archive_paper_upload_intents')
    .update({ state: 'expired', finalized_at: null })
    .eq('id', intentId)
    .eq('state', 'pending')
    .select('id')
    .maybeSingle();
  if (claimed.error || !claimed.data) return;
  const removed = await admin.storage.from(PAPER_UPLOAD_BUCKET).remove([path]);
  if (removed.error) {
    console.error('[archive-paper] failed to remove rejected upload', {
      intentId,
      error: removed.error.message,
    });
  }
}

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  const role = locals.profile?.role ?? 'student';

  if (!user) return json({ ok: false, reason: 'unauthenticated' }, 401);
  if (!isContentManager(role)) {
    return json({ ok: false, reason: 'forbidden' }, 403);
  }

  const body = await readJson(request);
  const intentId = field(body, 'intent_id');
  const path = field(body, 'path');
  const scopedPath = parseActorScopedPaperPath(path, user.id);
  if (
    typeof intentId !== 'string' ||
    typeof path !== 'string' ||
    !scopedPath ||
    scopedPath.paperId !== intentId
  ) {
    return json({ ok: false, reason: 'invalid_upload_path' }, 400);
  }

  const admin = getAdminClient();
  const { data: intent, error: intentError } = await admin
    .from('archive_paper_upload_intents')
    .select(
      'id, actor_id, course_slug, kind, title, semester_term, semester_year, covers, storage_path, original_filename, content_type, file_size, published, state, expires_at',
    )
    .eq('id', intentId)
    .eq('actor_id', user.id)
    .maybeSingle();
  if (intentError) {
    console.error('[archive-paper] failed to load upload intent', {
      intentId,
      error: intentError.message,
    });
    return json({ ok: false, reason: 'storage_verification_failed' }, 500);
  }
  if (!intent) {
    return json({ ok: false, reason: 'upload_intent_not_found' }, 404);
  }
  if (
    intent.storage_path !== path ||
    intent.course_slug !== scopedPath.courseSlug
  ) {
    return json({ ok: false, reason: 'invalid_upload_path' }, 400);
  }
  if (!(await instructorOwnsCourse(user.id, intent.course_slug, role))) {
    return json({ ok: false, reason: 'not_course_instructor' }, 403);
  }

  const validated = validatePaperUploadMetadata({
    course_slug: intent.course_slug,
    kind: intent.kind,
    title: intent.title,
    semester_term: intent.semester_term,
    semester_year: intent.semester_year,
    covers: intent.covers,
    file_name: intent.original_filename,
    content_type: intent.content_type,
    size_bytes: intent.file_size,
  });
  if (!validated.ok) {
    console.error('[archive-paper] persisted upload intent is invalid', {
      intentId,
      reason: validated.reason,
    });
    return json({ ok: false, reason: 'invalid_payload' }, 409);
  }
  const metadata = validated.value;

  const lessons = await getCollection(
    'lessons',
    (lesson) => lesson.data.course === metadata.courseSlug,
  );
  const validLessonSlugs = new Set(
    lessons.map((lesson) => normalizeLessonSlug(lesson.id)),
  );
  if (metadata.covers.some((cover) => !validLessonSlugs.has(cover))) {
    return json({ ok: false, reason: 'invalid_lesson' }, 409);
  }

  const { data: existingPaper } = await admin
    .from('archive_papers')
    .select('id')
    .eq('upload_intent_id', intentId)
    .maybeSingle();
  if (existingPaper) {
    await markFinalized(intentId);
    return json({ ok: true, id: existingPaper.id, already_finalized: true });
  }
  if (intent.state === 'finalized') {
    return json({ ok: false, reason: 'insert_failed' }, 409);
  }
  if (
    intent.state === 'expired' ||
    Date.parse(intent.expires_at) <= Date.now()
  ) {
    if (intent.state === 'pending') {
      await admin
        .from('archive_paper_upload_intents')
        .update({ state: 'expired', finalized_at: null })
        .eq('id', intentId)
        .eq('state', 'pending');
    }
    return json({ ok: false, reason: 'upload_expired' }, 410);
  }

  const { data: info, error: infoError } = await admin.storage
    .from(PAPER_UPLOAD_BUCKET)
    .info(path);
  if (infoError || !info) {
    return json({ ok: false, reason: 'storage_verification_failed' }, 409);
  }

  const storedSize = integerValue(info.size ?? info.metadata?.size);
  const storedType = normalizedContentType(
    info.contentType ?? info.metadata?.mimetype ?? info.metadata?.contentType,
  );
  if (
    storedSize === null ||
    storedSize <= 0 ||
    storedSize > PAPER_UPLOAD_MAX_BYTES ||
    storedSize !== metadata.sizeBytes ||
    storedType !== metadata.contentType
  ) {
    await rejectInvalidFile(intentId, path);
    return json({ ok: false, reason: 'file_mismatch' }, 422);
  }

  const fileIsValid = await storedFileIsValid(
    path,
    storedSize,
    metadata.contentType,
  );
  if (fileIsValid === null) {
    return json({ ok: false, reason: 'storage_verification_failed' }, 502);
  }
  if (!fileIsValid) {
    await rejectInvalidFile(intentId, path);
    return json({ ok: false, reason: 'bad_file_type' }, 422);
  }

  const { data: inserted, error: insertError } = await admin
    .from('archive_papers')
    .insert({
      id: intentId,
      course_slug: metadata.courseSlug,
      kind: metadata.kind,
      title: metadata.title,
      semester_term: metadata.semesterTerm,
      semester_year: metadata.semesterYear,
      covers: metadata.covers,
      storage_path: path,
      original_filename: metadata.fileName,
      content_type: metadata.contentType,
      size_bytes: metadata.sizeBytes,
      created_by: user.id,
      upload_intent_id: intentId,
      published: intent.published,
    })
    .select('id')
    .single();
  if (insertError || !inserted) {
    const { data: raced } = await admin
      .from('archive_papers')
      .select('id')
      .eq('upload_intent_id', intentId)
      .maybeSingle();
    if (raced) {
      await markFinalized(intentId);
      return json({ ok: true, id: raced.id, already_finalized: true });
    }
    console.error('[archive-paper] failed to finalize archive row', {
      intentId,
      error: insertError?.message ?? 'missing inserted row',
    });
    return json({ ok: false, reason: 'insert_failed' }, 500);
  }

  await markFinalized(intentId);
  await logDisclosureSafe({
    actorId: user.id,
    actorRole: role as 'instructor' | 'admin',
    action: 'manage_archive',
    request,
    targetResource: `paper create: ${metadata.title} (${metadata.courseSlug})`,
    metadata: {
      resource: 'paper',
      op: 'create',
      id: inserted.id,
      course: metadata.courseSlug,
      uploadIntentId: intentId,
    },
  });

  return json({ ok: true, id: inserted.id });
};
