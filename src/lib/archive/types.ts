export type ArchiveItemType = 'notes' | 'exam' | 'assignment';

export interface Semester {
  term: 'spring' | 'summer' | 'fall';
  year: number;
}

export interface ArchiveItem {
  id: string;
  type: ArchiveItemType;
  title: string;
  course: string;
  href: string; // notes/exam/assignment link; '' for file-papers
  lessonSlugs: string[]; // normalized 'course/slug' refs
  units: string[]; // unique unit names resolved from lessonSlugs
  semester: Semester | null;
  searchText: string; // lowercased haystack for keyword match
  fileUrl?: string; // signed download URL for file-papers
  fileName?: string; // original filename for file-papers
}

// Plain inputs (decoupled from Astro CollectionEntry so build.ts is alias-free).
export interface LessonInput {
  id: string; // e.g. 'fin-3610/valuing-stocks' or 'fin-3610/valuing-stocks.mdx'
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

export interface PaperInput {
  id: string;
  course: string;
  kind: 'exam' | 'assignment';
  title: string;
  covers: string[];
  semester: Semester;
  fileUrl: string;
  fileName: string;
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
