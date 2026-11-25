// Builds src/lib/cases/yield-curve.json for the yield curve case study from
// two FRED downloads (US public-domain data; the raw files are not committed):
//
//   https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS3MO,DGS1,DGS2,DGS5,DGS10,DGS30&cosd=2000-01-01
//   https://fred.stlouisfed.org/graph/fredgraph.csv?id=USREC&cosd=2000-01-01
//
// Usage: node scripts/cases/yield-curve-data.ts <yields.csv> <usrec.csv>
//
// The file runs from January 2000 through the last month the recession
// series covers, so every month in it is complete.
//
// FRED's notes for DGS30 say: "The 30-year Treasury constant maturity series
// was discontinued on February 18, 2002, and reintroduced on February 9,
// 2006." Its file still carries values in between, which the notes do not
// explain, so the month-ends inside that window are left empty.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  TENOR,
  monthEndRows,
  monthIndex,
  parseFredCsv,
  type YieldCurveData,
} from '../../src/lib/cases/yield-curve.ts';

const START = '2000-01';
const NO_30_YEAR = ['2002-02', '2006-01'];
const SERIES = ['DGS3MO', 'DGS1', 'DGS2', 'DGS5', 'DGS10', 'DGS30'];
const OUT = fileURLToPath(
  new URL('../../src/lib/cases/yield-curve.json', import.meta.url),
);

const [yieldsPath, usrecPath] = process.argv.slice(2);
assert.ok(yieldsPath && usrecPath, 'pass the yields CSV, then the USREC CSV');

const yieldsCsv = readFileSync(yieldsPath, 'utf8');
assert.equal(
  yieldsCsv.split(/\r?\n/)[0],
  `observation_date,${SERIES.join(',')}`,
  'unexpected yields header',
);
const usrec = parseFredCsv(readFileSync(usrecPath, 'utf8'));
const through = usrec[usrec.length - 1].date.slice(0, 7);

const data: YieldCurveData = {
  source: 'FRED, Federal Reserve Bank of St. Louis',
  sourceUrl: 'https://fred.stlouisfed.org',
  series: [...SERIES, 'USREC'],
  maturities: [0.25, 1, 2, 5, 10, 30],
  start: START,
  yields: monthEndRows(parseFredCsv(yieldsCsv), START, through),
  recession: monthEndRows(usrec, START, through).map((r) => r[0] ?? 0),
};
assert.equal(data.yields.length, data.recession.length);
const [from, to] = NO_30_YEAR.map((m) => monthIndex(START, m));
for (let i = from; i <= to; i++) data.yields[i][TENOR.y30] = null;

writeFileSync(OUT, JSON.stringify(data) + '\n');
console.log(`${data.yields.length} months, ${START} to ${through} -> ${OUT}`);
