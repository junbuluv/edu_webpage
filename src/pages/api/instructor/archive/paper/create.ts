import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getAdminClient } from '@lib/supabase/admin';
import { isContentManager } from '@lib/roles';
import { isCourseSlug } from '@lib/courses';
import { instructorOwnsCourse } from '@lib/archive/access';
import { normalizeLessonSlug } from '@lib/archive/build';
import { logDisclosureSafe } from '@lib/audit';

const TERMS = new Set(['spring', 'summer', 'fall']);
const KINDS = new Set(['exam', 'assignment']);
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const MAX_BYTES = 25 * 1024 * 1024;

function err(reason: string): Response {
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/instructor/archive?error=${encodeURIComponent(reason)}`,
    },
  });
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file';
}

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  const role = locals.profile?.role ?? 'student';

  const form = await request.formData();
  const course = String(form.get('course_slug') ?? '');
  const kind = String(form.get('kind') ?? '');
  const title = String(form.get('title') ?? '').trim();
  const term = String(form.get('semester_term') ?? '');
  const year = Number(form.get('semester_year') ?? NaN);
  const covers = form.getAll('covers').map(String).filter(Boolean);
  const file = form.get('file');

  if (!user) return err('unauthenticated');
  if (!isContentManager(role)) return err('forbidden');
  if (!isCourseSlug(course)) return err('invalid_course');
  if (!(await instructorOwnsCourse(user.id, course, role)))
    return err('not_course_instructor');
  if (
    !title ||
    !KINDS.has(kind) ||
    !TERMS.has(term) ||
    !Number.isInteger(year) ||
    year < 2020 ||
    year > 2100
  ) {
    return err('invalid_input');
  }
  if (!(file instanceof File) || file.size === 0) return err('missing_file');
  if (!ALLOWED_TYPES.has(file.type)) return err('bad_file_type');
  if (file.size > MAX_BYTES) return err('file_too_large');

  // covers must reference real lessons of this course
  const lessons = await getCollection(
    'lessons',
    (l) => l.data.course === course,
  );
  const valid = new Set(lessons.map((l) => normalizeLessonSlug(l.id)));
  if (covers.some((c) => !valid.has(c))) return err('invalid_lesson');

  const admin = getAdminClient();
  const id = crypto.randomUUID();
  const path = `${course}/${id}/${sanitize(file.name)}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const up = await admin.storage
    .from('archive-papers')
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (up.error) return err('upload_failed');

  const { error } = await admin.from('archive_papers').insert({
    id,
    course_slug: course,
    kind: kind as 'exam' | 'assignment',
    title,
    semester_term: term as 'spring' | 'summer' | 'fall',
    semester_year: year,
    covers,
    storage_path: path,
    original_filename: file.name,
    content_type: file.type,
    size_bytes: file.size,
    created_by: user.id,
  });
  if (error) {
    // No orphan: remove the just-uploaded object.
    await admin.storage.from('archive-papers').remove([path]);
    return err('insert_failed');
  }

  await logDisclosureSafe({
    actorId: user.id,
    actorRole: role as 'instructor' | 'admin',
    action: 'manage_archive',
    request,
    targetResource: `paper create: ${title} (${course})`,
    metadata: { resource: 'paper', op: 'create', id, course },
  });

  return new Response(null, {
    status: 303,
    headers: { Location: `/instructor/archive?ok=paper_created` },
  });
};
