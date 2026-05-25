// Authoritative list of course slugs.
//
// Why a TS const tuple instead of pulling from the `courses` content
// collection: content collections are the OUTPUT of src/content/config.ts,
// not the input. Schemas in config.ts cannot reference collection data.
// So we keep slugs here, and the JSON files under src/content/courses/
// carry everything else (title, description, color, instructor refs).
//
// Adding a course: (1) append the slug below, (2) drop a JSON file under
// src/content/courses/<slug>.json.

export const COURSE_SLUGS = ['eco-1002', 'fin-3610'] as const;

export type CourseSlug = (typeof COURSE_SLUGS)[number];

export function isCourseSlug(value: string): value is CourseSlug {
  return (COURSE_SLUGS as readonly string[]).includes(value);
}
