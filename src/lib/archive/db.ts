import { getAdminClient } from '@lib/supabase/admin';

export interface ArchiveVideoRow {
  id: string;
  course_slug: string;
  lesson_slug: string;
  semester_term: 'spring' | 'summer' | 'fall';
  semester_year: number;
  title: string;
  provider: 'youtube' | 'vimeo';
  video_id: string;
  description: string | null;
  created_by: string;
  published: boolean;
}

/**
 * Published, non-deleted instructor-managed videos for a course, read via the
 * service-role admin client. Returns [] if Supabase env is missing or the
 * query errors, so the archive read path degrades to git-only content.
 */
export async function fetchArchiveVideos(
  course: string,
): Promise<ArchiveVideoRow[]> {
  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('archive_videos')
      .select(
        'id, course_slug, lesson_slug, semester_term, semester_year, title, provider, video_id, description, created_by, published',
      )
      .eq('course_slug', course)
      .eq('published', true)
      .is('deleted_at', null);
    if (error) return [];
    return (data ?? []) as ArchiveVideoRow[];
  } catch {
    return [];
  }
}

export interface ArchivePaperRow {
  id: string;
  course_slug: string;
  kind: 'exam' | 'assignment';
  title: string;
  semester_term: 'spring' | 'summer' | 'fall';
  semester_year: number;
  covers: string[];
  storage_path: string;
  original_filename: string;
  created_by: string;
  published: boolean;
}

/** Published, non-deleted file papers for a course (service-role). [] on error. */
export async function fetchArchivePapers(
  course: string,
): Promise<ArchivePaperRow[]> {
  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('archive_papers')
      .select(
        'id, course_slug, kind, title, semester_term, semester_year, covers, storage_path, original_filename, created_by, published',
      )
      .eq('course_slug', course)
      .eq('published', true)
      .is('deleted_at', null);
    if (error) return [];
    return (data ?? []) as ArchivePaperRow[];
  } catch {
    return [];
  }
}

/** A short-lived signed URL for a paper's file, or null on error. */
export async function signPaperUrl(
  storagePath: string,
): Promise<string | null> {
  try {
    const admin = getAdminClient();
    const { data, error } = await admin.storage
      .from('archive-papers')
      .createSignedUrl(storagePath, 3600);
    if (error || !data) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

/** Published, non-deleted videos for one lesson (service-role). [] on error. */
export async function fetchArchiveVideosForLesson(
  course: string,
  lessonSlug: string,
): Promise<ArchiveVideoRow[]> {
  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('archive_videos')
      .select(
        'id, course_slug, lesson_slug, semester_term, semester_year, title, provider, video_id, description, created_by, published',
      )
      .eq('course_slug', course)
      .eq('lesson_slug', lessonSlug)
      .eq('published', true)
      .is('deleted_at', null);
    if (error) return [];
    return (data ?? []) as ArchiveVideoRow[];
  } catch {
    return [];
  }
}
