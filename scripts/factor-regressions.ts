// Builds src/lib/factors/regressions.json for the FIN 3610 lesson
// "Estimating Alpha and Beta: Factor Regressions": the 1-factor (CAPM),
// 3-factor and 5-factor regressions of six portfolios' monthly excess returns,
// July 1963 through the latest month in the files.
//
// WHERE: terminal, repo root. Download and unzip these four files from Ken
// French's data library. Never commit the raw files; the repo is public. The
// project owner approved (2026-11-25) committing the monthly series this
// script derives for the chart, with the library's credit, link and copyright
// line:
//   https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/
//     F-F_Research_Data_Factors_CSV.zip
//     F-F_Research_Data_5_Factors_2x3_CSV.zip
//     6_Portfolios_2x3_CSV.zip
//     10_Industry_Portfolios_CSV.zip
// then pass the CSV paths in that order:
//   node scripts/factor-regressions.ts F-F_Research_Data_Factors.csv \
//     F-F_Research_Data_5_Factors_2x3.csv 6_Portfolios_2x3.csv \
//     10_Industry_Portfolios.csv
//
// The 3-factor model uses the three-factor file and the 5-factor model the
// five-factor file, because the two files define the size factor (SMB)
// differently. Returns are in percent per month throughout.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';
import { ols } from '../src/lib/factors/ols.ts';

const START = 196307; // first month of the five-factor file
const OUT = fileURLToPath(
  new URL('../src/lib/factors/regressions.json', import.meta.url),
);

type Table = Map<number, Record<string, number>>;

// One monthly block of a Ken French CSV: an optional section title line, a
// header line that starts with a comma, then "YYYYMM, v1, v2, ..." rows until
// the first line that is not such a row.
function monthlyTable(path: string, section?: string): Table {
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  const from = section ? lines.findIndex((l) => l.trim() === section) : 0;
  assert.ok(from >= 0, `${path}: section "${section}" not found`);
  const head = lines.findIndex((l, i) => i >= from && l.startsWith(','));
  assert.ok(head >= 0, `${path}: no header row`);
  const names = lines[head]
    .split(',')
    .slice(1)
    .map((s) => s.trim());
  const table: Table = new Map();
  for (const line of lines.slice(head + 1)) {
    if (!/^\s*\d{6}\s*,/.test(line)) break;
    const cells = line.split(',').map((s) => Number(s));
    assert.equal(cells.length, names.length + 1, `${path}: ragged row`);
    table.set(
      cells[0],
      Object.fromEntries(names.map((name, j) => [name, cells[j + 1]])),
    );
  }
  return table;
}

const paths = process.argv.slice(2);
assert.equal(paths.length, 4, 'usage: see the comment at the top of this file');
// The copyright line at the foot of the data files, e.g. "Copyright 2026
// Eugene F. Fama and Kenneth R. French"; shown with the chart's credit.
const copyright = readFileSync(paths[0], 'utf8')
  .split(/\r?\n/)
  .find((line) => line.startsWith('Copyright'))
  ?.trim();
assert.ok(copyright, `${paths[0]}: no copyright line`);
const VW = 'Average Value Weighted Returns -- Monthly';
const ff3 = monthlyTable(paths[0]);
const ff5 = monthlyTable(paths[1]);
const sixPortfolios = monthlyTable(paths[2], VW);
const industries = monthlyTable(paths[3], VW);

// Sample: every month from July 1963 to the last month all four files share.
const end = Math.min(
  ...[ff3, ff5, sixPortfolios, industries].map((t) => Math.max(...t.keys())),
);
const months: number[] = [];
for (let m = START; m <= end; m += m % 100 === 12 ? 89 : 1) months.push(m);

function series(table: Table, column: string): number[] {
  return months.map((m) => {
    const value = table.get(m)?.[column];
    assert.ok(
      value !== undefined && Number.isFinite(value) && value > -99,
      `missing ${column} for ${m}`,
    );
    return value;
  });
}

// Self-check on the parsing: both factor files carry the same T-bill and
// value-factor columns, so the two must agree month by month. (The market
// columns do not agree exactly: in the 202609 vintage they differ by up to
// 0.08 in 167 of 759 months, so each model uses its own file's market column.)
for (const column of ['RF', 'HML']) {
  assert.deepEqual(
    series(ff3, column),
    series(ff5, column),
    `${column} differs between the factor files`,
  );
}

