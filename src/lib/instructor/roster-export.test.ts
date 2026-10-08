// Run: node --test src/lib/instructor/roster-export.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  csvCell,
  rosterExportHeader,
  rosterExportRow,
  type RosterExportStudent,
} from './roster-export.ts';

const student: RosterExportStudent = {
  name: 'Ada, L.',
  email: 'ada@baruchmail.cuny.edu',
  section: 'CML',
  lessonsCompleted: 3,
  lessonsTotal: 11,
  quizzesTaken: 2,
  quizAttempts: 5,
  avgFirstScore: 0.4567,
  avgBestScore: 1,
  attendanceCount: 1,
  weeklyCells: ['attended', 'missed'],
  lastActiveAt: '2026-10-01T12:00:00Z',
  risk: {
    atRisk: true,
    reasons: ['Low first-try quiz avg (46%)', 'No workshop attendance'],
  },
};

test('header lists attempts, first-try and best averages, then the weeks', () => {
  assert.deepEqual(rosterExportHeader(['2026-09-28', '2026-10-05']), [
    'name',
    'email',
    'section',
    'lessons_completed',
    'lessons_total',
    'quizzes_taken',
    'quiz_attempts',
    'avg_first_score',
    'avg_best_score',
    'attendance',
    'week_2026-09-28',
    'week_2026-10-05',
    'last_active',
    'at_risk',
    'risk_reasons',
  ]);
});

test('row rounds scores to two decimals and quotes cells that need it', () => {
  assert.equal(
    rosterExportRow(student, (c) => (c === 'attended' ? '1' : '0')),
    '"Ada, L.",ada@baruchmail.cuny.edu,CML,3,11,2,5,0.46,1,1,1,0,' +
      '2026-10-01T12:00:00Z,yes,Low first-try quiz avg (46%); No workshop attendance',
  );
});

test('missing scores export as empty cells', () => {
  const row = rosterExportRow(
    { ...student, avgFirstScore: null, avgBestScore: null },
    () => '',
  );
  assert.ok(row.includes(',2,5,,,1,'), row);
});

test('csvCell neutralizes spreadsheet formulas and escapes quotes', () => {
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(csvCell('+1'), "'+1");
  assert.equal(csvCell('-2'), "'-2");
  assert.equal(csvCell('@sum'), "'@sum");
  assert.equal(csvCell('line\nbreak'), '"line\nbreak"');
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(7), '7');
});
