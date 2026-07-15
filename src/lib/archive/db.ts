import { getAdminClient } from '@lib/supabase/admin';
import { ArchiveServiceUnavailableError } from './errors';

function unavailable(operation: string, error: unknown): never {
  console.error(`[archive] ${operation}_failed`, {
    error: error instanceof Error ? error.message : String(error),
  });
  throw new ArchiveServiceUnavailableError(operation);
}

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
 * service-role admin client.
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
    if (error) unavailable('videos_read', error);
    return (data ?? []) as ArchiveVideoRow[];
  } catch (error) {
    if (error instanceof ArchiveServiceUnavailableError) throw error;
    return unavailable('videos_read', error);
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

/** Published, non-deleted file papers for a course (service-role). */
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
    if (error) unavailable('papers_read', error);
    return (data ?? []) as ArchivePaperRow[];
  } catch (error) {
    if (error instanceof ArchiveServiceUnavailableError) throw error;
    return unavailable('papers_read', error);
  }
}

/** A short-lived signed URL for a paper's file. */
export async function signPaperUrl(
  storagePath: string,
  downloadName: string,
): Promise<string> {
  try {
    const admin = getAdminClient();
    const { data, error } = await admin.storage
      .from('archive-papers')
      .createSignedUrl(storagePath, 300, { download: downloadName });
    if (error || !data)
      unavailable('paper_sign', error ?? 'missing signed URL');
    return data.signedUrl;
  } catch (error) {
    if (error instanceof ArchiveServiceUnavailableError) throw error;
    return unavailable('paper_sign', error);
  }
}

export interface ArchiveQuizRow {
  id: string;
  course_slug: string;
  kind: 'exam' | 'assignment';
  title: string;
  semester_term: 'spring' | 'summer' | 'fall';
  semester_year: number;
  covers: string[];
}

/** Published, non-deleted authored quizzes for a course (service-role). */
export async function fetchArchiveQuizzes(
  course: string,
): Promise<ArchiveQuizRow[]> {
  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('archive_quizzes')
      .select(
        'id, course_slug, kind, title, semester_term, semester_year, covers',
      )
      .eq('course_slug', course)
      .eq('published', true)
      .is('deleted_at', null);
    if (error) unavailable('quizzes_read', error);
    return (data ?? []) as ArchiveQuizRow[];
  } catch (error) {
    if (error instanceof ArchiveServiceUnavailableError) throw error;
    return unavailable('quizzes_read', error);
  }
}

/** Published, non-deleted videos for one lesson (service-role). */
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
    if (error) unavailable('lesson_videos_read', error);
    return (data ?? []) as ArchiveVideoRow[];
  } catch (error) {
    if (error instanceof ArchiveServiceUnavailableError) throw error;
    return unavailable('lesson_videos_read', error);
  }
}

export async function fetchArchivePaperById(
  id: string,
): Promise<ArchivePaperRow | null> {
  try {
    const { data, error } = await getAdminClient()
      .from('archive_papers')
      .select(
        'id, course_slug, kind, title, semester_term, semester_year, covers, storage_path, original_filename, created_by, published',
      )
      .eq('id', id)
      .eq('published', true)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) unavailable('paper_read', error);
    return data as ArchivePaperRow | null;
  } catch (error) {
    if (error instanceof ArchiveServiceUnavailableError) throw error;
    return unavailable('paper_read', error);
  }
}
