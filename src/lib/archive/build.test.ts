import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildArchiveItems,
  deriveFacets,
  filterItems,
  semesterKey,
  semesterLabel,
} from './build.ts';
import type { LessonInput, LessonRef, QuizInput, VideoInput } from './types.ts';

const lessons: LessonInput[] = [
  {
    id: 'eco-1002/solow.mdx',
    course: 'eco-1002',
    title: 'The Solow Model',
    unit: 'Growth',
    summary: 'Capital accumulation and steady state.',
    tags: ['growth'],
    draft: false,
  },
  {
    id: 'eco-1002/draft-topic',
    course: 'eco-1002',
    title: 'Draft',
    unit: 'Growth',
    summary: 'x',
    tags: [],
    draft: true,
  },
  {
    id: 'fin-3610/bond-pricing-and-yield',
    course: 'fin-3610',
    title: 'Bonds',
    unit: 'Rates',
    summary: 'y',
    tags: [],
    draft: false,
  },
];

const quizzes: QuizInput[] = [
  {
    slug: 'eco-1002-practice',
    course: 'eco-1002',
    title: 'Practice',
    kind: 'practice',
    lessonSlug: 'eco-1002/solow',
    covers: [],
    semester: null,
  },
  {
    slug: 'eco-1002-midterm-f24',
    course: 'eco-1002',
    title: 'Midterm',
    kind: 'exam',
    covers: ['eco-1002/solow'],
    semester: { term: 'fall', year: 2024 },
  },
];

const videos: VideoInput[] = [
  {
    slug: 'eco-vid',
    course: 'eco-1002',
    title: 'Solow lecture',
    lessonSlug: 'eco-1002/solow',
    provider: 'youtube',
    videoId: 'abc123',
    semester: { term: 'spring', year: 2025 },
  },
];

test('notes come from non-draft lessons of the course', () => {
  const items = buildArchiveItems({
    lessons,
    quizzes,
    videos,
    course: 'eco-1002',
  });
  const notes = items.filter((i) => i.type === 'notes');
  assert.equal(notes.length, 1);
  assert.equal(notes[0].title, 'The Solow Model');
  assert.equal(notes[0].href, '/lessons/eco-1002/solow');
  assert.deepEqual(notes[0].units, ['Growth']);
  assert.equal(notes[0].semester, null);
});

test('practice quizzes are excluded; exams included with semester + units', () => {
  const items = buildArchiveItems({
    lessons,
    quizzes,
    videos,
    course: 'eco-1002',
  });
  assert.equal(
    items.some((i) => i.title === 'Practice'),
    false,
  );
  const exam = items.find((i) => i.type === 'exam');
  assert.ok(exam);
  assert.equal(exam.href, '/practice/eco-1002-midterm-f24');
  assert.deepEqual(exam.units, ['Growth']);
  assert.deepEqual(exam.semester, { term: 'fall', year: 2024 });
});

test('videos map with provider/videoId and empty href', () => {
  const items = buildArchiveItems({
    lessons,
    quizzes,
    videos,
    course: 'eco-1002',
  });
  const v = items.find((i) => i.type === 'video');
  assert.ok(v);
  assert.equal(v.provider, 'youtube');
  assert.equal(v.videoId, 'abc123');
  assert.equal(v.href, '');
  assert.deepEqual(v.units, ['Growth']);
});

test('a different course yields no videos and only its own items', () => {
  const items = buildArchiveItems({
    lessons,
    quizzes,
    videos,
    course: 'fin-3610',
  });
  assert.equal(
    items.some((i) => i.type === 'video'),
    false,
  );
  assert.equal(
    items.every((i) => i.course === 'fin-3610'),
    true,
  );
});

test('exam with empty covers falls back to lessonSlug for units', () => {
  const fallbackQuiz: QuizInput[] = [
    {
      slug: 'eco-1002-final-f24',
      course: 'eco-1002',
      title: 'Final',
      kind: 'exam',
      lessonSlug: 'eco-1002/solow',
      covers: [],
      semester: { term: 'fall', year: 2024 },
    },
  ];
  const items = buildArchiveItems({
    lessons,
    quizzes: fallbackQuiz,
    videos: [],
    course: 'eco-1002',
  });
  const exam = items.find((i) => i.type === 'exam');
  assert.ok(exam);
  assert.deepEqual(exam.lessonSlugs, ['eco-1002/solow']);
  assert.deepEqual(exam.units, ['Growth']);
});

