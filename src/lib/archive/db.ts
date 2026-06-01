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
