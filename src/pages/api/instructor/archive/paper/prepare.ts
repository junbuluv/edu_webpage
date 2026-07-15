import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { instructorOwnsCourse } from '@lib/archive/access';
import { normalizeLessonSlug } from '@lib/archive/build';
import {
  buildPaperStoragePath,
  PAPER_UPLOAD_BUCKET,
  validatePaperUploadMetadata,
} from '@lib/archive/paper-upload';
import { isContentManager } from '@lib/roles';
import { getAdminClient } from '@lib/supabase/admin';
import { cleanExpiredPaperUploadIntents } from '@lib/archive/upload-intent-cleanup';

const MAX_JSON_BYTES = 32 * 1024;
const UPLOAD_LIFETIME_MS = 2 * 60 * 60 * 1000;

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

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  const role = locals.profile?.role ?? 'student';

  if (!user) return json({ ok: false, reason: 'unauthenticated' }, 401);
  if (!isContentManager(role)) {
    return json({ ok: false, reason: 'forbidden' }, 403);
  }

  const body = await readJson(request);
  const validated = validatePaperUploadMetadata(body);
  if (!validated.ok) {
    return json({ ok: false, reason: validated.reason }, 400);
  }
  const metadata = validated.value;

  if (!(await instructorOwnsCourse(user.id, metadata.courseSlug, role))) {
    return json({ ok: false, reason: 'not_course_instructor' }, 403);
  }

  const lessons = await getCollection(
    'lessons',
    (lesson) => lesson.data.course === metadata.courseSlug,
  );
  const validLessonSlugs = new Set(
    lessons.map((lesson) => normalizeLessonSlug(lesson.id)),
  );
  if (metadata.covers.some((cover) => !validLessonSlugs.has(cover))) {
    return json({ ok: false, reason: 'invalid_lesson' }, 400);
  }

  await cleanExpiredPaperUploadIntents(20);

  const admin = getAdminClient();
  const now = new Date();
  const paperId = crypto.randomUUID();
  const path = buildPaperStoragePath(
    user.id,
    metadata.courseSlug,
    paperId,
    metadata.fileName,
  );
  const expiresAt = new Date(now.getTime() + UPLOAD_LIFETIME_MS).toISOString();

  const reservation = await admin.rpc('reserve_archive_paper_upload_intent', {
    p_id: paperId,
    p_actor_id: user.id,
    p_course_slug: metadata.courseSlug,
    p_kind: metadata.kind,
    p_title: metadata.title,
    p_semester_term: metadata.semesterTerm,
    p_semester_year: metadata.semesterYear,
    p_covers: metadata.covers,
    p_storage_path: path,
    p_original_filename: metadata.fileName,
    p_content_type: metadata.contentType,
    p_file_size: metadata.sizeBytes,
    p_expires_at: expiresAt,
  });
  if (reservation.error) {
    if (reservation.error.code === '42501') {
      return json({ ok: false, reason: 'not_course_instructor' }, 403);
    }
    console.error('[archive-paper] failed to reserve upload intent', {
      actorId: user.id,
      course: metadata.courseSlug,
      error: reservation.error.message,
    });
    return json({ ok: false, reason: 'upload_failed' }, 500);
  }
  if (!reservation.data) {
    return json({ ok: false, reason: 'too_many_pending_uploads' }, 429);
  }

  try {
    const { data, error } = await admin.storage
      .from(PAPER_UPLOAD_BUCKET)
      .createSignedUploadUrl(path, { upsert: false });
    if (error || !data || data.path !== path) {
      console.error('[archive-paper] failed to prepare signed upload', {
        actorId: user.id,
        course: metadata.courseSlug,
        error: error?.message ?? 'missing signed upload data',
      });
      await admin
        .from('archive_paper_upload_intents')
        .delete()
        .eq('id', paperId);
      return json({ ok: false, reason: 'upload_failed' }, 502);
    }

    return json({
      ok: true,
      upload: {
        intent_id: paperId,
        path: data.path,
        token: data.token,
        signed_url: data.signedUrl,
        expires_in: 7200,
      },
    });
  } catch (error) {
    console.error('[archive-paper] failed to prepare upload', {
      actorId: user.id,
      course: metadata.courseSlug,
      error: error instanceof Error ? error.message : String(error),
    });
    await admin.from('archive_paper_upload_intents').delete().eq('id', paperId);
    return json({ ok: false, reason: 'upload_failed' }, 502);
  }
};
