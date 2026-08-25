import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canRevealWorkshopQuestions,
  canUseStudentWorkshopAttendance,
  isUuid,
  matchWorkshopEnrollment,
  newYorkDateTimeInputValue,
  newYorkReportingRangeStartISO,
  parseNewYorkWallTime,
  publicWorkshopQuestions,
  sectionMatchesWeekday,
  validCoordinates,
  validRadiusMeters,
  validWorkshopWindow,
  workshopDeviceDedupeInput,
  workshopWindowStatus,
} from './workshop-policy.ts';

test('workshop self and manual attendance are student-only', () => {
  assert.equal(canUseStudentWorkshopAttendance('student'), true);
  assert.equal(canUseStudentWorkshopAttendance('ta'), false);
  assert.equal(canUseStudentWorkshopAttendance('instructor'), false);
  assert.equal(canUseStudentWorkshopAttendance('admin'), false);
  assert.equal(canUseStudentWorkshopAttendance(null), false);
});

test('New York wall time converts winter and summer offsets explicitly', () => {
  const winter = parseNewYorkWallTime('2026-01-12T09:00');
  const summer = parseNewYorkWallTime('2026-07-13T09:00');
  assert.equal(winter.ok && winter.iso, '2026-01-12T14:00:00.000Z');
  assert.equal(summer.ok && summer.iso, '2026-07-13T13:00:00.000Z');
  assert.equal(summer.ok && summer.weekOf, '2026-07-13');
});

test('New York wall time rejects DST gaps and ambiguous fall-back times', () => {
  assert.deepEqual(parseNewYorkWallTime('2026-03-08T02:30'), {
    ok: false,
    reason: 'nonexistent',
  });
  assert.deepEqual(parseNewYorkWallTime('2026-11-01T01:30'), {
    ok: false,
    reason: 'ambiguous',
  });
});

test('New York wall time rejects malformed and impossible dates', () => {
  assert.deepEqual(parseNewYorkWallTime('2026-02-30T09:00'), {
    ok: false,
    reason: 'invalid',
  });
  assert.deepEqual(parseNewYorkWallTime('July 13, 2026 9am'), {
    ok: false,
    reason: 'invalid',
  });
});

test('New York form value is independent of process timezone', () => {
  assert.equal(
    newYorkDateTimeInputValue(new Date('2026-07-13T13:00:00Z')),
    '2026-07-13T09:00',
  );
});

test('reporting weeks begin Monday midnight in New York across DST', () => {
  assert.equal(
    newYorkReportingRangeStartISO('week', new Date('2026-01-14T16:00:00Z')),
    '2026-01-12T05:00:00.000Z',
  );
  assert.equal(
    newYorkReportingRangeStartISO('week', new Date('2026-07-15T16:00:00Z')),
    '2026-07-13T04:00:00.000Z',
  );
  assert.equal(
    newYorkReportingRangeStartISO('week', new Date('2026-07-13T00:30:00Z')),
    '2026-07-06T04:00:00.000Z',
  );
});

test('reporting months use the offset at New York month start', () => {
  assert.equal(
    newYorkReportingRangeStartISO('month', new Date('2026-08-01T02:00:00Z')),
    '2026-07-01T04:00:00.000Z',
  );
  assert.equal(
    newYorkReportingRangeStartISO('month', new Date('2026-11-01T06:30:00Z')),
    '2026-11-01T04:00:00.000Z',
  );
});

test('section weekday mapping follows Monday through Thursday', () => {
  assert.equal(sectionMatchesWeekday('CML', 1), true);
  assert.equal(sectionMatchesWeekday('CTL', 2), true);
  assert.equal(sectionMatchesWeekday('CWL', 3), true);
  assert.equal(sectionMatchesWeekday('CRL', 4), true);
  assert.equal(sectionMatchesWeekday('CML', 2), false);
});

test('window validation enforces ordering and a 24-hour maximum', () => {
  const opens = new Date('2026-07-13T13:00:00Z');
  assert.equal(
    validWorkshopWindow(opens, new Date('2026-07-13T15:00:00Z')),
    true,
  );
  assert.equal(validWorkshopWindow(opens, new Date(opens)), false);
  assert.equal(
    validWorkshopWindow(opens, new Date('2026-07-14T13:00:01Z')),
    false,
  );
});

