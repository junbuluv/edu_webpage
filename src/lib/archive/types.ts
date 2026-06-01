export type ArchiveItemType = 'notes' | 'exam' | 'assignment' | 'video';

export interface Semester {
  term: 'spring' | 'summer' | 'fall';
  year: number;
}

export interface ArchiveItem {
  id: string;
  type: ArchiveItemType;
  title: string;
  course: string;
  href: string; // notes/exam/assignment link; '' for inline-embed videos
  lessonSlugs: string[]; // normalized 'course/slug' refs
  units: string[]; // unique unit names resolved from lessonSlugs
  semester: Semester | null;
  searchText: string; // lowercased haystack for keyword match
  provider?: 'youtube' | 'vimeo';
  videoId?: string;
}

// Plain inputs (decoupled from Astro CollectionEntry so build.ts is alias-free).
export interface LessonInput {
  id: string; // e.g. 'eco-1002/solow' or 'eco-1002/solow.mdx'
  course: string;
  title: string;
  unit: string;
  summary: string;
  tags: string[];
  draft: boolean;
}

export interface QuizInput {
  slug: string;
  course: string;
  title: string;
  kind: 'practice' | 'exam' | 'assignment';
  lessonSlug?: string;
  covers: string[];
  semester?: Semester | null;
}

export interface VideoInput {
  slug: string;
  course: string;
  title: string;
  lessonSlug: string;
  description?: string;
  provider: 'youtube' | 'vimeo';
  videoId: string;
  semester: Semester;
}

export interface LessonRef {
  slug: string; // normalized 'course/slug'
  title: string;
  unit: string;
}

export interface Facets {
  types: ArchiveItemType[];
  semesters: { key: string; label: string }[];
  units: string[];
  lessons: { slug: string; title: string }[];
}

export interface ArchiveFilters {
  type?: string | null;
  semester?: string | null; // semesterKey
  unit?: string | null;
  lesson?: string | null; // normalized lesson slug
  query?: string;
}
