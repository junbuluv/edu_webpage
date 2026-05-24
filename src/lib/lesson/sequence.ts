// Returns the previous and next lessons in a course's reading order.
//
// Course-wide ordering: lessons are sorted by (unit index, frontmatter
// `order`). Unit order is defined explicitly per course below — ECO 1002
// uses within-unit `order` so we need the unit sequence; FIN 3610 uses
// course-wide `order` so the unit sequence is essentially cosmetic.

import type { CollectionEntry } from 'astro:content';

type Course = CollectionEntry<'lessons'>['data']['course'];
type Lesson = CollectionEntry<'lessons'>;

// Pedagogically natural unit sequences. Add entries here when a new
// unit is introduced; unknown units fall to the end.
const UNIT_ORDER: Record<Course, string[]> = {
  'eco-1002': [
    'Long-run growth',
    'Short-run output and interest',
    'Money and monetary policy',
    'Open economy',
    'Inflation and unemployment',
  ],
  'fin-3610': [
    'Foundations',
    'Time, money, and interest rates',
    'Valuing projects and firms',
    'Risk and return',
    'Capital structure and payout',
    'Options and special topics',
  ],
  macro: [],
  micro: [],
  finance: [],
  derivatives: [],
};

function unitIndex(course: Course, unit: string): number {
  const list = UNIT_ORDER[course] ?? [];
  const i = list.indexOf(unit);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

export function compareLessons(a: Lesson, b: Lesson): number {
  if (a.data.course !== b.data.course) {
    return a.data.course.localeCompare(b.data.course);
  }
  const ua = unitIndex(a.data.course, a.data.unit);
  const ub = unitIndex(b.data.course, b.data.unit);
  if (ua !== ub) return ua - ub;
  if (a.data.order !== b.data.order) return a.data.order - b.data.order;
  return a.slug.localeCompare(b.slug);
}

export function findPrevNext(
  lesson: Lesson,
  all: Lesson[],
): { prev: Lesson | null; next: Lesson | null } {
  const sameCourse = all
    .filter((l) => l.data.course === lesson.data.course && !l.data.draft)
    .sort(compareLessons);
  const idx = sameCourse.findIndex((l) => l.slug === lesson.slug);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx > 0 ? sameCourse[idx - 1] : null,
    next: idx < sameCourse.length - 1 ? sameCourse[idx + 1] : null,
  };
}
