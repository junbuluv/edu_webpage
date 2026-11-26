import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  TENOR,
  forwardCheck,
  impliedForward,
  inversionSpells,
  monthAt,
  monthEndRows,
  monthIndex,
  monthLabel,
  parseFredCsv,
  runs,
  spread,
  type YieldCurveData,
} from './yield-curve.ts';

const CSV = [
  'observation_date,DGS1,DGS2',
  '2024-01-30,4.70,4.30',
  '2024-01-31,4.73,',
  '2024-02-01,4.68,4.20',
  '2024-02-29,,4.64',
  '2024-04-01,5.03,4.72',
].join('\n');

test('a FRED CSV becomes dated rows, with blanks and dots as missing', () => {
  const rows = parseFredCsv('observation_date,A,B\n2024-01-02,1.5,.\n');
  assert.deepEqual(rows, [{ date: '2024-01-02', values: [1.5, null] }]);
});

test('month-end is each series’ last quoted value in the month', () => {
  const rows = monthEndRows(parseFredCsv(CSV), '2024-01', '2024-02');
  assert.deepEqual(rows, [
    [4.73, 4.3],
    [4.68, 4.64],
  ]);
});

test('a month with no quote for a series is missing, not carried forward', () => {
  const rows = monthEndRows(parseFredCsv(CSV), '2024-03', '2024-04');
  assert.deepEqual(rows, [
    [null, null],
    [5.03, 4.72],
  ]);
});

test('months count forward from the first month across year ends', () => {
  assert.equal(monthAt('2000-01', 0), '2000-01');
  assert.equal(monthAt('2000-01', 11), '2000-12');
  assert.equal(monthAt('2000-01', 13), '2001-02');
  assert.equal(monthAt('1999-11', 2), '2000-01');
});

test('the gap between two maturities is long minus short, in points', () => {
  const row = [5.4, 5.3, 4.9, 4.2, 4.0, null];
  assert.ok(Math.abs(spread(row, TENOR.y10, TENOR.y2)! - -0.9) < 1e-12);
  assert.equal(spread(row, TENOR.y30, TENOR.y2), null);
});

test('1-year and 2-year yields imply the 1-year rate one year ahead', () => {
  // (1.05^2 / 1.04) - 1 = 6.0096%
  assert.ok(Math.abs(impliedForward(4, 5) - 6.009615) < 1e-5);
  assert.ok(Math.abs(impliedForward(5, 5) - 5) < 1e-12);
  // An inverted pair implies a lower rate ahead.
  assert.ok(impliedForward(5, 4) < 4);
});

test('inversion spells are unbroken runs of months with a negative gap', () => {
  const rows = [
    [1, 2],
    [2, 1],
    [3, 1],
    [1, 2],
    [null, 2],
    [3, 2],
  ];
  // long = column 1, short = column 0
  assert.deepEqual(inversionSpells(rows, 1, 0), [
    [1, 2],
    [5, 5],
  ]);
});

test('a month maps back to its row, the inverse of counting forward', () => {
  assert.equal(monthIndex('2000-01', '2000-01'), 0);
  assert.equal(monthIndex('2000-01', '2001-02'), 13);
  assert.equal(monthAt('2000-01', monthIndex('2000-01', '2023-07')), '2023-07');
});

test('runs are the first and last index of each unbroken stretch of flags', () => {
  assert.deepEqual(runs([0, 1, 1, 0, 1]), [
    [1, 2],
    [4, 4],
  ]);
  assert.deepEqual(runs([false, false]), []);
  assert.deepEqual(runs([true]), [[0, 0]]);
});

test('a month reads as its name and year', () => {
  assert.equal(monthLabel('2023-07'), 'July 2023');
  assert.equal(monthLabel('2000-01'), 'January 2000');
  assert.equal(monthLabel('2026-12'), 'December 2026');
});

test('the forecast check pairs the implied rate with the 1-year yield a year on', () => {
  // Columns: 3-month, 1-year, 2-year (the check reads columns 1 and 2).
  const rows = [
    [3.0, 4.0, 5.0],
    ...Array.from({ length: 11 }, () => [0, 0, 0]),
    [3.0, 5.5, 5.0],
  ];
  const first = forwardCheck(rows, 0);
  assert.ok(Math.abs(first.implied - 6.009615) < 1e-5);
  assert.equal(first.realized, 5.5);
});

test('the forecast check has no realized yield in the last twelve months', () => {
  const rows = Array.from({ length: 12 }, () => [3.0, 4.0, 5.0]);
  assert.equal(forwardCheck(rows, 0).realized, null);
  assert.equal(forwardCheck(rows, 11).realized, null);
});

// The committed data file, built by scripts/cases/yield-curve-data.ts.
const data = JSON.parse(
  readFileSync(new URL('./yield-curve.json', import.meta.url), 'utf8'),
) as YieldCurveData;
const at = (month: string) => monthIndex(data.start, month);

test('the data file has one row and one recession flag per month', () => {
  assert.equal(data.start, '2000-01');
  assert.deepEqual(data.maturities, [0.25, 1, 2, 5, 10, 30]);
  assert.ok(data.yields.length >= 322);
  assert.equal(data.recession.length, data.yields.length);
  for (const row of data.yields) assert.equal(row.length, 6);
  assert.ok(data.recession.every((r) => r === 0 || r === 1));
});

// FRED's notes for DGS30: "The 30-year Treasury constant maturity series was
// discontinued on February 18, 2002, and reintroduced on February 9, 2006."
test('yields are plausible; only the discontinued 30-year months are empty', () => {
  const from = at('2002-02');
  const to = at('2006-01');
  data.yields.forEach((row, i) => {
    row.forEach((y, j) => {
      const where = `${monthAt(data.start, i)} column ${j}`;
      if (j === TENOR.y30 && i >= from && i <= to) {
        assert.equal(y, null, where);
        return;
      }
      assert.notEqual(y, null, where);
      assert.ok(y! >= 0 && y! < 8, `${where}: ${y}`);
    });
  });
});

test('the recession flags cover 2001, 2008-09 and 2020', () => {
  for (const m of ['2001-06', '2008-09', '2009-03', '2020-04']) {
    assert.equal(data.recession[at(m)], 1, m);
  }
  for (const m of ['2000-01', '2005-06', '2015-06', '2023-07']) {
    assert.equal(data.recession[at(m)], 0, m);
  }
});

test('the curve was inverted in early 2007 and in mid 2023, not in 2010', () => {
  const gap = (m: string) => spread(data.yields[at(m)], TENOR.y10, TENOR.y2)!;
  assert.ok(gap('2007-02') < 0);
  assert.ok(gap('2023-07') < -0.5);
  assert.ok(gap('2010-06') > 2);
});