test('coordinate and radius validation rejects non-finite and out-of-range input', () => {
  assert.equal(validCoordinates(40.7411, -73.9837), true);
  assert.equal(validCoordinates(Infinity, -73.9837), false);
  assert.equal(validCoordinates(91, -73.9837), false);
  assert.equal(validCoordinates(40.7411, 181), false);
  assert.equal(validRadiusMeters(200), true);
  assert.equal(validRadiusMeters(9), false);
  assert.equal(validRadiusMeters(50_001), false);
  assert.equal(validRadiusMeters(200.5), false);
});

test('enrollment matching requires exact course, semester, instructor, and ECO section', () => {
  const administration = {
    courseSlug: 'eco-1002',
    semester: 'fall-2026',
    section: 'CML',
    instructorId: 'instructor-a',
  };
  assert.equal(
    matchWorkshopEnrollment(
      {
        courseSlug: 'eco-1002',
        semester: 'fall-2026',
        section: 'CML',
        instructorId: 'instructor-a',
      },
      administration,
    ),
    'ok',
  );
  assert.equal(
    matchWorkshopEnrollment(
      {
        courseSlug: 'eco-1002',
        semester: 'spring-2026',
        section: 'CML',
        instructorId: 'instructor-a',
      },
      administration,
    ),
    'not_enrolled',
  );
  assert.equal(
    matchWorkshopEnrollment(
      {
        courseSlug: 'eco-1002',
        semester: 'fall-2026',
        section: 'CTL',
        instructorId: 'instructor-a',
      },
      administration,
    ),
    'wrong_section',
  );
  assert.equal(
    matchWorkshopEnrollment(
      {
        courseSlug: 'eco-1002',
        semester: 'fall-2026',
        section: null,
        instructorId: 'instructor-a',
      },
      administration,
    ),
    'section_assignment_required',
  );
  assert.equal(
    matchWorkshopEnrollment(
      {
        courseSlug: 'eco-1002',
        semester: 'fall-2026',
        section: 'CML',
        instructorId: 'instructor-b',
      },
      administration,
    ),
    'wrong_instructor',
  );
  assert.equal(
    matchWorkshopEnrollment(
      {
        courseSlug: 'fin-3610',
        semester: 'fall-2026',
        section: null,
        instructorId: 'instructor-a',
      },
      {
        courseSlug: 'fin-3610',
        semester: 'fall-2026',
        section: null,
        instructorId: 'instructor-a',
      },
    ),
    'ok',
  );
});

test('window status is inclusive at open/close boundaries and cancellation wins', () => {
  const opens = '2026-07-13T13:00:00.000Z';
  const closes = '2026-07-13T15:00:00.000Z';
  assert.equal(
    workshopWindowStatus(opens, closes, null, Date.parse(opens) - 1),
    'upcoming',
  );
  assert.equal(
    workshopWindowStatus(opens, closes, null, Date.parse(opens)),
    'open',
  );
  assert.equal(
    workshopWindowStatus(opens, closes, null, Date.parse(closes)),
    'open',
  );
  assert.equal(
    workshopWindowStatus(opens, closes, null, Date.parse(closes) + 1),
    'closed',
  );
  assert.equal(
    workshopWindowStatus(opens, closes, '2026-07-13T12:00:00.000Z'),
    'cancelled',
  );
});

test('device deduplication input is stable only within one administration', () => {
  const device = '11111111-1111-4111-8111-111111111111';
  const first = workshopDeviceDedupeInput(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    device,
  );
  assert.equal(
    first,
    workshopDeviceDedupeInput('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', device),
  );
  assert.notEqual(
    first,
    workshopDeviceDedupeInput('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', device),
  );
  assert.equal(isUuid(device), true);
  assert.equal(isUuid('not-a-uuid'), false);
});

test('public workshop questions strip facilitator notes and require stamp plus reveal', () => {
  assert.deepEqual(
    publicWorkshopQuestions([
      { id: 'q1', prompt: 'Discuss this.', notes: 'Instructor answer.' },
    ]),
    [{ id: 'q1', prompt: 'Discuss this.' }],
  );
  assert.equal(canRevealWorkshopQuestions(true, '2026-07-13T13:30:00Z'), true);
  assert.equal(
    canRevealWorkshopQuestions(false, '2026-07-13T13:30:00Z'),
    false,
  );
  assert.equal(canRevealWorkshopQuestions(true, null), false);
});
