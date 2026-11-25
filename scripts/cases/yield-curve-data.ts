// Builds src/lib/cases/yield-curve.json for the yield curve case study from
// two FRED downloads (US public-domain data; the raw files are not committed):
//
//   https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS3MO,DGS1,DGS2,DGS5,DGS10,DGS30
//   https://fred.stlouisfed.org/graph/fredgraph.csv?id=USREC
//
// Usage: node scripts/cases/yield-curve-data.ts <yields.csv> <usrec.csv>
//
// The file runs from January 2000 through the last month the recession
// series covers, so every month in it is complete.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  monthEndRows,
  parseFredCsv,
  type YieldCurveData,
} from '../../src/lib/cases/yield-curve.ts';

const START = '2000-01';
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

writeFileSync(OUT, JSON.stringify(data) + '\n');
console.log(`${data.yields.length} months, ${START} to ${through} -> ${OUT}`);
