import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildArchiveItems,
  deriveFacets,
  filterItems,
  semesterKey,
  semesterLabel,
} from './build.ts';
import type { LessonInput, LessonRef, PaperInput, QuizInput } from './types.ts';

const lessons: LessonInput[] = [
  {
    id: 'fin-3610/valuing-stocks.mdx',
    course: 'fin-3610',
    title: 'Valuing Stocks',
    unit: 'Valuation',
    summary: 'Dividends, payouts and free cash flow.',
    tags: ['valuation'],
    draft: false,
  },
  {
    id: 'fin-3610/draft-topic',
    course: 'fin-3610',
    title: 'Draft',
    unit: 'Valuation',
    summary: 'x',
    tags: [],
    draft: true,
  },
  {
    id: 'other-course/bond-pricing-and-yield',
    course: 'other-course',
    title: 'Bonds',
    unit: 'Rates',
    summary: 'y',
    tags: [],
    draft: false,
  },
];

const quizzes: QuizInput[] = [
  {
    slug: 'fin-3610-practice',
    course: 'fin-3610',
    title: 'Practice',
    kind: 'practice',
    lessonSlug: 'fin-3610/valuing-stocks',
    covers: [],
    semester: null,
  },
  {
    slug: 'fin-3610-midterm-f24',
    course: 'fin-3610',
    title: 'Midterm',
    kind: 'exam',
    covers: ['fin-3610/valuing-stocks'],
    semester: { term: 'fall', year: 2024 },
  },
];

const papers: PaperInput[] = [
  {
    id: 'p1',
    course: 'fin-3610',
    kind: 'assignment',
    title: 'Problem set 1',
    covers: ['fin-3610/valuing-stocks'],
    semester: { term: 'spring', year: 2025 },
    fileUrl: 'https://signed.example/p1.pdf',
    fileName: 'ps1.pdf',
  },
];

test('notes come from non-draft lessons of the course', () => {
  const items = buildArchiveItems({ lessons, quizzes, course: 'fin-3610' });
  const notes = items.filter((i) => i.type === 'notes');
  assert.equal(notes.length, 1);
  assert.equal(notes[0].title, 'Valuing Stocks');
  assert.equal(notes[0].href, '/lessons/fin-3610/valuing-stocks');
  assert.deepEqual(notes[0].units, ['Valuation']);
  assert.equal(notes[0].semester, null);
});

test('practice quizzes are excluded; exams included with semester + units', () => {
  const items = buildArchiveItems({ lessons, quizzes, course: 'fin-3610' });
  assert.equal(
    items.some((i) => i.title === 'Practice'),
    false,
  );
  const exam = items.find((i) => i.type === 'exam');
  assert.ok(exam);
  assert.equal(exam.href, '/practice/fin-3610-midterm-f24');
  assert.deepEqual(exam.units, ['Valuation']);
  assert.deepEqual(exam.semester, { term: 'fall', year: 2024 });
});

test('a different course yields only its own items', () => {
  const items = buildArchiveItems({
    lessons,
    quizzes,
    papers,
    course: 'other-course',
  });
  assert.deepEqual(
    items.map((i) => i.title),
    ['Bonds'],
  );
});

test('exam with empty covers falls back to lessonSlug for units', () => {
  const fallbackQuiz: QuizInput[] = [
    {
      slug: 'fin-3610-final-f24',
      course: 'fin-3610',
      title: 'Final',
      kind: 'exam',
      lessonSlug: 'fin-3610/valuing-stocks',
      covers: [],
      semester: { term: 'fall', year: 2024 },
    },
  ];
  const items = buildArchiveItems({
    lessons,
    quizzes: fallbackQuiz,
    course: 'fin-3610',
  });
  const exam = items.find((i) => i.type === 'exam');
  assert.ok(exam);
  assert.deepEqual(exam.lessonSlugs, ['fin-3610/valuing-stocks']);
  assert.deepEqual(exam.units, ['Valuation']);
});

