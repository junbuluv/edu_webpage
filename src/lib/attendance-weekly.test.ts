import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWeeklyAttendance,
  weeklyCellCsv,
  type WeeklyAdministration,
} from './attendance-weekly.ts';

const NOW = Date.parse('2026-09-16T12:00:00-04:00'); // Wed of week 2026-09-14

const wk1 = '2026-09-07';
const wk2 = '2026-09-14';

function admin(
  id: string,
  week_of: string,
  section: string | null,
  closes_at: string,
): WeeklyAdministration {
  return { id, week_of, section, closes_at };
}

test('section matching gates both stamps and eligibility (ECO)', () => {
  const admins = [
    admin('a1', wk1, 'CML', '2026-09-07T15:00:00-04:00'),
    admin('a2', wk1, 'CTL', '2026-09-08T15:00:00-04:00'),
  ];
  const sections = new Map<string, string | null>([
    ['cml-student', 'CML'],
    ['ctl-student', 'CTL'],
  ]);
  // CML student stamped the CTL administration (should not count).
  const { weeks, cellsByUser } = buildWeeklyAttendance(
    admins,
    [
      { user_id: 'cml-student', administration_id: 'a2' },
      { user_id: 'ctl-student', administration_id: 'a2' },
    ],
    sections,
    NOW,
  );
  assert.deepEqual(weeks, [wk1]);
  assert.deepEqual(cellsByUser.get('cml-student'), ['missed']);
  assert.deepEqual(cellsByUser.get('ctl-student'), ['attended']);
});

test('null-section administrations (FIN 3610) match every student', () => {
  const admins = [admin('a1', wk1, null, '2026-09-10T15:00:00-04:00')];
  const sections = new Map<string, string | null>([['s1', null]]);
  const res = buildWeeklyAttendance(
    admins,
    [{ user_id: 's1', administration_id: 'a1' }],
    sections,
    NOW,
  );
  assert.deepEqual(res.cellsByUser.get('s1'), ['attended']);
});

test('unstamped week is pending while a matching window is open, missed after close', () => {
  const admins = [
    admin('a1', wk1, null, '2026-09-10T15:00:00-04:00'), // closed
    admin('a2', wk2, null, '2026-09-17T15:00:00-04:00'), // still open at NOW
  ];
  const sections = new Map<string, string | null>([['s1', null]]);
  const res = buildWeeklyAttendance(admins, [], sections, NOW);
  assert.deepEqual(res.weeks, [wk1, wk2]);
  assert.deepEqual(res.cellsByUser.get('s1'), ['missed', 'pending']);
});

test('two windows in one week: any open matching window keeps it pending', () => {
  const admins = [
    admin('a1', wk1, null, '2026-09-08T15:00:00-04:00'), // closed
    admin('a2', wk1, null, '2026-09-20T15:00:00-04:00'), // open
  ];
  const sections = new Map<string, string | null>([['s1', null]]);
  const res = buildWeeklyAttendance(admins, [], sections, NOW);
  assert.deepEqual(res.cellsByUser.get('s1'), ['pending']);
});

test('weeks with no matching administration are ineligible', () => {
  const admins = [admin('a1', wk1, 'CML', '2026-09-07T15:00:00-04:00')];
  const sections = new Map<string, string | null>([['ctl-student', 'CTL']]);
  const res = buildWeeklyAttendance(admins, [], sections, NOW);
  assert.deepEqual(res.cellsByUser.get('ctl-student'), ['ineligible']);
});

test('stamps from users off the roster are ignored', () => {
  const admins = [admin('a1', wk1, null, '2026-09-07T15:00:00-04:00')];
  const res = buildWeeklyAttendance(
    admins,
    [{ user_id: 'ghost', administration_id: 'a1' }],
    new Map([['s1', null]]),
    NOW,
  );
  assert.equal(res.cellsByUser.has('ghost'), false);
  assert.deepEqual(res.cellsByUser.get('s1'), ['missed']);
});

test('csv mapping', () => {
  assert.equal(weeklyCellCsv('attended'), '1');
  assert.equal(weeklyCellCsv('missed'), '0');
  assert.equal(weeklyCellCsv('pending'), '');
  assert.equal(weeklyCellCsv('ineligible'), '');
});