const lessonIndex: LessonRef[] = [
  { slug: 'eco-1002/solow', title: 'The Solow Model', unit: 'Growth' },
];

test('semesterKey / semesterLabel format correctly', () => {
  assert.equal(semesterKey({ term: 'fall', year: 2024 }), 'fall-2024');
  assert.equal(semesterKey(null), '');
  assert.equal(semesterLabel({ term: 'fall', year: 2024 }), 'Fall 2024');
});

test('deriveFacets sorts semesters newest-first and lists present types', () => {
  const items = buildArchiveItems({
    lessons,
    quizzes,
    videos,
    course: 'eco-1002',
  });
  const f = deriveFacets(items, lessonIndex);
  assert.deepEqual(f.types, ['notes', 'exam', 'video']);
  // spring 2025 is newer than fall 2024
  assert.deepEqual(
    f.semesters.map((s) => s.key),
    ['spring-2025', 'fall-2024'],
  );
  assert.deepEqual(f.units, ['Growth']);
  assert.deepEqual(f.lessons, [
    { slug: 'eco-1002/solow', title: 'The Solow Model' },
  ]);
});

test('deriveFacets orders same-year semesters fall-before-spring; labels all terms', () => {
  assert.equal(semesterLabel({ term: 'spring', year: 2025 }), 'Spring 2025');
  assert.equal(semesterLabel({ term: 'summer', year: 2025 }), 'Summer 2025');

  const sameYear: QuizInput[] = [
    {
      slug: 'q-spring',
      course: 'eco-1002',
      title: 'Spring exam',
      kind: 'exam',
      covers: ['eco-1002/solow'],
      semester: { term: 'spring', year: 2025 },
    },
    {
      slug: 'q-fall',
      course: 'eco-1002',
      title: 'Fall exam',
      kind: 'exam',
      covers: ['eco-1002/solow'],
      semester: { term: 'fall', year: 2025 },
    },
  ];
  const items = buildArchiveItems({
    lessons,
    quizzes: sameYear,
    videos: [],
    course: 'eco-1002',
  });
  const f = deriveFacets(items, lessonIndex);
  assert.deepEqual(
    f.semesters.map((s) => s.key),
    ['fall-2025', 'spring-2025'],
  );
});

test('filterItems narrows by type, semester, unit, lesson, and query', () => {
  const items = buildArchiveItems({
    lessons,
    quizzes,
    videos,
    course: 'eco-1002',
  });

  assert.equal(filterItems(items, { type: 'video' }).length, 1);
  assert.equal(filterItems(items, { semester: 'fall-2024' }).length, 1);
  // notes have no semester -> excluded when a semester is selected
  assert.equal(
    filterItems(items, { semester: 'fall-2024' }).every(
      (i) => i.type !== 'notes',
    ),
    true,
  );
  assert.equal(filterItems(items, { unit: 'Growth' }).length, 3);
  assert.equal(filterItems(items, { lesson: 'eco-1002/solow' }).length, 3);
  // keyword: all tokens must appear in searchText
  assert.equal(filterItems(items, { query: 'solow lecture' }).length, 1);
  assert.equal(filterItems(items, { query: 'nonexistent' }).length, 0);
  // empty filters -> everything
  assert.equal(filterItems(items, {}).length, items.length);

  // multi-facet AND: a video that is also in unit 'Growth'
  assert.equal(filterItems(items, { type: 'video', unit: 'Growth' }).length, 1);
  // multi-facet AND that yields zero: a video tagged with the exam's semester
  assert.equal(
    filterItems(items, { type: 'video', semester: 'fall-2024' }).length,
    0,
  );
  // whitespace-only query is treated as no query
  assert.equal(filterItems(items, { query: '   ' }).length, items.length);
});
