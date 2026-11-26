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
  closes_at: string,
): WeeklyAdministration {
  return { id, week_of, closes_at };
}

test('a stamp in any window of the week marks the week attended', () => {
  const admins = [admin('a1', wk1, '2026-09-10T15:00:00-04:00')];
  const res = buildWeeklyAttendance(
    admins,
    [{ user_id: 's1', administration_id: 'a1' }],
    ['s1', 's2'],
    NOW,
  );
  assert.deepEqual(res.weeks, [wk1]);
  assert.deepEqual(res.cellsByUser.get('s1'), ['attended']);
  assert.deepEqual(res.cellsByUser.get('s2'), ['missed']);
});

test('unstamped week is pending while a window is open, missed after close', () => {
  const admins = [
    admin('a1', wk1, '2026-09-10T15:00:00-04:00'), // closed
    admin('a2', wk2, '2026-09-17T15:00:00-04:00'), // still open at NOW
  ];
  const res = buildWeeklyAttendance(admins, [], ['s1'], NOW);
  assert.deepEqual(res.weeks, [wk1, wk2]);
  assert.deepEqual(res.cellsByUser.get('s1'), ['missed', 'pending']);
});

test('two windows in one week: any open window keeps it pending', () => {
  const admins = [
    admin('a1', wk1, '2026-09-08T15:00:00-04:00'), // closed
    admin('a2', wk1, '2026-09-20T15:00:00-04:00'), // open
  ];
  const res = buildWeeklyAttendance(admins, [], ['s1'], NOW);
  assert.deepEqual(res.cellsByUser.get('s1'), ['pending']);
});

test('stamps from users off the roster are ignored', () => {
  const admins = [admin('a1', wk1, '2026-09-07T15:00:00-04:00')];
  const res = buildWeeklyAttendance(
    admins,
    [{ user_id: 'ghost', administration_id: 'a1' }],
    ['s1'],
    NOW,
  );
  assert.equal(res.cellsByUser.has('ghost'), false);
  assert.deepEqual(res.cellsByUser.get('s1'), ['missed']);
});

test('stamps on windows outside the list are ignored', () => {
  const admins = [admin('a1', wk1, '2026-09-07T15:00:00-04:00')];
  const res = buildWeeklyAttendance(
    admins,
    [{ user_id: 's1', administration_id: 'cancelled-window' }],
    ['s1'],
    NOW,
  );
  assert.deepEqual(res.cellsByUser.get('s1'), ['missed']);
});

test('csv mapping', () => {
  assert.equal(weeklyCellCsv('attended'), '1');
  assert.equal(weeklyCellCsv('missed'), '0');
  assert.equal(weeklyCellCsv('pending'), '');
});
