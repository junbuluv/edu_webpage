// Builds src/lib/cases/market-annual.json for the public market equivalent
// case from the Ken French Data Library (free for education with
// attribution). The raw download is not committed:
//
//   https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/F-F_Research_Data_Factors_CSV.zip
//
// Usage: node scripts/cases/market-annual-data.ts <F-F_Research_Data_Factors.csv>
//
// The file's "Annual Factors: January-December" section gives, per year, the
// market's return above one-month Treasury bills (Mkt-RF) and the bill
// return (RF). The market's total return, dividends included, is their sum.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(
  new URL('../../src/lib/cases/market-annual.json', import.meta.url),
);

const path = process.argv[2];
assert.ok(path, 'pass the path of F-F_Research_Data_Factors.csv');
const lines = readFileSync(path, 'utf8').split(/\r?\n/);

const at = lines.findIndex((l) => /Annual Factors: January-December/.test(l));
assert.ok(at > 0, 'no annual section');
assert.match(lines[at + 1], /^,Mkt-RF,SMB,HML,RF\s*$/, 'unexpected header');

const rows: { year: number; mktRf: number; rf: number }[] = [];
for (const line of lines.slice(at + 2)) {
  const m = line.match(/^\s*(\d{4}),(.+)$/);
  if (!m) break;
  const [mktRf, , , rf] = m[2].split(',').map((x) => Number(x.trim()));
  assert.ok(Number.isFinite(mktRf) && Number.isFinite(rf), line);
  rows.push({ year: Number(m[1]), mktRf, rf });
}
rows.forEach((r, i) => assert.equal(r.year, rows[0].year + i, 'gap in years'));
const copyright = lines.find((l) => /^Copyright/.test(l))?.trim();
assert.ok(copyright, 'no copyright line');

const round2 = (x: number) => Math.round(x * 100) / 100;
const data = {
  source: 'Ken French Data Library, Tuck School of Business at Dartmouth',
  sourceUrl:
    'https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library.html',
  copyright,
  units: 'percent per calendar year',
  start: rows[0].year,
  /** US stock market total return: Mkt-RF + RF. */
  market: rows.map((r) => round2(r.mktRf + r.rf)),
  riskFree: rows.map((r) => r.rf),
};

writeFileSync(OUT, JSON.stringify(data) + '\n');
console.log(
  `${rows.length} years, ${rows[0].year} to ${rows[rows.length - 1].year} -> ${OUT}`,
);
