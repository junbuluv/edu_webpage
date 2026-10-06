// Server-only: whether a course offers the lesson tutor. The enrolled-or-staff
// check itself is canViewCourse (src/lib/archive/access.ts); callers combine
// the two (the route) or reuse an earlier canViewCourse result (the layout).
import { getEntry, type CollectionEntry } from 'astro:content';
import type { CourseSlug } from '@lib/courses';
import { tutorConfigured } from './model';

/** The course entry when `tutor: true` and the gateway key is set; else null. */
export async function getTutorCourse(
  courseSlug: CourseSlug,
): Promise<CollectionEntry<'courses'> | null> {
  if (!tutorConfigured()) return null;
  const course = await getEntry('courses', courseSlug);
  return course?.data.tutor === true ? course : null;
}