const lessonIndex: LessonRef[] = [
  {
    slug: 'fin-3610/valuing-stocks',
    title: 'Valuing Stocks',
    unit: 'Valuation',
  },
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
    papers,
    course: 'fin-3610',
  });
  const f = deriveFacets(items, lessonIndex);
  assert.deepEqual(f.types, ['notes', 'exam', 'assignment']);
  // spring 2025 is newer than fall 2024
  assert.deepEqual(
    f.semesters.map((s) => s.key),
    ['spring-2025', 'fall-2024'],
  );
  assert.deepEqual(f.units, ['Valuation']);
  assert.deepEqual(f.lessons, [
    { slug: 'fin-3610/valuing-stocks', title: 'Valuing Stocks' },
  ]);
});

test('deriveFacets orders same-year semesters fall-before-spring; labels all terms', () => {
  assert.equal(semesterLabel({ term: 'spring', year: 2025 }), 'Spring 2025');
  assert.equal(semesterLabel({ term: 'summer', year: 2025 }), 'Summer 2025');

  const sameYear: QuizInput[] = [
    {
      slug: 'q-spring',
      course: 'fin-3610',
      title: 'Spring exam',
      kind: 'exam',
      covers: ['fin-3610/valuing-stocks'],
      semester: { term: 'spring', year: 2025 },
    },
    {
      slug: 'q-fall',
      course: 'fin-3610',
      title: 'Fall exam',
      kind: 'exam',
      covers: ['fin-3610/valuing-stocks'],
      semester: { term: 'fall', year: 2025 },
    },
  ];
  const items = buildArchiveItems({
    lessons,
    quizzes: sameYear,
    course: 'fin-3610',
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
    papers,
    course: 'fin-3610',
  });

  assert.equal(filterItems(items, { type: 'assignment' }).length, 1);
  assert.equal(filterItems(items, { semester: 'fall-2024' }).length, 1);
  // notes have no semester -> excluded when a semester is selected
  assert.equal(
    filterItems(items, { semester: 'fall-2024' }).every(
      (i) => i.type !== 'notes',
    ),
    true,
  );
  assert.equal(filterItems(items, { unit: 'Valuation' }).length, 3);
  assert.equal(
    filterItems(items, { lesson: 'fin-3610/valuing-stocks' }).length,
    3,
  );
  // keyword: all tokens must appear in searchText
  assert.equal(filterItems(items, { query: 'problem set' }).length, 1);
  assert.equal(filterItems(items, { query: 'nonexistent' }).length, 0);
  // empty filters -> everything
  assert.equal(filterItems(items, {}).length, items.length);

  // multi-facet AND: an assignment that is also in unit 'Valuation'
  assert.equal(
    filterItems(items, { type: 'assignment', unit: 'Valuation' }).length,
    1,
  );
  // multi-facet AND that yields zero: an assignment in the exam's semester
  assert.equal(
    filterItems(items, { type: 'assignment', semester: 'fall-2024' }).length,
    0,
  );
  // whitespace-only query is treated as no query
  assert.equal(filterItems(items, { query: '   ' }).length, items.length);
});

test('papers become file-exam/assignment items with fileUrl and no /practice href', () => {
  const items = buildArchiveItems({
    lessons,
    quizzes: [],
    papers,
    course: 'fin-3610',
  });
  const paper = items.find((i) => i.type === 'assignment');
  assert.ok(paper);
  assert.equal(paper.href, '');
  assert.equal(paper.fileUrl, 'https://signed.example/p1.pdf');
  assert.equal(paper.fileName, 'ps1.pdf');
  assert.deepEqual(paper.units, ['Valuation']);
  assert.deepEqual(paper.semester, { term: 'spring', year: 2025 });
});

test('buildArchiveItems works when papers is omitted', () => {
  const items = buildArchiveItems({ lessons, quizzes, course: 'fin-3610' });
  assert.ok(items.length > 0);
});
