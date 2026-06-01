import { getCollection } from 'astro:content';
import { getAdminClient } from '@lib/supabase/admin';
import { isAdmin } from '@lib/roles';

export interface ManageVideo {
  id: string;
  courseSlug: string;
  title: string;
  lessonSlug: string;
  semesterTerm: string;
  semesterYear: number;
  provider: string;
  videoId: string;
  published: boolean;
  createdBy: string;
}

/**
 * Courses the viewer manages (admins: all; else enrollments where they are
 * instructor_id) plus the non-deleted video rows in those courses. Includes
 * hidden (unpublished) rows so instructors can re-publish them.
 */
export async function loadInstructorArchive(
  userId: string,
  role: string | null | undefined,
): Promise<{ courses: string[]; videos: ManageVideo[] }> {
  const admin = getAdminClient();

  let courses: string[];
  if (isAdmin(role as never)) {
    const all = await getCollection('courses');
    courses = all.map((c) => c.data.slug);
  } else {
    const { data: rows } = await admin
      .from('enrollments')
      .select('course_slug')
      .eq('instructor_id', userId);
    courses = [...new Set((rows ?? []).map((r) => r.course_slug))];
  }

  if (courses.length === 0) return { courses, videos: [] };

  const { data: vids } = await admin
    .from('archive_videos')
    .select(
      'id, course_slug, title, lesson_slug, semester_term, semester_year, provider, video_id, published, created_by',
    )
    .in('course_slug', courses)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const videos: ManageVideo[] = (vids ?? []).map((v) => ({
    id: v.id,
    courseSlug: v.course_slug,
    title: v.title,
    lessonSlug: v.lesson_slug,
    semesterTerm: v.semester_term,
    semesterYear: v.semester_year,
    provider: v.provider,
    videoId: v.video_id,
    published: v.published,
    createdBy: v.created_by,
  }));

  return { courses, videos };
}
