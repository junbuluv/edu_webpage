import { getCollection } from 'astro:content';
import { getAdminClient, selectAllRows } from '@lib/supabase/admin';
import { isAdmin, isInstructor, type UserRole } from '@lib/roles';

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

export interface ManagePaper {
  id: string;
  courseSlug: string;
  kind: 'exam' | 'assignment';
  title: string;
  semesterTerm: string;
  semesterYear: number;
  originalFilename: string;
  published: boolean;
  createdBy: string;
}

export interface ManageQuiz {
  id: string;
  courseSlug: string;
  kind: 'exam' | 'assignment';
  title: string;
  semesterTerm: string;
  semesterYear: number;
  published: boolean;
  createdBy: string;
}

/**
 * Courses visible in the staff archive plus non-deleted video/paper/quiz rows.
 * Admins and read-only TAs see the full catalog; instructors see courses with
 * an active assignment. Includes hidden rows for authorized managers.
 */
export async function loadInstructorArchive(
  userId: string,
  role: UserRole | null | undefined,
): Promise<{
  courses: string[];
  videos: ManageVideo[];
  papers: ManagePaper[];
  quizzes: ManageQuiz[];
}> {
  const admin = getAdminClient();

  let courses: string[];
  if (isAdmin(role) || !isInstructor(role)) {
    const all = await getCollection('courses');
    courses = all.map((c) => c.data.slug);
  } else {
    const assignments = await selectAllRows<{ course_slug: string }>(
      (from, to) =>
        admin
          .from('teaching_assignments')
          .select('course_slug')
          .eq('instructor_id', userId)
          .eq('active', true)
          .order('course_slug', { ascending: true })
          .order('semester', { ascending: true })
          .range(from, to),
    );
    if (assignments.error) throw new Error(assignments.error);
    courses = [...new Set(assignments.rows.map((row) => row.course_slug))];
  }

  if (courses.length === 0)
    return { courses, videos: [], papers: [], quizzes: [] };

  const vids = await selectAllRows<{
    id: string;
    course_slug: string;
    title: string;
    lesson_slug: string;
    semester_term: string;
    semester_year: number;
    provider: string;
    video_id: string;
    published: boolean;
    created_by: string;
  }>((from, to) =>
    admin
      .from('archive_videos')
      .select(
        'id, course_slug, title, lesson_slug, semester_term, semester_year, provider, video_id, published, created_by',
      )
      .in('course_slug', courses)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to),
  );
  if (vids.error) throw new Error(vids.error);

  const videos: ManageVideo[] = vids.rows.map((v) => ({
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

  const paperRows = await selectAllRows<{
    id: string;
    course_slug: string;
    kind: 'exam' | 'assignment';
    title: string;
    semester_term: string;
    semester_year: number;
    original_filename: string;
    published: boolean;
    created_by: string;
  }>((from, to) =>
    admin
      .from('archive_papers')
      .select(
        'id, course_slug, kind, title, semester_term, semester_year, original_filename, published, created_by',
      )
      .in('course_slug', courses)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to),
  );
  if (paperRows.error) throw new Error(paperRows.error);

  const papers: ManagePaper[] = paperRows.rows.map((p) => ({
    id: p.id,
    courseSlug: p.course_slug,
    kind: p.kind,
    title: p.title,
    semesterTerm: p.semester_term,
    semesterYear: p.semester_year,
    originalFilename: p.original_filename,
    published: p.published,
    createdBy: p.created_by,
  }));

  const quizRows = await selectAllRows<{
    id: string;
    course_slug: string;
    kind: 'exam' | 'assignment';
    title: string;
    semester_term: string;
    semester_year: number;
    published: boolean;
    created_by: string;
  }>((from, to) =>
    admin
      .from('archive_quizzes')
      .select(
        'id, course_slug, kind, title, semester_term, semester_year, published, created_by',
      )
      .in('course_slug', courses)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to),
  );
  if (quizRows.error) throw new Error(quizRows.error);

  const quizzes: ManageQuiz[] = quizRows.rows.map((q) => ({
    id: q.id,
    courseSlug: q.course_slug,
    kind: q.kind,
    title: q.title,
    semesterTerm: q.semester_term,
    semesterYear: q.semester_year,
    published: q.published,
    createdBy: q.created_by,
  }));

  return { courses, videos, papers, quizzes };
}