const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
const round = (v: number, digits: number) => Number(v.toFixed(digits));

const MODELS = [
  { id: 'capm', table: ff3, factors: ['Mkt-RF'] },
  { id: 'ff3', table: ff3, factors: ['Mkt-RF', 'SMB', 'HML'] },
  { id: 'ff5', table: ff5, factors: ['Mkt-RF', 'SMB', 'HML', 'RMW', 'CMA'] },
].map((m) => ({ ...m, x: m.factors.map((f) => series(m.table, f)) }));

const PORTFOLIOS = [
  { id: 'small-value', table: sixPortfolios, column: 'SMALL HiBM' },
  { id: 'small-growth', table: sixPortfolios, column: 'SMALL LoBM' },
  { id: 'big-value', table: sixPortfolios, column: 'BIG HiBM' },
  { id: 'big-growth', table: sixPortfolios, column: 'BIG LoBM' },
  { id: 'utilities', table: industries, column: 'Utils' },
  { id: 'high-tech', table: industries, column: 'HiTec' },
];

const rf = series(ff3, 'RF');
// The lesson's "limits" section reruns the CAPM regression on each half of
// the sample and on the last 60 months (a common window in practice).
const half = Math.floor(months.length / 2);
const WINDOWS = [
  [0, half],
  [half, months.length],
  [months.length - 60, months.length],
];
const yyyymm = (m: number) =>
  `${Math.floor(m / 100)}-${String(m % 100).padStart(2, '0')}`;

const result = {
  source: 'Ken French Data Library, Tuck School of Business',
  sourceUrl:
    'https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library.html',
  copyright,
  units: 'percent per month',
  sample: { start: yyyymm(START), end: yyyymm(end), months: months.length },
  riskFreeMean: round(mean(rf), 6),
  models: MODELS.map((m) => ({
    id: m.id,
    factors: m.factors,
    factorMeans: m.x.map((x) => round(mean(x), 6)),
    // Market excess return each month: the horizontal axis of the scatter.
    market: m.x[0],
  })),
  portfolios: PORTFOLIOS.map((p) => {
    const excess = series(p.table, p.column).map((r, i) => r - rf[i]);
    return {
      id: p.id,
      column: p.column,
      meanExcess: round(mean(excess), 6),
      capmWindows: WINDOWS.map(([from, to]) => {
        const fit = ols(excess.slice(from, to), [
          MODELS[0].x[0].slice(from, to),
        ]);
        return {
          start: yyyymm(months[from]),
          end: yyyymm(months[to - 1]),
          months: to - from,
          coef: fit.coef.map((v) => round(v, 6)),
          se: fit.se.map((v) => round(v, 6)),
          t: fit.t.map((v) => round(v, 2)),
          r2: round(fit.r2, 6),
        };
      }),
      models: Object.fromEntries(
        MODELS.map((m) => {
          const fit = ols(excess, m.x);
          return [
            m.id,
            {
              coef: fit.coef.map((v) => round(v, 6)),
              se: fit.se.map((v) => round(v, 6)),
              t: fit.t.map((v) => round(v, 2)),
              r2: round(fit.r2, 6),
              // The vertical axis of the scatter: the excess return minus the
              // part the non-market factors explain, so the points scatter
              // around the line alpha + (market beta) x. For CAPM this is the
              // excess return itself.
              y: excess.map((e, i) =>
                round(
                  e -
                    m.x
                      .slice(1)
                      .reduce((s, x, j) => s + fit.coef[j + 2] * x[i], 0),
                  2,
                ),
              ),
            },
          ];
        }),
      ),
    };
  }),
};

writeFileSync(
  OUT,
  await prettier.format(JSON.stringify(result), {
    ...(await prettier.resolveConfig(OUT)),
    filepath: OUT,
  }),
);

console.log(`${result.sample.start} to ${result.sample.end}:`, months.length);
for (const p of result.portfolios) {
  for (const m of MODELS) {
    const r = p.models[m.id];
    console.log(
      p.id.padEnd(13),
      m.id.padEnd(5),
      `alpha ${r.coef[0].toFixed(3)} (t ${r.t[0].toFixed(2)})`,
      `betas ${r.coef
        .slice(1)
        .map((b) => b.toFixed(2))
        .join(' ')}`,
      `R2 ${r.r2.toFixed(3)}`,
    );
  }
}
